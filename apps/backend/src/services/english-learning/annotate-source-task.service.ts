import {
	BadRequestException,
	Injectable,
	NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import {
	type AnnotateSourceTaskProgress,
	type AnnotateSourceTaskStatus,
	EnglishAnnotateSourceTask,
} from './entity/english-annotate-source-task.entity';

const ACTIVE: AnnotateSourceTaskStatus[] = ['running', 'paused'];
const STALE_RUNNING_MS = 2 * 60 * 1000;
const PROGRESS_THROTTLE_MS = 2000;
const LIST_LIMIT = 50;

@Injectable()
export class AnnotateSourceTaskService {
	/** taskId → 上次落库时间 */
	private readonly lastProgressWriteAt = new Map<string, number>();

	constructor(
		@InjectRepository(EnglishAnnotateSourceTask)
		private readonly repo: Repository<EnglishAnnotateSourceTask>,
	) {}

	toDto(row: EnglishAnnotateSourceTask) {
		return {
			id: row.id,
			source: row.source,
			libraryId: row.libraryId ?? undefined,
			streamId: row.streamId ?? undefined,
			title: row.title,
			status: row.status,
			progress: row.progress,
			errorMessage: row.errorMessage ?? undefined,
			startedAt: row.startedAt.getTime(),
			updatedAt: row.updatedAt.getTime(),
			finishedAt: row.finishedAt?.getTime(),
		};
	}

	/** 创建或获取标注任务 */
	async createOrGet(params: {
		userId: number;
		source: 'library' | 'pack';
		libraryId?: string;
		streamId?: string;
		title: string;
	}): Promise<{ task: EnglishAnnotateSourceTask; reused: boolean }> {
		const libraryId =
			params.source === 'library' ? params.libraryId?.trim() || null : null;
		const streamId =
			params.source === 'pack' ? params.streamId?.trim() || null : null;
		if (params.source === 'library' && !libraryId) {
			throw new BadRequestException('libraryId 不能为空');
		}
		if (params.source === 'pack' && !streamId) {
			throw new BadRequestException('streamId 不能为空');
		}

		const title = params.title.trim() || '—';

		// 同一来源只保留一张卡：先复用活跃，再复活最近一条 done/error
		const existing = await this.findActiveForSource(
			params.userId,
			params.source,
			libraryId,
			streamId,
		);
		if (existing) {
			// 再次点开同源：刷新 updatedAt，列表顶到最前
			existing.title = title;
			await this.repo.save(existing);
			await this.removeOtherTasksForSource(
				params.userId,
				params.source,
				libraryId,
				streamId,
				existing.id,
			);
			return { task: existing, reused: true };
		}

		const latest = await this.findLatestForSource(
			params.userId,
			params.source,
			libraryId,
			streamId,
		);
		if (latest) {
			latest.title = title;
			latest.status = 'running';
			latest.errorMessage = null;
			latest.finishedAt = null;
			// 保留 progress 作首屏快照；SSE 会覆盖。全热缓存时仍是同一张卡。
			const saved = await this.repo.save(latest);
			await this.removeOtherTasksForSource(
				params.userId,
				params.source,
				libraryId,
				streamId,
				saved.id,
			);
			// reused:false：前端会开新 SSE（与「复用仍在跑的活跃任务」区分）
			return { task: saved, reused: false };
		}

		const row = this.repo.create({
			userId: params.userId,
			source: params.source,
			libraryId,
			streamId,
			title,
			status: 'running',
			progress: null,
			errorMessage: null,
			finishedAt: null,
		});
		const saved = await this.repo.save(row);
		return { task: saved, reused: false };
	}

	/** 获取用户所有标注任务 */
	async listForUser(userId: number) {
		const rows = await this.repo.find({
			where: { userId },
			order: { updatedAt: 'DESC' },
			take: LIST_LIMIT,
		});
		const out: EnglishAnnotateSourceTask[] = [];
		for (const row of rows) {
			out.push(await this.reconcileIfStale(row));
		}
		return out;
	}

	/** 获取用户指定标注任务 */
	async getOwned(userId: number, taskId: string) {
		const row = await this.repo.findOne({ where: { id: taskId, userId } });
		if (!row) throw new NotFoundException('标注任务不存在');
		return this.reconcileIfStale(row);
	}

	/** 暂停标注任务（不刷 updatedAt：停止不顶前） */
	async pause(userId: number, taskId: string) {
		const row = await this.getOwned(userId, taskId);
		if (row.status === 'done' || row.status === 'error') {
			return row;
		}
		if (row.status === 'paused') return row;
		await this.repo
			.createQueryBuilder()
			.update(EnglishAnnotateSourceTask)
			.set({ status: 'paused', finishedAt: null })
			.where('id = :id AND user_id = :userId', { id: row.id, userId })
			.execute();
		row.status = 'paused';
		row.finishedAt = null;
		return row;
	}

	/** 从资源库点「查看进度」：只刷新 updatedAt，列表顶到最前（不改状态） */
	async bumpList(userId: number, taskId: string) {
		const row = await this.getOwned(userId, taskId);
		await this.repo.update({ id: row.id, userId }, { updatedAt: new Date() });
		return this.getOwned(userId, taskId);
	}

	/** 断线时调用：仅 running → paused，忽略其它状态（不刷 updatedAt） */
	async pauseIfRunning(userId: number, taskId: string) {
		await this.repo
			.createQueryBuilder()
			.update(EnglishAnnotateSourceTask)
			.set({ status: 'paused' })
			.where('id = :id AND user_id = :userId AND status = :status', {
				id: taskId,
				userId,
				status: 'running',
			})
			.execute();
	}

	/** 恢复标注任务 */
	async resume(userId: number, taskId: string) {
		const row = await this.getOwned(userId, taskId);
		if (row.status === 'running') return row;
		if (row.status === 'done') {
			// done 但未标完 / 有失败：允许重开（与 reconcileIfPartialFailed 对齐）
			if (!this.isIncompleteDone(row)) {
				throw new BadRequestException('任务已完成，请重新开始标注');
			}
		}
		const other = await this.findActiveForSource(
			userId,
			row.source,
			row.libraryId,
			row.streamId,
		);
		if (other && other.id !== row.id) {
			throw new BadRequestException('该集合已有进行中的标注任务');
		}
		row.status = 'running';
		row.errorMessage = null;
		row.finishedAt = null;
		return this.repo.save(row);
	}

	async markDone(
		userId: number,
		taskId: string,
		progress: AnnotateSourceTaskProgress,
	) {
		if ((progress.failed ?? 0) > 0) {
			await this.markError(
				userId,
				taskId,
				`有 ${progress.failed} 句标注失败，可点继续重试`,
				progress,
			);
			return;
		}
		const row = await this.repo.findOne({ where: { id: taskId, userId } });
		if (!row) return;
		row.status = 'done';
		row.progress = progress;
		row.errorMessage = null;
		row.finishedAt = new Date();
		this.lastProgressWriteAt.delete(taskId);
		await this.repo.save(row);
	}

	/** 标注失败：写入 error，可继续重试 */
	async markError(
		userId: number,
		taskId: string,
		message: string,
		progress?: AnnotateSourceTaskProgress,
	) {
		const row = await this.repo.findOne({ where: { id: taskId, userId } });
		if (!row) return;
		row.status = 'error';
		if (progress) row.progress = progress;
		row.errorMessage = message.slice(0, 500);
		row.finishedAt = new Date();
		this.lastProgressWriteAt.delete(taskId);
		await this.repo.save(row);
	}

	/** done 但仍有失败或未标满：纠成 error，便于继续重试 */
	private async reconcileIfPartialFailed(row: EnglishAnnotateSourceTask) {
		if (row.status !== 'done') return row;
		if (!this.isIncompleteDone(row)) return row;
		const failed = row.progress?.failed ?? 0;
		const pending = Math.max(
			failed,
			(row.progress?.total ?? 0) -
				(row.progress?.hit ?? 0) -
				(row.progress?.annotated ?? 0),
		);
		row.status = 'error';
		row.errorMessage =
			row.errorMessage?.trim() ||
			(failed > 0
				? `有 ${failed} 句标注失败，可点继续重试`
				: `还有 ${pending} 句未完成，可点继续`);
		if (row.progress && row.progress.remaining < pending) {
			row.progress = { ...row.progress, remaining: pending };
		}
		return this.repo.save(row);
	}

	/** done 快照未真正标满（有 failed 或 hit+annotated < total） */
	private isIncompleteDone(row: EnglishAnnotateSourceTask): boolean {
		const p = row.progress;
		if (!p || p.total <= 0) return false;
		if ((p.failed ?? 0) > 0) return true;
		return p.hit + p.annotated < p.total;
	}

	async dismiss(userId: number, taskId: string) {
		const row = await this.getOwned(userId, taskId);
		await this.repo.remove(row);
		this.lastProgressWriteAt.delete(taskId);
	}

	async dismissFinished(userId: number) {
		const rows = await this.repo.find({
			where: { userId, status: In(['done', 'error']) },
		});
		if (rows.length === 0) return 0;
		await this.repo.remove(rows);
		return rows.length;
	}

	async writeProgress(
		userId: number,
		taskId: string,
		progress: AnnotateSourceTaskProgress,
		opts?: { force?: boolean },
	) {
		const force = opts?.force === true;
		const now = Date.now();
		const last = this.lastProgressWriteAt.get(taskId) ?? 0;
		if (!force && now - last < PROGRESS_THROTTLE_MS) return;
		try {
			const row = await this.repo.findOne({ where: { id: taskId, userId } });
			if (!row) return;
			if (row.status !== 'running' && !force) return;
			row.progress = progress;
			if (row.status === 'running') {
				row.finishedAt = null;
			}
			await this.repo.save(row);
			this.lastProgressWriteAt.set(taskId, now);
		} catch {
			// ponytail: 任务表失败不挡标注主路径
		}
	}

	private sourceWhere(
		userId: number,
		source: 'library' | 'pack',
		libraryId: string | null,
		streamId: string | null,
	) {
		return source === 'library'
			? { userId, source, libraryId: libraryId! }
			: { userId, source, streamId: streamId! };
	}

	private async findActiveForSource(
		userId: number,
		source: 'library' | 'pack',
		libraryId: string | null,
		streamId: string | null,
	) {
		const row = await this.repo.findOne({
			where: {
				...this.sourceWhere(userId, source, libraryId, streamId),
				status: In(ACTIVE),
			},
			order: { updatedAt: 'DESC' },
		});
		return row ? this.reconcileIfStale(row) : null;
	}

	private async findLatestForSource(
		userId: number,
		source: 'library' | 'pack',
		libraryId: string | null,
		streamId: string | null,
	) {
		const row = await this.repo.findOne({
			where: this.sourceWhere(userId, source, libraryId, streamId),
			order: { updatedAt: 'DESC' },
		});
		return row ? this.reconcileIfStale(row) : null;
	}

	/** 同来源只留 keepId，清掉历史重复卡 */
	private async removeOtherTasksForSource(
		userId: number,
		source: 'library' | 'pack',
		libraryId: string | null,
		streamId: string | null,
		keepId: string,
	) {
		const rows = await this.repo.find({
			where: this.sourceWhere(userId, source, libraryId, streamId),
		});
		const others = rows.filter((r) => r.id !== keepId);
		if (others.length === 0) return;
		for (const r of others) this.lastProgressWriteAt.delete(r.id);
		await this.repo.remove(others);
	}

	/** running 且长时间无更新 → paused（刷新丢 SSE 后的假进行中） */
	private async reconcileIfStale(row: EnglishAnnotateSourceTask) {
		const partial = await this.reconcileIfPartialFailed(row);
		if (partial.status !== 'running') return partial;
		const age = Date.now() - partial.updatedAt.getTime();
		if (age < STALE_RUNNING_MS) return partial;
		partial.status = 'paused';
		return this.repo.save(partial);
	}
}
