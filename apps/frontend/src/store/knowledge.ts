import { makeAutoObservable, runInAction } from 'mobx';
import type { UIEventHandler } from 'react';
import {
	deleteKnowledge,
	getKnowledgeDetail,
	getKnowledgeList,
	updateKnowledge,
} from '@/service';
import type { KnowledgeListItem, KnowledgeRecord } from '@/types';
import type { SaveKnowledgeMarkdownPayload } from '@/utils/knowledge-save';

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

	constructor() {
		makeAutoObservable(this);
	}

	get hasMore(): boolean {
		return this.list.length < this.total;
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

	/** 拉取单条详情（含正文），用于点击列表进入编辑 */
	async fetchDetail(id: string): Promise<KnowledgeRecord | null> {
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
