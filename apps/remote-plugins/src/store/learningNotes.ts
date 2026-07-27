import { EMPTY_NOTE_DOC } from '@design/RichEditor';
import { makeAutoObservable, runInAction } from 'mobx';
import { translateSync } from '@/i18n';
import {
	createNotesApi,
	type HostHttp,
	NOTES_PAGE_SIZE,
	type Note,
	type NotesApi,
} from '@/views/learning-notes/api';

type ToastFn = (message: string, type?: 'success' | 'error' | 'info') => void;
type TFn = (key: string, params?: Record<string, unknown>) => string;

type HostDownloadBlob = (options: {
	fileName: string;
	data: ArrayBuffer | Uint8Array;
	mimeType?: string;
}) => Promise<{ ok: boolean; hostToasted: boolean; message?: string }>;

const DOCX_MIME =
	'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

function errMsg(e: unknown, t: TFn): string {
	if (e instanceof Error && e.message) return e.message;
	if (e && typeof e === 'object' && 'message' in e) {
		const m = (e as { message?: unknown }).message;
		if (typeof m === 'string' && m.trim()) return m;
	}
	return t('common.requestFailed');
}

/**
 * 学习笔记域 store（对齐主站 MobX 单例模式）。
 * HTTP 由页面 bind(http, toast, t) 注入，列表分页与编辑态集中在此。
 */
class LearningNotesStore {
	private api: NotesApi | null = null;
	private toast: ToastFn = () => {};
	private t: TFn = translateSync;
	/** Host 透传的 downloadBlob（Web / Tauri2）；独立预览可由 mock 注入 */
	private downloadBlob: HostDownloadBlob | null = null;

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
	exportingDocx = false;

	constructor() {
		makeAutoObservable(this, {}, { autoBind: true });
	}

	bind(
		http: HostHttp | undefined,
		toast: ToastFn,
		t?: TFn,
		downloadBlob?: HostDownloadBlob,
	) {
		this.api = http ? createNotesApi(http) : null;
		this.toast = toast;
		this.downloadBlob = downloadBlob ?? null;
		if (t) this.t = t;
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
			this.toast(this.t('learningNotes.toast.httpDeniedSync'), 'error');
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
			this.toast(errMsg(e, this.t), 'error');
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
		const listHit = this.list.find((n) => n.id === id);
		// 立刻进入预览壳：卸掉编辑器，避免与即将挂载的预览双实例并存
		runInAction(() => {
			this.loadingDetail = true;
			this.preview = {
				id,
				title: listHit?.title ?? this.preview?.title ?? '',
				html: this.preview?.id === id ? this.preview.html : '',
				at: listHit?.at ?? this.preview?.at ?? Date.now(),
			};
		});
		try {
			const note = await this.api.detail(id);
			runInAction(() => {
				// 慢网下用户可能已点开另一篇
				if (this.preview?.id === id) this.preview = note;
			});
		} catch (e) {
			this.toast(errMsg(e, this.t), 'error');
			runInAction(() => {
				if (this.preview?.id === id && !this.preview.html) {
					this.preview = null;
				}
			});
		} finally {
			runInAction(() => {
				this.loadingDetail = false;
			});
		}
	}

	openEdit(note: Note) {
		this.preview = null;
		this.editingId = note.id;
		this.editorInitial = note.html || EMPTY_NOTE_DOC;
		// 预览态编辑器已卸载，重新挂载时用 editorInitial；seed 保证同 key 残留实例也被清掉
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
			this.toast(errMsg(e, this.t), 'error');
		}
	}

	/** 由页面从 editor 取出最新内容后调用 */
	async saveNote(input: {
		title: string;
		html: string;
		text: string;
	}): Promise<void> {
		if (!input.title.trim()) {
			this.toast(this.t('learningNotes.toast.needTitle'), 'info');
			return;
		}
		if (!input.text.trim()) {
			this.toast(this.t('learningNotes.toast.needContent'), 'info');
			return;
		}
		if (!this.api) {
			this.toast(this.t('learningNotes.toast.httpDeniedSave'), 'error');
			return;
		}
		this.saving = true;
		try {
			const payload = {
				title: input.title.trim() || this.t('common.untitledNote'),
				html: input.html,
			};
			if (this.editingId) {
				const updated = await this.api.update(this.editingId, payload);
				runInAction(() => {
					this.editingId = updated.id;
				});
				this.toast(this.t('learningNotes.toast.updated'), 'success');
			} else {
				const { id } = await this.api.save(payload);
				runInAction(() => {
					this.editingId = id;
				});
				this.toast(this.t('learningNotes.toast.saved'), 'success');
			}
			await this.refreshList();
		} catch (e) {
			this.toast(errMsg(e, this.t), 'error');
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

	/** 导出当前预览笔记为 DOCX（服务端生成 + Host downloadBlob 落盘） */
	async exportPreviewDocx(): Promise<void> {
		const note = this.preview;
		if (!note?.id) {
			this.toast(this.t('learningNotes.toast.exportEmpty'), 'info');
			return;
		}
		if (!this.api) {
			this.toast(this.t('learningNotes.toast.httpDeniedExport'), 'error');
			return;
		}
		if (!this.downloadBlob) {
			this.toast(this.t('learningNotes.toast.exportNoDownload'), 'error');
			return;
		}
		if (this.exportingDocx) return;
		this.exportingDocx = true;
		try {
			const buf = await this.api.exportDocx(note.id);
			const safe =
				note.title
					.replace(/[\\/:*?"<>|]+/g, '_')
					.trim()
					.slice(0, 60) || 'learning-note';
			const result = await this.downloadBlob({
				fileName: `${safe}-${Date.now()}.docx`,
				data: buf,
				mimeType: DOCX_MIME,
			});
			if (!result.ok) {
				// 对齐收藏导出：Tauri 失败时 Host 已 Toast
				if (!result.hostToasted) {
					this.toast(
						result.message || this.t('learningNotes.toast.exportFail'),
						'error',
					);
				}
				return;
			}
			// Tauri：downloadBlob 内已成功 Toast；Web：由插件提示
			if (!result.hostToasted) {
				this.toast(this.t('learningNotes.toast.exportOk'), 'success');
			}
		} catch (e) {
			this.toast(errMsg(e, this.t), 'error');
		} finally {
			runInAction(() => {
				this.exportingDocx = false;
			});
		}
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
			this.toast(this.t('learningNotes.toast.deleted'), 'success');
			await this.refreshList();
		} catch (e) {
			this.toast(errMsg(e, this.t), 'error');
			runInAction(() => {
				this.pendingDeleteId = null;
			});
		}
	}
}

export default new LearningNotesStore();
