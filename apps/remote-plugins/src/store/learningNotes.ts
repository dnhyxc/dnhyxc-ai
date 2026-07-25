import { EMPTY_NOTE_DOC } from '@design/RichEditor';
import { makeAutoObservable, runInAction } from 'mobx';
import {
	createNotesApi,
	type HostHttp,
	NOTES_PAGE_SIZE,
	type Note,
	type NotesApi,
} from '@/views/learning-notes/api';

type ToastFn = (message: string, type?: 'success' | 'error' | 'info') => void;

function errMsg(e: unknown): string {
	if (e instanceof Error && e.message) return e.message;
	if (e && typeof e === 'object' && 'message' in e) {
		const m = (e as { message?: unknown }).message;
		if (typeof m === 'string' && m.trim()) return m;
	}
	return '请求失败';
}

/**
 * 学习笔记域 store（对齐主站 MobX 单例模式）。
 * HTTP 由页面 bind(http, toast) 注入，列表分页与编辑态集中在此。
 */
class LearningNotesStore {
	private api: NotesApi | null = null;
	private toast: ToastFn = () => {};

	/** 列表（分页累积） */
	list: Note[] = [];
	total = 0;
	pageNo = 1;
	pageSize = NOTES_PAGE_SIZE;
	loading = false;
	loadingMore = false;

	listOpen = false;
	preview: Note | null = null;
	loadingDetail = false;
	editingId: string | null = null;
	editorSeed = 0;
	editorInitial: string | typeof EMPTY_NOTE_DOC = EMPTY_NOTE_DOC;
	saving = false;
	confirmOpen = false;
	pendingDeleteId: string | null = null;

	constructor() {
		makeAutoObservable(this, {}, { autoBind: true });
	}

	bind(http: HostHttp | undefined, toast: ToastFn) {
		this.api = http ? createNotesApi(http) : null;
		this.toast = toast;
	}

	get hasMore(): boolean {
		return this.list.length < this.total;
	}

	get hasActive(): boolean {
		return !!(this.preview?.id ?? this.editingId);
	}

	setListOpen(open: boolean) {
		this.listOpen = open;
	}

	toggleListOpen() {
		this.listOpen = !this.listOpen;
	}

	setConfirmOpen(open: boolean) {
		this.confirmOpen = open;
	}

	setLoadingDetail(loading: boolean) {
		this.loadingDetail = loading;
	}

	async fetchPage(page: number, append: boolean): Promise<void> {
		if (!this.api) {
			this.toast('未授权 HTTP，无法同步笔记', 'error');
			return;
		}
		if (append) {
			if (this.loading || this.loadingMore || !this.hasMore) return;
			this.loadingMore = true;
		} else {
			this.loading = true;
		}
		try {
			const data = await this.api.list(page, this.pageSize);
			runInAction(() => {
				this.total = data.total;
				this.pageNo = page;
				if (append) {
					const seen = new Set(this.list.map((n) => n.id));
					this.list = [
						...this.list,
						...data.list.filter((n) => !seen.has(n.id)),
					];
				} else {
					this.list = data.list;
				}
			});
		} catch (e) {
			this.toast(errMsg(e), 'error');
		} finally {
			runInAction(() => {
				this.loading = false;
				this.loadingMore = false;
			});
		}
	}

	async refreshList(): Promise<void> {
		await this.fetchPage(1, false);
	}

	async loadMore(): Promise<void> {
		if (!this.hasMore || this.loading || this.loadingMore) return;
		await this.fetchPage(this.pageNo + 1, true);
	}

	openNew() {
		this.preview = null;
		this.editingId = null;
		this.editorInitial = EMPTY_NOTE_DOC;
		this.editorSeed += 1;
	}

	async openPreview(id: string): Promise<void> {
		if (!this.api) return;
		try {
			this.loadingDetail = true;
			const note = await this.api.detail(id);
			this.loadingDetail = false;
			runInAction(() => {
				this.preview = note;
			});
		} catch (e) {
			this.toast(errMsg(e), 'error');
			this.loadingDetail = false;
		}
	}

	openEdit(note: Note) {
		this.preview = null;
		this.editingId = note.id;
		this.editorInitial = note.html || EMPTY_NOTE_DOC;
		this.editorSeed += 1;
	}

	async openEditById(id: string): Promise<void> {
		if (!this.api) return;
		try {
			const note = await this.api.detail(id);
			runInAction(() => {
				this.openEdit(note);
			});
		} catch (e) {
			this.toast(errMsg(e), 'error');
		}
	}

	/** 由页面从 editor 取出最新内容后调用 */
	async saveNote(input: {
		title: string;
		html: string;
		text: string;
	}): Promise<void> {
		if (!input.title.trim()) {
			this.toast('请先输入标题', 'info');
			return;
		}
		if (!input.text.trim()) {
			this.toast('请先输入内容', 'info');
			return;
		}
		if (!this.api) {
			this.toast('未授权 HTTP，无法保存', 'error');
			return;
		}
		this.saving = true;
		try {
			const payload = {
				title: input.title.trim() || '无标题笔记',
				html: input.html,
			};
			if (this.editingId) {
				const updated = await this.api.update(this.editingId, payload);
				runInAction(() => {
					this.editingId = updated.id;
				});
				this.toast('已更新笔记', 'success');
			} else {
				const { id } = await this.api.save(payload);
				runInAction(() => {
					this.editingId = id;
				});
				this.toast('已保存笔记', 'success');
			}
			await this.refreshList();
		} catch (e) {
			this.toast(errMsg(e), 'error');
		} finally {
			runInAction(() => {
				this.saving = false;
			});
		}
	}

	requestDelete(id: string) {
		this.pendingDeleteId = id;
		this.confirmOpen = true;
	}

	async confirmDelete(): Promise<void> {
		const id = this.pendingDeleteId;
		if (!this.api || !id) return;
		try {
			await this.api.remove(id);
			runInAction(() => {
				if (this.preview?.id === id) this.preview = null;
				if (this.editingId === id) {
					this.editingId = null;
					this.editorInitial = EMPTY_NOTE_DOC;
					this.editorSeed += 1;
				}
				this.pendingDeleteId = null;
			});
			this.toast('已删除', 'success');
			await this.refreshList();
		} catch (e) {
			this.toast(errMsg(e), 'error');
			runInAction(() => {
				this.pendingDeleteId = null;
			});
		}
	}
}

export default new LearningNotesStore();
