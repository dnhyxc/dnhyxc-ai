import { Toast } from '@ui/index';
import { makeAutoObservable, runInAction } from 'mobx';
import type { UIEventHandler } from 'react';
import {
	deleteKnowledge,
	getKnowledgeDetail,
	getKnowledgeList,
	getKnowledgeTrashList,
	updateKnowledge,
} from '@/service';
import type {
	KnowledgeListItem,
	KnowledgeRecord,
	KnowledgeTrashListItem,
} from '@/types';
import type { SaveKnowledgeMarkdownPayload } from '@/utils/knowledge-save';
import userStore from './user';

const DEFAULT_PAGE_SIZE = 20;
/** 距底部小于该像素时触发加载下一页 */
const SCROLL_LOAD_THRESHOLD_PX = 72;

/** 知识编辑：与上次保存或从列表载入对齐的快照，用于脏检查 */
export type KnowledgePersistedSnapshot = { title: string; content: string };

/** 从 Markdown 正文推断默认标题：优先首条非空标题行，否则带时间戳的「对话摘录」 */
function deriveKnowledgeTitleFromMarkdown(markdown: string): string {
	const lines = markdown.split(/\r?\n/);
	for (const line of lines) {
		const t = line.trim();
		if (!t) continue;
		const withoutHash = t.replace(/^#{1,6}\s*/, '').trim();
		if (withoutHash) {
			return withoutHash.length > 80
				? `${withoutHash.slice(0, 80)}…`
				: withoutHash;
		}
	}
	const d = new Date();
	const pad = (n: number) => String(n).padStart(2, '0');
	return `对话摘录-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`;
}

class KnowledgeStore {
	overwriteSaveEnabledStorageKey = 'dnhyxc-ai.knowledge.overwriteSaveEnabled';
	autoSaveEnabledStorageKey = 'dnhyxc-ai.knowledge.autoSave.enabled';
	autoSaveIntervalStorageKey = 'dnhyxc-ai.knowledge.autoSave.intervalSec';
	// —— 云端列表分页 ——
	/** 当前列表（分页累积） */
	list: KnowledgeListItem[] = [];
	/** 服务端总条数 */
	total = 0;
	/** 已加载到的最后一页页码 */
	pageNo = 1;
	pageSize = DEFAULT_PAGE_SIZE;
	/** 标题模糊搜索关键字 */
	titleKeyword = '';
	loading = false;
	loadingMore = false;

	// —— 回收站列表分页 ——
	trashList: KnowledgeTrashListItem[] = [];
	trashTotal = 0;
	trashPageNo = 1;
	trashPageSize = DEFAULT_PAGE_SIZE;
	trashTitleKeyword = '';
	trashLoading = false;
	trashLoadingMore = false;

	// —— 知识页编辑器草稿（与列表同属知识域，离开路由不丢）——
	markdown = '';

	/** 知识编辑页标题（与 markdown 同存） */
	knowledgeTitle = '';

	/** 正在编辑的云端知识 id；null 表示新建草稿 */
	knowledgeEditingKnowledgeId: string | null = null;

	/** 桌面端：打开该条时的原标题，用于本地 .md 重命名 */
	knowledgeLocalDiskTitle: string | null = null;

	/**
	 * 从本地文件夹列表打开时：保存/解析冲突时使用的目录（该文件所在目录）；
	 * 云端条目为 null，沿用 TAURI_KNOWLEDGE_DIR
	 */
	knowledgeLocalDirPath: string | null = null;

	/** 上次成功保存或载入后的标题 trim + 正文 */
	knowledgePersistedSnapshot: KnowledgePersistedSnapshot = {
		title: '',
		content: '',
	};

	/** Tauri 覆盖确认弹窗：离开知识页再进入仍可继续确认 */
	knowledgeOverwriteOpen = false;

	knowledgeOverwriteTargetPath = '';

	knowledgePendingSavePayload: SaveKnowledgeMarkdownPayload | null = null;

	/**
	 * 桌面端：开启后保存遇到同名文件时不弹确认，直接覆盖保存。
	 * 仅影响本地文件写入；云端保存仍按原逻辑更新/新建。
	 */
	knowledgeOverwriteSaveEnabled = false;

	/**
	 * 知识编辑页：定时自动保存（由页面 `setInterval` 触发；默认关闭）。
	 */
	knowledgeAutoSaveEnabled = false;

	/** 自动保存间隔（秒），有效范围 5～3600，默认 30 */
	knowledgeAutoSaveIntervalSec = 30;

	constructor() {
		makeAutoObservable(this);
		// 读取本地偏好（不依赖后端；异常时保持默认 false）
		try {
			if (typeof window !== 'undefined') {
				const raw = window.localStorage.getItem(
					this.overwriteSaveEnabledStorageKey,
				);
				if (raw === '1') this.knowledgeOverwriteSaveEnabled = true;

				const autoRaw = window.localStorage.getItem(
					this.autoSaveEnabledStorageKey,
				);
				if (autoRaw === '1') this.knowledgeAutoSaveEnabled = true;

				const intervalRaw = window.localStorage.getItem(
					this.autoSaveIntervalStorageKey,
				);
				if (intervalRaw != null && intervalRaw !== '') {
					const n = Number.parseInt(intervalRaw, 10);
					if (Number.isFinite(n)) {
						this.knowledgeAutoSaveIntervalSec = Math.min(3600, Math.max(5, n));
					}
				}
			}
		} catch {
			// 忽略：隐私模式/禁用存储等场景
		}
	}

	get hasMore(): boolean {
		return this.list.length < this.total;
	}

	get trashHasMore(): boolean {
		return this.trashList.length < this.trashTotal;
	}

	setMarkdown(value: string) {
		this.markdown = value;
	}

	setKnowledgeTitle(value: string) {
		this.knowledgeTitle = value;
	}

	setKnowledgeEditingKnowledgeId(id: string | null) {
		this.knowledgeEditingKnowledgeId = id;
	}

	setKnowledgeLocalDiskTitle(value: string | null) {
		this.knowledgeLocalDiskTitle = value;
	}

	setKnowledgeLocalDirPath(value: string | null) {
		this.knowledgeLocalDirPath = value;
	}

	setKnowledgePersistedSnapshot(snapshot: KnowledgePersistedSnapshot) {
		this.knowledgePersistedSnapshot = snapshot;
	}

	/** 打开「覆盖已有文件」确认（桌面端保存冲突时） */
	openKnowledgeOverwriteConfirm(
		targetPath: string,
		payload: SaveKnowledgeMarkdownPayload,
	) {
		this.knowledgeOverwriteTargetPath = targetPath;
		this.knowledgePendingSavePayload = payload;
		this.knowledgeOverwriteOpen = true;
	}

	/** 关闭覆盖确认并清空挂起的保存入参 */
	setKnowledgeOverwriteOpen(open: boolean) {
		this.knowledgeOverwriteOpen = open;
		if (!open) {
			this.knowledgeOverwriteTargetPath = '';
			this.knowledgePendingSavePayload = null;
		}
	}

	setKnowledgeOverwriteSaveEnabled(enabled: boolean) {
		this.knowledgeOverwriteSaveEnabled = enabled;
		try {
			if (typeof window !== 'undefined') {
				window.localStorage.setItem(
					this.overwriteSaveEnabledStorageKey,
					enabled ? '1' : '0',
				);
			}
		} catch {
			// 忽略：同 constructor
		}
	}

	setKnowledgeAutoSaveEnabled(enabled: boolean) {
		this.knowledgeAutoSaveEnabled = enabled;
		try {
			if (typeof window !== 'undefined') {
				window.localStorage.setItem(
					this.autoSaveEnabledStorageKey,
					enabled ? '1' : '0',
				);
			}
		} catch {
			// 忽略：同 constructor
		}
	}

	setKnowledgeAutoSaveIntervalSec(sec: number) {
		const next = Math.min(3600, Math.max(5, Math.round(sec)));
		this.knowledgeAutoSaveIntervalSec = next;
		try {
			if (typeof window !== 'undefined') {
				window.localStorage.setItem(
					this.autoSaveIntervalStorageKey,
					String(next),
				);
			}
		} catch {
			// 忽略：同 constructor
		}
	}

	/** 清空知识草稿（标题、编辑 id、快照、正文、覆盖弹窗状态） */
	clearKnowledgeDraft() {
		this.knowledgeTitle = '';
		this.knowledgeEditingKnowledgeId = null;
		this.knowledgeLocalDiskTitle = null;
		this.knowledgeLocalDirPath = null;
		this.knowledgePersistedSnapshot = { title: '', content: '' };
		this.markdown = '';
		this.knowledgeOverwriteOpen = false;
		this.knowledgeOverwriteTargetPath = '';
		this.knowledgePendingSavePayload = null;
	}

	/**
	 * 用助手回复填充知识库草稿（新条目），不调用接口。
	 * 用于聊天页「保存到知识库」后跳转编辑。
	 */
	applyKnowledgeDraftFromChatReply(markdown: string) {
		const body = markdown.trim();
		if (!body) return;
		this.setKnowledgeOverwriteOpen(false);
		this.knowledgeEditingKnowledgeId = null;
		this.knowledgeLocalDiskTitle = null;
		this.knowledgeLocalDirPath = null;
		this.markdown = body;
		this.knowledgeTitle = deriveKnowledgeTitleFromMarkdown(body);
		this.knowledgePersistedSnapshot = { title: '', content: '' };
	}

	get getMarkdown() {
		return this.markdown;
	}

	/** 打开列表或切换搜索：从第一页重拉 */
	async refreshList(keyword?: string): Promise<void> {
		if (keyword !== undefined) {
			this.titleKeyword = keyword;
		}
		await this.fetchPage(1, false);
	}

	/** 回收站：从第一页重拉 */
	async refreshTrashList(keyword?: string): Promise<void> {
		if (keyword !== undefined) {
			this.trashTitleKeyword = keyword;
		}
		await this.fetchTrashPage(1, false);
	}

	async loadTrashMore(): Promise<void> {
		if (!this.trashHasMore || this.trashLoading || this.trashLoadingMore) {
			return;
		}
		await this.fetchTrashPage(this.trashPageNo + 1, true);
	}

	onTrashListViewportScroll: UIEventHandler<HTMLDivElement> = (e) => {
		const el = e.currentTarget;
		const rest = el.scrollHeight - el.scrollTop - el.clientHeight;
		if (rest < SCROLL_LOAD_THRESHOLD_PX) {
			void this.loadTrashMore();
		}
	};

	/** 加载下一页（滚动触底调用） */
	async loadMore(): Promise<void> {
		if (!this.hasMore || this.loading || this.loadingMore) {
			return;
		}
		await this.fetchPage(this.pageNo + 1, true);
	}

	/**
	 * 绑定到 ScrollArea Viewport 的 onScroll：接近底部时加载更多
	 */
	onListViewportScroll: UIEventHandler<HTMLDivElement> = (e) => {
		const el = e.currentTarget;
		const rest = el.scrollHeight - el.scrollTop - el.clientHeight;
		if (rest < SCROLL_LOAD_THRESHOLD_PX) {
			void this.loadMore();
		}
	};

	async fetchPage(page: number, append: boolean): Promise<void> {
		if (!userStore.userInfo.id) {
			return Toast({
				type: 'error',
				title: '请先登录',
			});
		}
		if (append) {
			this.loadingMore = true;
		} else {
			this.loading = true;
		}
		try {
			const res = await getKnowledgeList({
				pageNo: page,
				pageSize: this.pageSize,
				title: this.titleKeyword.trim() || undefined,
				authorId: userStore.userInfo.id,
			});
			if (!res.success || !res.data) {
				return;
			}
			runInAction(() => {
				const { list: chunk, total } = res.data;
				this.total = total;
				this.pageNo = page;
				if (append) {
					this.list = [...this.list, ...chunk];
				} else {
					this.list = chunk;
				}
			});
		} finally {
			runInAction(() => {
				this.loading = false;
				this.loadingMore = false;
			});
		}
	}

	async fetchTrashPage(page: number, append: boolean): Promise<void> {
		if (!userStore.userInfo.id) {
			return Toast({
				type: 'error',
				title: '请先登录',
			});
		}
		if (append) {
			this.trashLoadingMore = true;
		} else {
			this.trashLoading = true;
		}
		try {
			const res = await getKnowledgeTrashList({
				pageNo: page,
				pageSize: this.trashPageSize,
				title: this.trashTitleKeyword.trim() || undefined,
				authorId: userStore.userInfo.id,
			});
			if (!res.success || !res.data) {
				return;
			}
			runInAction(() => {
				const { list: chunk, total } = res.data;
				this.trashTotal = total;
				this.trashPageNo = page;
				if (append) {
					this.trashList = [...this.trashList, ...chunk];
				} else {
					this.trashList = chunk;
				}
			});
		} finally {
			runInAction(() => {
				this.trashLoading = false;
				this.trashLoadingMore = false;
			});
		}
	}

	removeTrashFromLocalList(ids: string[]): void {
		const s = new Set(ids);
		runInAction(() => {
			const before = this.trashList.length;
			this.trashList = this.trashList.filter((x) => !s.has(x.id));
			const removed = before - this.trashList.length;
			this.trashTotal = Math.max(0, this.trashTotal - removed);
		});
	}

	/** 拉取单条详情（含正文），用于点击列表进入编辑 */
	async fetchDetail(id: string): Promise<KnowledgeRecord | null> {
		if (!userStore.userInfo.id) {
			return null;
		}
		const res = await getKnowledgeDetail(id);
		if (!res.success || !res.data) {
			return null;
		}
		return res.data;
	}

	/**
	 * 调用 DELETE 接口删除数据库记录成功后，从本地分页列表中移除该项
	 */
	removeFromLocalList(id: string): void {
		runInAction(() => {
			this.list = this.list.filter((x) => x.id !== id);
			this.total = Math.max(0, this.total - 1);
		});
	}

	/** 删除一条：请求接口 + 同步本地列表 */
	async removeItem(id: string): Promise<boolean> {
		try {
			const res = await deleteKnowledge(id);
			if (!res.success) {
				return false;
			}
			this.removeFromLocalList(id);
			return true;
		} catch {
			return false;
		}
	}

	/** 更新远端并合并列表中的展示字段 */
	async updateItem(
		id: string,
		patch: Partial<
			Pick<KnowledgeRecord, 'title' | 'content' | 'author' | 'authorId'>
		>,
	): Promise<KnowledgeRecord | null> {
		const res = await updateKnowledge(id, patch);
		if (!res.success || !res.data) {
			return null;
		}
		const row = res.data;
		runInAction(() => {
			const i = this.list.findIndex((x) => x.id === id);
			if (i >= 0) {
				this.list[i] = {
					...this.list[i],
					title: row.title,
					author: row.author,
					authorId: row.authorId,
					updatedAt: row.updatedAt,
					createdAt: row.createdAt ?? this.list[i].createdAt,
				};
			}
		});
		return row;
	}

	/** 仅重置列表分页状态（不清空编辑器草稿） */
	reset(): void {
		this.list = [];
		this.total = 0;
		this.pageNo = 1;
		this.titleKeyword = '';
		this.loading = false;
		this.loadingMore = false;
	}
}

export default new KnowledgeStore();
