/**
 * 收藏 / 错题 / 复习大集合 DOCX 异步导出（进程内 Job + 临时文件）。
 * ponytail: 不上 Bull；多实例不共享 Job；天花板与同步硬顶同为 20000。
 *
 * 说明：Job 存在当前进程内存，多实例不共享；重启会丢未完成任务。若以后要集群化再上 Bull。
 */
// 生成 Job 主键 UUID，避免与时间戳冲突
import { randomUUID } from 'node:crypto';
// 同步探测/创建临时目录，供构造函数里首次落地 DOCX
import { existsSync, mkdirSync } from 'node:fs';
// 异步读写删临时 .docx：生成写入、下载读取、TTL 清理删除
import { readFile, unlink, writeFile } from 'node:fs/promises';
// 取 OS 临时根路径，避免写进仓库 uploads
import { tmpdir } from 'node:os';
// 拼 Job 目录与单文件路径
import { join } from 'node:path';
// Nest 异常与 DI：参数校验失败 / 鉴权失败 / 可注入 / 任务不存在 / 模块销毁清定时器
import {
	BadRequestException,
	ForbiddenException,
	Injectable,
	NotFoundException,
	OnModuleDestroy,
} from '@nestjs/common';
// 复用已落地的同步导出 Buffer 逻辑，Job 只负责任务调度与落盘
import { EnglishLearningService } from './english-learning.service';

/**
 * 超过此条数前端走异步 Job（须与前端 ENGLISH_DOCX_SYNC_SOFT 一致）。
 * 取 10000：同步超时已拉到 180s，多数收藏/错题可免 Confirm；再大仍走 Job，硬顶仍为 20000。
 */
// 前端 exportEnglishDocxSmart 与此常量对齐；≤ 此值仍走同步 POST
export const DOCX_EXPORT_SYNC_SOFT = 10_000;

// 导出业务种类：决定调用 EnglishLearningService 哪条 export*DocxBuffer
export type EnglishDocxExportKind =
	// 单词收藏全量/勾选
	| 'vocabulary-favorites'
	// 经典句收藏全量/勾选
	| 'classic-quote-favorites'
	// 单词错题全量/勾选
	| 'vocabulary-mistakes'
	// 经典句错题全量/勾选
	| 'classic-quote-mistakes'
	// 今日待复习；须配合 contentKind
	| 'practice-review';

// 任务生命周期，供轮询接口与 takeFile 门禁
export type EnglishDocxExportJobStatus =
	// 已入队、run 尚未改写状态（极短窗口）
	| 'pending'
	// 正在 buildBuffer / 写盘
	| 'running'
	// 临时文件已就绪，可下载
	| 'done'
	// build 或写盘失败，error 字段有原因
	| 'failed';

// 内存中单条任务记录；不落库，进程重启即失
type JobRec = {
	// 与 Map 键、临时文件名一致
	id: string;
	// 创建者 userId；轮询/下载时必须匹配，防扫任务
	userId: number;
	// 当前状态机值
	status: EnglishDocxExportJobStatus;
	// 导出种类 → buildBuffer 分支
	kind: EnglishDocxExportKind;
	// 仅 practice-review：vocab | classic
	contentKind?: 'vocab' | 'classic';
	// 勾选 id 快照；undefined 表示全量
	ids?: string[];
	// done 后本地绝对路径；未完成则为 undefined
	filePath?: string;
	// Content-Disposition 用的下载文件名
	filename: string;
	// failed 时写入的可读错误信息
	error?: string;
	// 入队时间戳，供 sweep 按 TTL 回收
	createdAt: number;
};

// 任务与临时文件保留 30 分钟，超时由 sweep 删文件并踢出 Map
const JOB_TTL_MS = 30 * 60 * 1000;

// 注册为 Nest provider；实现 OnModuleDestroy 以清 setInterval
@Injectable()
// 进程内异步导出编排：enqueue → run → takeFile；sweep 做 TTL
export class EnglishDocxExportJobService implements OnModuleDestroy {
	// jobId → 任务记录；多实例互不可见
	private readonly jobs = new Map<string, JobRec>();
	// OS tmp 下专用子目录，隔离其它进程临时文件
	private readonly dir = join(tmpdir(), 'dnhyxc-el-docx-export');
	// 每分钟触发 sweep 的句柄；destroy 时 clear
	private cleanupTimer?: ReturnType<typeof setInterval>;

	// 注入同步导出服务；构造时确保目录存在并启动清理心跳
	constructor(private readonly englishLearning: EnglishLearningService) {
		// 冷启动时若目录不存在则创建，recursive 兼容父路径缺失
		if (!existsSync(this.dir)) {
			// 同步 mkdir，避免首个 Job 写盘竞态
			mkdirSync(this.dir, { recursive: true });
		}
		// 每 60s 扫一次过期 Job，避免 tmp 与 Map 无限涨
		this.cleanupTimer = setInterval(() => {
			// fire-and-forget：sweep 失败不应拖垮定时器回调
			void this.sweep();
			// 间隔 60_000 ms
		}, 60_000);
	}

	// Nest 模块销毁（热重载/进程退出）时停掉清理定时器，防泄漏
	onModuleDestroy(): void {
		// 仅在已启动过 interval 时 clear
		if (this.cleanupTimer) clearInterval(this.cleanupTimer);
	}

	// Controller POST docx-export-jobs：登记任务并立即异步跑，马上返回 jobId
	enqueue(
		// 当前登录用户，写入 JobRec 供后续鉴权
		userId: number,
		// 种类 + 可选勾选 + 复习 contentKind
		input: {
			kind: EnglishDocxExportKind;
			ids?: string[] | null;
			contentKind?: 'vocab' | 'classic';
		},
		// 立刻返回，不等待 DOCX 生成完
	): { jobId: string; status: EnglishDocxExportJobStatus } {
		// 复习导出缺 contentKind 时无法选 vocab/classic Buffer 分支
		if (input.kind === 'practice-review' && !input.contentKind) {
			// 400：让前端补齐 body，避免 Job 跑到一半才失败
			throw new BadRequestException('practice-review 须指定 contentKind');
		}
		// 新任务全局唯一 id，兼作临时文件名
		const id = randomUUID();
		// 下载时的友好文件名：种类前缀 + 时间戳
		const filename = `${input.kind}-${Date.now()}.docx`;
		// 组装内存记录；status 初始 pending，run 入口会改成 running
		const job: JobRec = {
			// 与 Map key、落盘文件名共用
			id,
			// 绑定创建者，防他人用 jobId 下载
			userId,
			// 入队瞬间尚未进入 try 块
			status: 'pending',
			// 复制种类供 buildBuffer switch
			kind: input.kind,
			// 复习用；其它种类可空
			contentKind: input.contentKind,
			// 有勾选则浅拷贝数组，避免调用方后续 mutate 影响 Job
			ids: input.ids?.length ? [...input.ids] : undefined,
			// 供 takeFile 返回 Content-Disposition
			filename,
			// TTL 起点
			createdAt: Date.now(),
		};
		// 挂入内存表，供 getStatus / takeFile / sweep 查找
		this.jobs.set(id, job);
		// 不 await：HTTP 立即返回；错误在 run 内写成 failed
		void this.run(job);
		// 前端轮询用 jobId；status 此时多为 pending（run 可能已抢先改为 running）
		return { jobId: id, status: job.status };
	}

	// Controller GET docx-export-jobs/:jobId：轮询用精简视图
	getStatus(
		// 必须与 Job 创建者一致
		userId: number,
		// 路径参数中的任务 id
		jobId: string,
	): {
		jobId: string;
		status: EnglishDocxExportJobStatus;
		error?: string;
	} {
		// 鉴权 + 存在性；过期/他人任务在此抛错
		const job = this.requireJob(userId, jobId);
		// 不暴露 filePath，仅给前端状态机
		return {
			// 回显 id，便于客户端对账
			jobId: job.id,
			// pending|running|done|failed
			status: job.status,
			// 仅 failed 时有值，便于 Toast
			error: job.error,
		};
	}

	// Controller GET …/download：仅 done 且文件仍在时读盘返回 Buffer
	async takeFile(
		userId: number,
		jobId: string,
	): Promise<{ buffer: Buffer; filename: string }> {
		// 同样走归属校验
		const job = this.requireJob(userId, jobId);
		// 未完成或写盘失败时没有可读路径
		if (job.status !== 'done' || !job.filePath) {
			// 400：前端应继续轮询或提示失败，而非当文件下载
			throw new BadRequestException('导出尚未完成');
		}
		// 将临时 DOCX 整文件读入内存（单文件体积受同步导出硬顶约束）
		const buffer = await readFile(job.filePath);
		// filename 给 Content-Disposition；buffer 给 res.end
		return { buffer, filename: job.filename };
	}

	// 统一拉取 Job 并校验归属；找不到或非本人则抛 Nest HTTP 异常
	private requireJob(userId: number, jobId: string): JobRec {
		// 从内存 Map 取；sweep 删掉后即为 undefined
		const job = this.jobs.get(jobId);
		// 不存在：可能过期、错误 id、或进程重启丢状态
		if (!job) {
			throw new NotFoundException('导出任务不存在或已过期');
		}
		// 防水平越权：知道 UUID 也不能下别人的包
		if (job.userId !== userId) {
			throw new ForbiddenException('无权访问该导出任务');
		}
		// 校验通过，返回可变引用（run 会原地改 status）
		return job;
	}

	// 后台执行：生成 Buffer → 写临时文件 → 更新状态；捕获异常写 failed
	private async run(job: JobRec): Promise<void> {
		// 标记进行中，轮询可见
		job.status = 'running';
		try {
			// 按 kind 调同步导出，可能较慢/占内存
			const buf = await this.buildBuffer(job);
			// 临时文件路径：目录 + jobId.docx，避免文件名冲突
			const filePath = join(this.dir, `${job.id}.docx`);
			// 原子性足够：整包写入后再标 done
			await writeFile(filePath, buf);
			// 供 takeFile readFile
			job.filePath = filePath;
			// 前端轮询见 done 后拉 download
			job.status = 'done';
		} catch (e) {
			// 任意抛错进入失败态，不留下半截「成功」状态
			job.status = 'failed';
			// Error 取 message；其它类型给兜底文案
			job.error = e instanceof Error ? e.message : '导出失败';
		}
	}

	// 按 Job.kind 分发到 EnglishLearningService 已有同步导出（含分页/硬顶）
	private async buildBuffer(job: JobRec): Promise<Buffer> {
		// 勾选快照；undefined 表示全量
		const ids = job.ids;
		// 穷尽五种业务导出入口
		switch (job.kind) {
			case 'vocabulary-favorites':
				// 单词收藏 DOCX Buffer
				return this.englishLearning.exportVocabularyFavoritesDocxBuffer(
					job.userId,
					ids,
				);
			case 'classic-quote-favorites':
				// 经典句收藏 DOCX Buffer
				return this.englishLearning.exportClassicQuoteFavoritesDocxBuffer(
					job.userId,
					ids,
				);
			case 'vocabulary-mistakes':
				// 单词错题 DOCX Buffer
				return this.englishLearning.exportVocabularyMistakesDocxBuffer(
					job.userId,
					ids,
				);
			case 'classic-quote-mistakes':
				// 经典句错题 DOCX Buffer
				return this.englishLearning.exportClassicQuoteMistakesDocxBuffer(
					job.userId,
					ids,
				);
			case 'practice-review':
				// 今日复习：contentKind 缺省按 vocab，避免 undefined 传入
				return this.englishLearning.exportPracticeReviewDueDocxBuffer(
					job.userId,
					job.contentKind === 'classic' ? 'classic' : 'vocab',
					ids,
				);
			default:
				// 理论上被 TS 穷尽；运行时脏 kind 仍 400
				throw new BadRequestException('未知导出类型');
		}
	}

	// TTL 清理：超时任务删临时文件并移出 Map，释放磁盘与内存
	private async sweep(): Promise<void> {
		// 当前时刻，与 createdAt 比较
		const now = Date.now();
		// 遍历所有进行中/已完成任务
		for (const [id, job] of this.jobs) {
			// 未满 TTL 则跳过，保留可下载窗口
			if (now - job.createdAt < JOB_TTL_MS) continue;
			// 若已落盘则尝试删除临时文件
			if (job.filePath) {
				// unlink 失败（文件已删）忽略，避免 sweep 整体中断
				await unlink(job.filePath).catch(() => undefined);
			}
			// 从内存表移除，后续 getStatus 将 404
			this.jobs.delete(id);
		}
	}
}
