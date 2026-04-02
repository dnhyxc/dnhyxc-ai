import { makeAutoObservable, runInAction } from 'mobx';
import type { UIEventHandler } from 'react';
import {
	deleteKnowledge,
	getKnowledgeDetail,
	getKnowledgeList,
	updateKnowledge,
} from '@/service';
import type { KnowledgeListItem, KnowledgeRecord } from '@/types';

const DEFAULT_PAGE_SIZE = 20;
/** 距底部小于该像素时触发加载下一页 */
const SCROLL_LOAD_THRESHOLD_PX = 72;

class KnowledgeStore {
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

	constructor() {
		makeAutoObservable(this);
	}

	get hasMore(): boolean {
		return this.list.length < this.total;
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
