import { Toast } from '@ui/index';
import { makeAutoObservable, runInAction } from 'mobx';
import type { UIEventHandler } from 'react';
import { EBOOK_SHELF_PAGE_SIZE, SCROLL_LOAD_THRESHOLD_PX } from '@/constants';
import { translateSync } from '@/i18n';
import {
	addEbookFromPath,
	findEbookByLocalPath,
	getEbookBook,
	loadEbookShelf,
	removeEbook,
	saveEbookCover,
	saveEbookProgress,
	updateEbookTitle,
	uploadEbookFile,
} from '@/service';
import { getRequestErrorMessage } from '@/utils/fetch';
import { isMembershipActiveFromUserInfo } from '@/utils/membershipActive';
import type { Book, BookFmt, Prog } from '@/views/ebook/types';
import { fileToCoverFile } from '@/views/ebook/utils/coverImage';
import { pickTauri, tauriPickedFileToUpload } from '@/views/ebook/utils/io';
import { getLoggedInUserInfoFromStorage } from './loggedInUserId';

export const EBOOK_UPLOAD_MEMBERSHIP_REQUIRED =
	'EBOOK_UPLOAD_MEMBERSHIP_REQUIRED';

function shouldUploadEbookToCos(): boolean {
	return isMembershipActiveFromUserInfo(getLoggedInUserInfoFromStorage());
}

export type EbookUploadPhase = 'reading' | 'uploading';

export type EbookUploadState = {
	phase: EbookUploadPhase;
	fileName: string;
	percent: number;
	bookId?: string;
};

class EbookStore {
	books: Book[] = [];
	/** 阅读页直链等场景下的书籍缓存（不一定在已加载分页中） */
	bookCache: Record<string, Book> = {};
	progMap: Record<string, Prog> = {};
	total = 0;
	pageNo = 1;
	pageSize = EBOOK_SHELF_PAGE_SIZE;
	ready = false;
	loading = false;
	loadingMore = false;
	busy = false;
	uploadState: EbookUploadState | null = null;

	constructor() {
		makeAutoObservable(this);
	}

	get hasMore(): boolean {
		return this.books.length < this.safeTotal();
	}

	safeTotal(): number {
		return Number.isFinite(this.total) && this.total >= 0 ? this.total : 0;
	}

	async hydrate(): Promise<void> {
		await this.fetchPage(1, false);
	}

	async fetchPage(page: number, append: boolean): Promise<void> {
		if (append) {
			this.loadingMore = true;
		} else {
			this.loading = true;
		}
		try {
			const data = await loadEbookShelf({
				pageNo: page,
				pageSize: this.pageSize,
			});
			runInAction(() => {
				const nextTotal = Number(data.total);
				this.total =
					Number.isFinite(nextTotal) && nextTotal >= 0 ? nextTotal : 0;
				this.pageNo = page;
				if (append) {
					const existingIds = new Set(this.books.map((b) => b.id));
					const merged = [...this.books];
					for (const book of data.books) {
						if (!existingIds.has(book.id)) {
							existingIds.add(book.id);
							merged.push(book);
						}
					}
					this.books = merged;
				} else {
					this.books = data.books;
					this.progMap = data.progMap ?? {};
				}
				this.ready = true;
			});
		} catch {
			runInAction(() => {
				this.ready = true;
			});
		} finally {
			runInAction(() => {
				this.loading = false;
				this.loadingMore = false;
			});
		}
	}

	async loadMore(): Promise<void> {
		if (!this.hasMore || this.loading || this.loadingMore) {
			return;
		}
		await this.fetchPage(this.pageNo + 1, true);
	}

	/** 绑定到书架 ScrollArea Viewport 的 onScroll */
	onShelfViewportScroll: UIEventHandler<HTMLDivElement> = (e) => {
		const el = e.currentTarget;
		const rest = el.scrollHeight - el.scrollTop - el.clientHeight;
		if (rest < SCROLL_LOAD_THRESHOLD_PX) {
			void this.loadMore();
		}
	};

	async fetchBookIfMissing(bookId: string): Promise<Book | undefined> {
		const hit = this.bookById(bookId);
		if (hit) return hit;
		try {
			const { book, prog } = await getEbookBook(bookId);
			runInAction(() => {
				this.bookCache[book.id] = book;
				if (prog) {
					this.progMap[book.id] = prog;
				}
			});
			return book;
		} catch {
			return undefined;
		}
	}

	progOf(bookId: string): Prog | undefined {
		return this.progMap[bookId];
	}

	clearUploadState(): void {
		this.uploadState = null;
		this.busy = false;
	}

	/** 切换账号 / 登出：清空书架缓存，下次进入重新拉取当前用户数据 */
	resetOnUserSwitch(): void {
		this.books = [];
		this.bookCache = {};
		this.progMap = {};
		this.total = 0;
		this.pageNo = 1;
		this.ready = false;
		this.loading = false;
		this.loadingMore = false;
		this.clearUploadState();
	}

	async addFromTauri(): Promise<Book | null> {
		const picked = await pickTauri();
		if (!picked) return null;

		const fileName = picked.path.split(/[/\\]/).pop() ?? `book.${picked.fmt}`;
		const uploadToCos = shouldUploadEbookToCos();
		const existingByPath = uploadToCos
			? await findEbookByLocalPath(picked.path)
			: null;

		const book =
			existingByPath ?? (await addEbookFromPath(picked.path, picked.fmt));

		runInAction(() => {
			const existed = this.books.some((b) => b.id === book.id);
			this.books = [book, ...this.books.filter((b) => b.id !== book.id)];
			if (!existed) {
				this.total = this.safeTotal() + 1;
			}
			this.bookCache[book.id] = book;
		});

		if (existingByPath) {
			Toast({
				type: 'info',
				title: translateSync('ebook.shelf.alreadyImportedTitle'),
				message: translateSync('ebook.shelf.alreadyImportedMessage'),
			});
			return book;
		}

		if (uploadToCos) {
			runInAction(() => {
				this.busy = true;
				this.uploadState = {
					phase: 'reading',
					fileName,
					percent: 0,
					bookId: book.id,
				};
			});
			void uploadBookToCloud(this, book.id, picked.path, picked.fmt);
		}

		return book;
	}

	async addFromFile(file: File): Promise<Book> {
		if (!shouldUploadEbookToCos()) {
			throw new Error(EBOOK_UPLOAD_MEMBERSHIP_REQUIRED);
		}

		runInAction(() => {
			this.busy = true;
			this.uploadState = {
				phase: 'uploading',
				fileName: file.name,
				percent: this.uploadState?.percent ?? 0,
			};
		});

		try {
			const book = await uploadEbookFile(file, {
				onProgress: (percent) => {
					runInAction(() => {
						if (this.uploadState) {
							this.uploadState.phase = 'uploading';
							this.uploadState.percent = percent;
						}
					});
				},
			});
			runInAction(() => {
				const existed = this.books.some((b) => b.id === book.id);
				this.books = [book, ...this.books.filter((b) => b.id !== book.id)];
				if (!existed) {
					this.total = this.safeTotal() + 1;
				}
				this.bookCache[book.id] = book;
				this.clearUploadState();
			});
			return book;
		} catch (e) {
			runInAction(() => this.clearUploadState());
			throw e;
		}
	}

	async remove(bookId: string): Promise<void> {
		await removeEbook(bookId);
		runInAction(() => {
			this.books = this.books.filter((b) => b.id !== bookId);
			delete this.bookCache[bookId];
			delete this.progMap[bookId];
			this.total = Math.max(0, this.safeTotal() - 1);
		});
	}

	async setCover(bookId: string, file: File): Promise<void> {
		const coverFile = await fileToCoverFile(file);
		const updated = await saveEbookCover(bookId, coverFile);
		runInAction(() => {
			this.books = this.books.map((b) => (b.id === bookId ? updated : b));
			this.bookCache[bookId] = updated;
		});
	}

	async updateTitle(bookId: string, title: string): Promise<void> {
		const updated = await updateEbookTitle(bookId, title);
		runInAction(() => {
			this.books = this.books.map((b) => (b.id === bookId ? updated : b));
			this.bookCache[bookId] = updated;
		});
	}

	saveProg(patch: Omit<Prog, 'updatedAt'>): void {
		const prev = this.progMap[patch.bookId];
		const next: Prog = {
			bookId: patch.bookId,
			updatedAt: new Date().toISOString(),
			epubCfi: patch.epubCfi ?? prev?.epubCfi,
			pdfPage: patch.pdfPage ?? prev?.pdfPage,
			percent: patch.percent !== undefined ? patch.percent : prev?.percent,
		};
		runInAction(() => {
			this.progMap[patch.bookId] = next;
		});
		void saveEbookProgress(next);
	}

	bookById(id: string): Book | undefined {
		return this.books.find((b) => b.id === id) ?? this.bookCache[id];
	}
}

const ebookStore = new EbookStore();

async function uploadBookToCloud(
	store: EbookStore,
	bookId: string,
	path: string,
	fmt: BookFmt,
): Promise<void> {
	try {
		const file = await tauriPickedFileToUpload(path, fmt);
		runInAction(() => {
			if (store.uploadState?.bookId === bookId) {
				store.uploadState.phase = 'uploading';
				store.uploadState.percent = 0;
			}
		});

		const updated = await uploadEbookFile(file, {
			bookId,
			onProgress: (percent) => {
				runInAction(() => {
					if (store.uploadState?.bookId === bookId) {
						store.uploadState.phase = 'uploading';
						store.uploadState.percent = percent;
					}
				});
			},
		});

		runInAction(() => {
			store.books = store.books.map((b) => (b.id === bookId ? updated : b));
			store.bookCache[bookId] = updated;
			if (store.uploadState?.bookId === bookId) {
				store.clearUploadState();
			}
		});
	} catch (err) {
		runInAction(() => {
			if (store.uploadState?.bookId === bookId) {
				store.clearUploadState();
			}
		});
		const reason = getRequestErrorMessage(err);
		Toast({
			type: 'warning',
			title: '云端备份失败',
			message: `${reason}。已加载本地书籍，可以继续阅读`,
		});
	}
}

export default ebookStore;
