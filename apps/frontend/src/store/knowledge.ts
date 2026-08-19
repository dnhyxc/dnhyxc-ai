import { Toast } from '@ui/index';
import { makeAutoObservable, runInAction } from 'mobx';
import type { UIEventHandler } from 'react';
import { DEFAULT_PAGE_SIZE, SCROLL_LOAD_THRESHOLD_PX } from '@/constants';
import {
	assignKnowledgeItemCategory,
	createKnowledgeCategory,
	deleteKnowledge,
	getKnowledgeDetail,
	getKnowledgeList,
	getKnowledgeTrashList,
	loadKnowledgeCategoriesSummary,
	removeKnowledgeCategory,
	reorderKnowledgeCategories,
	setKnowledgeVisibility,
	updateKnowledge,
	updateKnowledgeCategory,
} from '@/service';
import type {
	KnowledgeCategory,
	KnowledgeCategoryKey,
	KnowledgeListItem,
	KnowledgeRecord,
	KnowledgeTrashListItem,
} from '@/types';
import type { SaveKnowledgeMarkdownPayload } from '@/utils/knowledge-save';
import { getLoggedInUserId } from './loggedInUserId';

function listQueryFromKey(key: KnowledgeCategoryKey): {
	scope?: 'all' | 'public';
	categoryId?: string;
	uncategorizedOnly?: boolean;
} {
	if (key.kind === 'public') return { scope: 'public' };
	if (key.kind === 'category') return { categoryId: key.categoryId };
	if (key.kind === 'uncategorized') return { uncategorizedOnly: true };
	return { scope: 'all' };
}

/** 公开文档优先，组内保持原相对顺序（稳定排序） */
function sortKnowledgeByPublic(list: KnowledgeListItem[]): KnowledgeListItem[] {
	return [...list].sort((a, b) => {
		const aPublic = a.isPublic ? 1 : 0;
		const bPublic = b.isPublic ? 1 : 0;
		return bPublic - aPublic;
	});
}

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

/** ponytail: O(n) trim/比较；长文编辑时由派生字段让 UI 只订阅 boolean */
function syncKnowledgeDraftDerivedFlags(store: KnowledgeStore) {
	store.markdownNonempty = store.markdown.trim().length > 0;
	store.isDraftDirty =
		store.knowledgeTitle.trim() !== store.knowledgePersistedSnapshot.title ||
		store.markdown !== store.knowledgePersistedSnapshot.content;
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
	categories: KnowledgeCategory[] = [];
	uncategorizedCount = 0;
	totalItemCount = 0;
	publicItemTotal = 0;
	activeCategoryKey: KnowledgeCategoryKey = { kind: 'all' };

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

	/** trim 后是否有正文；仅 emptiness 变化时更新，供助手等避免订阅全文 */
	markdownNonempty = false;

	/** 标题或正文相对 persisted 快照是否有未保存变更 */
	isDraftDirty = false;

	/** 知识编辑页标题（与 markdown 同存） */
	knowledgeTitle = '';

	/** 正在编辑的云端知识 id；null 表示新建草稿 */
	knowledgeEditingKnowledgeId: string | null = null;

	/**
	 * 从回收站仅预览打开时：回收站行 id（与云端知识 id 不同），用于助手按「预览条目」隔离会话；
	 * 从列表打开正式条目或非回收站场景时应为 null。
	 */
	knowledgeTrashPreviewId: string | null = null;

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
		return this.list.length < this.safeTotal();
	}

	/** 「全部」Tab 角标：我的文档 + 他人公开 */
	get listAllCount(): number {
		return this.totalItemCount + this.publicItemTotal;
	}

	safeTotal(): number {
		return Number.isFinite(this.total) && this.total >= 0 ? this.total : 0;
	}

	get trashHasMore(): boolean {
		return this.trashList.length < this.trashTotal;
	}

	setMarkdown(value: string) {
		this.markdown = value;
		syncKnowledgeDraftDerivedFlags(this);
	}

	setKnowledgeTitle(value: string) {
		this.knowledgeTitle = value;
		syncKnowledgeDraftDerivedFlags(this);
	}

	setKnowledgeEditingKnowledgeId(id: string | null) {
		this.knowledgeEditingKnowledgeId = id;
		// 已绑定正式/本地知识条目时，退出回收站预览态，避免助手仍按回收站 key 存会话
		if (id != null && id !== '') {
			this.knowledgeTrashPreviewId = null;
		}
	}

	setKnowledgeTrashPreviewId(id: string | null) {
		this.knowledgeTrashPreviewId = id;
	}

	setKnowledgeLocalDiskTitle(value: string | null) {
		this.knowledgeLocalDiskTitle = value;
	}

	setKnowledgeLocalDirPath(value: string | null) {
		this.knowledgeLocalDirPath = value;
	}

	setKnowledgePersistedSnapshot(snapshot: KnowledgePersistedSnapshot) {
		this.knowledgePersistedSnapshot = snapshot;
		syncKnowledgeDraftDerivedFlags(this);
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
		this.knowledgeTrashPreviewId = null;
		this.knowledgeLocalDiskTitle = null;
		this.knowledgeLocalDirPath = null;
		this.knowledgePersistedSnapshot = { title: '', content: '' };
		this.markdown = '';
		syncKnowledgeDraftDerivedFlags(this);
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
		this.knowledgeTrashPreviewId = null;
		this.knowledgeLocalDiskTitle = null;
		this.knowledgeLocalDirPath = null;
		this.markdown = body;
		this.knowledgeTitle = deriveKnowledgeTitleFromMarkdown(body);
		this.knowledgePersistedSnapshot = { title: '', content: '' };
		syncKnowledgeDraftDerivedFlags(this);
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
		if (!getLoggedInUserId()) {
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
			// 列表可见范围由后端按 JWT：本人 OR 公开
			const res = await getKnowledgeList({
				pageNo: page,
				pageSize: this.pageSize,
				title: this.titleKeyword.trim() || undefined,
				...listQueryFromKey(this.activeCategoryKey),
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

	/** 所有者设置公开/私有，并同步本地列表项 */
	async setItemVisibility(id: string, isPublic: boolean): Promise<boolean> {
		if (!getLoggedInUserId()) {
			Toast({ type: 'error', title: '请先登录' });
			return false;
		}
		const res = await setKnowledgeVisibility(id, isPublic);
		if (!res.success || !res.data) {
			return false;
		}
		const updated = res.data;
		runInAction(() => {
			const next = this.list.map((item) =>
				item.id === updated.id
					? {
							...item,
							isPublic: updated.isPublic,
							isOwned: updated.isOwned ?? true,
							categoryId: updated.categoryId ?? item.categoryId,
						}
					: item,
			);
			this.list = sortKnowledgeByPublic(next);
		});
		return true;
	}

	async fetchCategories(): Promise<void> {
		try {
			const data = await loadKnowledgeCategoriesSummary();
			runInAction(() => {
				this.categories = data.categories;
				this.uncategorizedCount = data.uncategorizedCount;
				this.totalItemCount = data.totalItemCount;
			});
		} catch {
			// 分类加载失败不阻塞列表
		}
	}

	async fetchPublicCount(): Promise<void> {
		if (!getLoggedInUserId()) return;
		try {
			const res = await getKnowledgeList({
				scope: 'public',
				pageNo: 1,
				pageSize: 1,
			});
			if (!res.success || !res.data) return;
			runInAction(() => {
				const nextTotal = Number(res.data.total);
				this.publicItemTotal =
					Number.isFinite(nextTotal) && nextTotal >= 0 ? nextTotal : 0;
			});
		} catch {
			// 公开数量加载失败不阻塞列表
		}
	}

	setActiveCategoryKey(key: KnowledgeCategoryKey): void {
		this.activeCategoryKey = key;
		void this.refreshList();
	}

	itemMatchesActiveCategory(
		item: Pick<KnowledgeListItem, 'categoryId' | 'isPublic' | 'isOwned'>,
	): boolean {
		const key = this.activeCategoryKey;
		if (key.kind === 'public') {
			return item.isPublic === true && item.isOwned === false;
		}
		if (key.kind === 'all') return true;
		if (key.kind === 'uncategorized') return item.categoryId == null;
		return item.categoryId === key.categoryId;
	}

	resetActiveCategoryIfEmpty(): void {
		if (this.activeCategoryKey.kind === 'all') return;
		if (this.list.length > 0 || this.total > 0) return;
		this.activeCategoryKey = { kind: 'all' };
		void this.refreshList();
	}

	async createCategory(name: string): Promise<KnowledgeCategory> {
		const created = await createKnowledgeCategory(name);
		await this.fetchCategories();
		return created;
	}

	async renameCategory(id: string, name: string): Promise<void> {
		await updateKnowledgeCategory(id, { name });
		await this.fetchCategories();
	}

	async deleteCategory(id: string): Promise<void> {
		await removeKnowledgeCategory(id);
		runInAction(() => {
			if (
				this.activeCategoryKey.kind === 'category' &&
				this.activeCategoryKey.categoryId === id
			) {
				this.activeCategoryKey = { kind: 'all' };
			}
			this.list = this.list.map((item) =>
				item.categoryId === id ? { ...item, categoryId: null } : item,
			);
		});
		await Promise.all([this.fetchCategories(), this.fetchPage(1, false)]);
	}

	async moveCategory(id: string, direction: 'up' | 'down'): Promise<void> {
		const idx = this.categories.findIndex((c) => c.id === id);
		if (idx < 0) return;
		const swapWith = direction === 'up' ? idx - 1 : idx + 1;
		if (swapWith < 0 || swapWith >= this.categories.length) return;
		const ordered = [...this.categories];
		const tmp = ordered[idx]!;
		ordered[idx] = ordered[swapWith]!;
		ordered[swapWith] = tmp;
		await reorderKnowledgeCategories(ordered.map((c) => c.id));
		await this.fetchCategories();
	}

	async assignItemCategory(
		id: string,
		categoryId: string | null,
	): Promise<void> {
		const current = this.list.find((item) => item.id === id);
		if (current && current.isOwned === false) return;
		const updated = await assignKnowledgeItemCategory(id, categoryId);
		runInAction(() => {
			const stays = this.itemMatchesActiveCategory(updated);
			if (stays) {
				this.list = this.list.map((item) =>
					item.id === id ? { ...item, ...updated } : item,
				);
			} else {
				const had = this.list.some((item) => item.id === id);
				this.list = this.list.filter((item) => item.id !== id);
				if (had) this.total = Math.max(0, this.total - 1);
			}
			this.resetActiveCategoryIfEmpty();
		});
		void this.fetchCategories();
	}

	async fetchTrashPage(page: number, append: boolean): Promise<void> {
		const authorId = getLoggedInUserId();
		if (!authorId) {
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
				authorId,
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
		if (!getLoggedInUserId()) {
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
		this.resetActiveCategoryIfEmpty();
		void this.fetchCategories();
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
		this.categories = [];
		this.uncategorizedCount = 0;
		this.totalItemCount = 0;
		this.publicItemTotal = 0;
		this.activeCategoryKey = { kind: 'all' };
	}

	/** 切换账号：清空编辑器草稿与列表/回收站缓存 */
	resetOnUserSwitch(): void {
		this.clearKnowledgeDraft();
		this.reset();
		this.trashList = [];
		this.trashTotal = 0;
		this.trashPageNo = 1;
		this.trashTitleKeyword = '';
		this.trashLoading = false;
		this.trashLoadingMore = false;
	}
}

export default new KnowledgeStore();
