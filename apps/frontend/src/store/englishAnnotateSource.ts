/**
 * 经典句整集词标注预热：任务持久化 + 暂停续跑（SSE 仍为请求生命周期）。
 */
import { makeAutoObservable, runInAction } from 'mobx';
import {
	bumpEnglishAnnotateSourceTask,
	createEnglishAnnotateSourceTask,
	dismissEnglishAnnotateSourceTask,
	dismissFinishedEnglishAnnotateSourceTasks,
	type EnglishAnnotateSourceTaskDto,
	keepPauseEnglishAnnotateSourceTask,
	listEnglishAnnotateSourceTasks,
	pauseEnglishAnnotateSourceTask,
	resumeEnglishAnnotateSourceTask,
} from '@/service';
import {
	type AnnotateSourceProgress,
	type AnnotateSourceStreamResult,
	streamAnnotateClassicSource,
} from '@/utils/annotateClassicSourceSse';

export type AnnotateTaskStatus = 'running' | 'paused' | 'done' | 'error';

export type AnnotateTask = {
	id: string;
	source: 'library' | 'pack';
	libraryId?: string;
	streamId?: string;
	title: string;
	quoteCountHint?: number;
	status: AnnotateTaskStatus;
	progress: AnnotateSourceProgress | null;
	result?: AnnotateSourceStreamResult;
	errorMessage?: string;
	startedAt: number;
	updatedAt: number;
	/**
	 * 仅「从库/历史点在线标注」抬升；停止/继续/进度写入不改。
	 * 列表按此倒序。
	 */
	listRankAt: number;
	finishedAt?: number;
};

function taskKey(
	source: 'library' | 'pack',
	libraryId?: string,
	streamId?: string,
) {
	return source === 'library'
		? `library:${(libraryId ?? '').trim()}`
		: `pack:${(streamId ?? '').trim()}`;
}

function emptyProgress(hint?: number): AnnotateSourceProgress | null {
	if (!hint || hint <= 0) return null;
	return {
		total: hint,
		hit: 0,
		miss: hint,
		annotated: 0,
		failed: 0,
		remaining: hint,
		tokensPrompt: 0,
		tokensCompletion: 0,
		tokensTotal: 0,
	};
}

function preferProgress(
	a: AnnotateSourceProgress | null | undefined,
	b: AnnotateSourceProgress | null | undefined,
): AnnotateSourceProgress | null {
	if (!a) return b ?? null;
	if (!b) return a;
	const score = (p: AnnotateSourceProgress) =>
		p.hit + p.annotated + (p.tokensTotal ?? 0) * 1e-9;
	return score(a) >= score(b) ? a : b;
}

function fromDto(dto: EnglishAnnotateSourceTaskDto): AnnotateTask {
	const startedAt = dto.startedAt;
	const updatedAt = dto.updatedAt ?? startedAt;
	return {
		id: dto.id,
		source: dto.source,
		libraryId: dto.libraryId,
		streamId: dto.streamId,
		title: dto.title,
		status: dto.status,
		progress: dto.progress,
		errorMessage: dto.errorMessage,
		startedAt,
		updatedAt,
		// 与后端 list order(updatedAt DESC) 对齐；顶前靠 bump / createOrGet 刷 updatedAt
		listRankAt: updatedAt,
		finishedAt: dto.finishedAt,
	};
}

function upsertTask(list: AnnotateTask[], task: AnnotateTask): AnnotateTask[] {
	const rest = list.filter((t) => t.id !== task.id);
	return [task, ...rest];
}

class EnglishAnnotateSourceStore {
	tasks: AnnotateTask[] = [];
	hydrated = false;
	private aborts = new Map<string, () => void>();
	private hydratePromise: Promise<void> | null = null;

	constructor() {
		makeAutoObservable(this, {}, { autoBind: true });
		if (typeof window !== 'undefined') {
			// 刷新/关页：必须先 keepalive pause（命中后端 abort 注册表），再断 SSE
			const onUnload = () => this.pauseAllRunningForUnload();
			window.addEventListener('pagehide', onUnload);
			window.addEventListener('beforeunload', onUnload);
		}
	}

	/**
	 * 页面卸载：keepalive pause 掐模型 + 落库，再 abort 本页 SSE。
	 * 若先断 SSE，注册表已 unregister，pause 打空，终端无「停止」日志。
	 */
	pauseAllRunningForUnload() {
		const ids = new Set<string>([
			...this.aborts.keys(),
			...this.tasks.filter((t) => t.status === 'running').map((t) => t.id),
		]);
		if (ids.size === 0) return;
		// 1) 先 pause：后端 cancelByStreamId → abort LLM（醒目日志）
		for (const id of ids) {
			keepPauseEnglishAnnotateSourceTask(id);
		}
		// 2) 再断本地 SSE（连接清理；此时服务端多半已 abort）
		for (const id of ids) {
			try {
				this.aborts.get(id)?.();
			} catch {
				// ignore
			}
		}
		runInAction(() => {
			for (const t of this.tasks) {
				if (t.status === 'running') {
					t.status = 'paused';
					t.finishedAt = undefined;
				}
			}
		});
	}

	get runningCount() {
		return this.tasks.filter((t) => t.status === 'running').length;
	}

	get hasVisibleTasks() {
		return this.tasks.length > 0;
	}

	hasOpenStream(taskId: string) {
		return this.aborts.has(taskId);
	}

	get orderedTasks() {
		return [...this.tasks].sort((a, b) => b.listRankAt - a.listRankAt);
	}

	/** 仅从库/历史点「在线标注 / 查看进度」时顶到最前（落库 updatedAt，刷新后仍在前） */
	bumpSourceToFront(
		source: 'library' | 'pack',
		libraryId?: string,
		streamId?: string,
	) {
		const key = taskKey(source, libraryId, streamId);
		const t = this.tasks.find(
			(x) => taskKey(x.source, x.libraryId, x.streamId) === key,
		);
		if (!t) return;
		const now = Date.now();
		runInAction(() => {
			t.listRankAt = now;
			t.updatedAt = now;
			this.tasks = upsertTask(this.tasks, t);
		});
		void bumpEnglishAnnotateSourceTask(t.id, { silent: true }).catch(
			() => undefined,
		);
	}

	isSourceRunning(
		source: 'library' | 'pack',
		libraryId?: string,
		streamId?: string,
	) {
		const key = taskKey(source, libraryId, streamId);
		return this.tasks.some(
			(t) =>
				t.status === 'running' &&
				taskKey(t.source, t.libraryId, t.streamId) === key,
		);
	}

	/** 同源有 running 或 paused（进度页仍展示该卡） */
	isSourceActive(
		source: 'library' | 'pack',
		libraryId?: string,
		streamId?: string,
	) {
		const key = taskKey(source, libraryId, streamId);
		return this.tasks.some(
			(t) =>
				(t.status === 'running' || t.status === 'paused') &&
				taskKey(t.source, t.libraryId, t.streamId) === key,
		);
	}

	findRunning(
		source: 'library' | 'pack',
		libraryId?: string,
		streamId?: string,
	) {
		const key = taskKey(source, libraryId, streamId);
		return (
			this.tasks.find(
				(t) =>
					t.status === 'running' &&
					taskKey(t.source, t.libraryId, t.streamId) === key,
			) ?? null
		);
	}

	async hydrate() {
		if (this.hydratePromise) return this.hydratePromise;
		this.hydratePromise = (async () => {
			try {
				const res = await listEnglishAnnotateSourceTasks({ silent: true });
				const items = res.data?.items ?? [];
				runInAction(() => {
					const prevRank = new Map(
						this.tasks.map((t) => [t.id, t.listRankAt] as const),
					);
					const localRunning = new Map(
						[...this.aborts.keys()].map((id) => {
							const t = this.tasks.find((x) => x.id === id);
							return [id, t] as const;
						}),
					);
					const merged = items.map((dto) => {
						const t = fromDto(dto);
						// 本页已顶前的 rank 优先；否则用服务端 updatedAt（fromDto.listRankAt）
						t.listRankAt = prevRank.get(t.id) ?? t.listRankAt;
						// 兼容旧数据：done 但仍有 failed → 可继续
						if (t.status === 'done' && (t.progress?.failed ?? 0) > 0) {
							t.status = 'error';
							t.errorMessage = undefined;
							if (t.progress && t.progress.remaining < t.progress.failed) {
								t.progress = {
									...t.progress,
									remaining: t.progress.failed,
								};
							}
						}
						return t;
					});
					for (const [id, local] of localRunning) {
						if (!local || local.status !== 'running') continue;
						const i = merged.findIndex((t) => t.id === id);
						if (i >= 0) {
							merged[i] = {
								...merged[i]!,
								...local,
								status: 'running',
								listRankAt: local.listRankAt,
							};
						} else merged.unshift(local);
					}
					// 刷新后无本页 SSE 的 running：UI 当 paused，避免假「进行中」卡死
					for (const t of merged) {
						if (t.status === 'running' && !this.aborts.has(t.id)) {
							t.status = 'paused';
							void pauseEnglishAnnotateSourceTask(t.id, { silent: true }).catch(
								() => undefined,
							);
						}
					}
					this.tasks = merged;
					this.hydrated = true;
				});
			} catch {
				runInAction(() => {
					this.hydrated = true;
				});
			} finally {
				this.hydratePromise = null;
			}
		})();
		return this.hydratePromise;
	}

	/**
	 * 启动标注：先 createOrGet 落库，再开 SSE。
	 * 若复用到 paused：不自动开流（需 resume）；running 且本页无 abort 也不双开。
	 */
	async start(params: {
		source: 'library' | 'pack';
		libraryId?: string;
		streamId?: string;
		title: string;
		quoteCountHint?: number;
	}): Promise<{ taskId: string; reused: boolean; openedStream: boolean }> {
		const existing = this.findRunning(
			params.source,
			params.libraryId,
			params.streamId,
		);
		if (existing && this.aborts.has(existing.id)) {
			this.bumpSourceToFront(params.source, params.libraryId, params.streamId);
			return { taskId: existing.id, reused: true, openedStream: false };
		}

		const res = await createEnglishAnnotateSourceTask({
			source: params.source,
			libraryId: params.libraryId,
			streamId: params.streamId,
			title: params.title.trim() || '—',
			silent: true,
		});
		const dto = res.data?.task;
		if (!dto?.id) throw new Error('创建标注任务失败');
		const reused = res.data?.reused === true;
		const task = fromDto(dto);
		// 仅从库点开在线标注时顶前
		task.listRankAt = Date.now();
		if (!task.progress && params.quoteCountHint) {
			task.progress = emptyProgress(params.quoteCountHint);
			task.quoteCountHint = params.quoteCountHint;
		}

		runInAction(() => {
			this.tasks = upsertTask(this.tasks, task);
		});

		if (task.status === 'paused') {
			// 从库再次点「在线标注」：复用暂停卡并直接续跑
			await this.resume(task.id);
			return { taskId: task.id, reused: true, openedStream: true };
		}
		if (reused && task.status === 'running' && !this.aborts.has(task.id)) {
			// 他端/断线后的假 running：本页不抢流，标成 paused 供继续
			runInAction(() => {
				const t = this.tasks.find((x) => x.id === task.id);
				if (t) t.status = 'paused';
			});
			void pauseEnglishAnnotateSourceTask(task.id, { silent: true }).catch(
				() => undefined,
			);
			return { taskId: task.id, reused: true, openedStream: false };
		}
		if (task.status !== 'running') {
			return { taskId: task.id, reused, openedStream: false };
		}

		this.openStream(task);
		return { taskId: task.id, reused, openedStream: true };
	}

	async resume(taskId: string) {
		const local = this.tasks.find((t) => t.id === taskId);
		if (!local) throw new Error('任务不存在');
		if (local.status === 'running' && this.aborts.has(taskId)) {
			return;
		}
		const keptProgress = local.progress;
		const res = await resumeEnglishAnnotateSourceTask(taskId, { silent: true });
		const dto = res.data?.task;
		if (!dto) throw new Error('继续标注失败');
		const task = fromDto(dto);
		task.progress = preferProgress(keptProgress, task.progress);
		// 继续：顶到最前（后端 resume save 已刷 updatedAt）
		task.listRankAt = Date.now();
		runInAction(() => {
			this.tasks = upsertTask(this.tasks, task);
		});
		this.openStream(task);
	}

	abort(taskId: string) {
		this.aborts.get(taskId)?.();
		void pauseEnglishAnnotateSourceTask(taskId, { silent: true })
			.then((res) => {
				const dto = res.data?.task;
				if (!dto) return;
				runInAction(() => {
					const local = this.tasks.find((x) => x.id === taskId);
					const next = fromDto(dto);
					next.progress = preferProgress(local?.progress, next.progress);
					// 停止不顶前：保留原 listRankAt
					next.listRankAt = local?.listRankAt ?? next.startedAt;
					if (next.status === 'running') next.status = 'paused';
					this.tasks = this.tasks.map((t) => (t.id === next.id ? next : t));
				});
			})
			.catch(() => {
				runInAction(() => {
					const t = this.tasks.find((x) => x.id === taskId);
					if (!t || t.status !== 'running') return;
					t.status = 'paused';
				});
			});
	}

	dismiss(taskId: string) {
		if (this.aborts.has(taskId)) {
			this.aborts.get(taskId)?.();
		}
		runInAction(() => {
			this.tasks = this.tasks.filter((t) => t.id !== taskId);
		});
		this.aborts.delete(taskId);
		void dismissEnglishAnnotateSourceTask(taskId, { silent: true }).catch(
			() => undefined,
		);
	}

	dismissFinished() {
		runInAction(() => {
			this.tasks = this.tasks.filter(
				(t) => t.status === 'running' || t.status === 'paused',
			);
		});
		void dismissFinishedEnglishAnnotateSourceTasks({ silent: true }).catch(
			() => undefined,
		);
	}

	private openStream(task: AnnotateTask) {
		if (this.aborts.has(task.id)) return;
		const id = task.id;
		const handle = streamAnnotateClassicSource({
			source: task.source,
			libraryId: task.libraryId,
			streamId: task.streamId,
			taskId: id,
			onStart: (p) => {
				const prev = this.tasks.find((x) => x.id === id)?.progress;
				this.patchProgress(id, {
					total: p.total,
					hit: p.hit,
					miss: p.miss,
					// 续跑 hit 已含上一段写入缓存的句；annotated 本趟从 0 计
					annotated: 0,
					failed: 0,
					remaining: p.miss,
					tokensPrompt: prev?.tokensPrompt ?? 0,
					tokensCompletion: prev?.tokensCompletion ?? 0,
					tokensTotal: prev?.tokensTotal ?? 0,
				});
			},
			onProgress: (p) => this.patchProgress(id, p),
		});
		this.aborts.set(id, handle.abort);
		runInAction(() => {
			const t = this.tasks.find((x) => x.id === id);
			if (t) t.status = 'running';
		});

		void handle.done
			.then((result) => {
				runInAction(() => {
					const t = this.tasks.find((x) => x.id === id);
					if (!t || t.status !== 'running') return;
					const failed = result.failed ?? 0;
					t.progress = {
						total: result.total,
						hit: result.hit,
						miss: Math.max(0, result.total - result.hit),
						annotated: result.annotated,
						failed,
						remaining: failed > 0 ? failed : 0,
						tokensPrompt: result.tokensPrompt,
						tokensCompletion: result.tokensCompletion,
						tokensTotal: result.tokensTotal,
					};
					t.result = result;
					if (failed > 0) {
						t.status = 'error';
						t.errorMessage = undefined;
						t.finishedAt = Date.now();
						return;
					}
					t.status = 'done';
					t.errorMessage = undefined;
					t.finishedAt = Date.now();
				});
			})
			.catch((e: unknown) => {
				const aborted = (e as Error)?.name === 'AbortError';
				runInAction(() => {
					const t = this.tasks.find((x) => x.id === id);
					if (!t || t.status !== 'running') return;
					if (aborted) {
						t.status = 'paused';
						t.finishedAt = undefined;
						return;
					}
					t.status = 'error';
					t.errorMessage =
						e instanceof Error && e.message.trim()
							? e.message.trim()
							: '标注失败';
					t.finishedAt = Date.now();
				});
			})
			.finally(() => {
				this.aborts.delete(id);
			});
	}

	private patchProgress(taskId: string, progress: AnnotateSourceProgress) {
		runInAction(() => {
			const t = this.tasks.find((x) => x.id === taskId);
			if (!t || t.status !== 'running') return;
			t.progress = progress;
		});
	}
}

const EnglishAnnotateSource = new EnglishAnnotateSourceStore();
export default EnglishAnnotateSource;

export function annotateTaskPercent(task: AnnotateTask): number {
	const p = task.progress;
	if (!p || p.total <= 0) {
		return task.status === 'done' ? 100 : 0;
	}
	const done = Math.min(p.total, p.hit + p.annotated);
	const remaining = Math.max(0, p.remaining);
	const failed = Math.max(0, p.failed);
	// 还有 miss/失败时不得显示 100%（如 1439/1445 四舍五入会变 100）
	if (remaining > 0 || failed > 0 || done < p.total) {
		return Math.min(99, Math.floor((done / p.total) * 100));
	}
	return 100;
}
