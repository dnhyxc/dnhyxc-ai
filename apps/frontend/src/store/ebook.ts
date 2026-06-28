import { Toast } from '@ui/index';
import { makeAutoObservable, runInAction } from 'mobx';
import type { UIEventHandler } from 'react';
import { EBOOK_SHELF_PAGE_SIZE, SCROLL_LOAD_THRESHOLD_PX } from '@/constants';
import { translateSync } from '@/i18n';
import {
	addEbookFromPath,
	assignEbookBookCategory,
	createEbookCategory,
	findEbookByLocalPath,
	getEbookBook,
	loadEbookCategoriesSummary,
	loadEbookShelf,
	removeEbook,
	removeEbookCategory,
	reorderEbookCategories,
	saveEbookCover,
	saveEbookProgress,
	updateEbookCategory,
	updateEbookTitle,
	uploadEbookFile,
} from '@/service';
import { getRequestErrorMessage } from '@/utils/fetch';
import { isMembershipActiveFromUserInfo } from '@/utils/membershipActive';
import type {
	Book,
	BookFmt,
	EbookCategory,
	EbookShelfCategoryKey,
	Prog,
} from '@/views/ebook/types';
import { fileToCoverFile } from '@/views/ebook/utils/common/coverImage';
import {
	pickTauri,
	tauriPickedFileToUpload,
} from '@/views/ebook/utils/common/io';
import { getLoggedInUserInfoFromStorage } from './loggedInUserId';

export const EBOOK_UPLOAD_MEMBERSHIP_REQUIRED =
	'EBOOK_UPLOAD_MEMBERSHIP_REQUIRED';

function shouldUploadEbookToCos(): boolean {
	return isMembershipActiveFromUserInfo(getLoggedInUserInfoFromStorage());
}

function loggedInUserId(): number {
	return Number(getLoggedInUserInfoFromStorage()?.id) || 0;
}

function lastCategoryStorageKey(userId: number): string {
	return `dnhyxc_ebook_last_category_v1:${userId}`;
}

function readLastImportCategoryId(userId: number): string | null {
	if (userId <= 0) return null;
	try {
		return localStorage.getItem(lastCategoryStorageKey(userId));
	} catch {
		return null;
	}
}

function writeLastImportCategoryId(
	userId: number,
	categoryId: string | null,
): void {
	if (userId <= 0) return;
	try {
		if (categoryId) {
			localStorage.setItem(lastCategoryStorageKey(userId), categoryId);
		} else {
			localStorage.removeItem(lastCategoryStorageKey(userId));
		}
	} catch {
		// ignore
	}
}

function shelfQueryFromKey(key: EbookShelfCategoryKey): {
	categoryId?: string;
	uncategorizedOnly?: boolean;
} {
	if (key.kind === 'category') {
		return { categoryId: key.categoryId };
	}
	if (key.kind === 'uncategorized') {
		return { uncategorizedOnly: true };
	}
	return {};
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

	categories: EbookCategory[] = [];
	uncategorizedCount = 0;
	totalBookCount = 0;
	activeCategoryKey: EbookShelfCategoryKey = { kind: 'all' };
	categoriesLoading = false;

	shelfFetchSeq = 0;

	constructor() {
		makeAutoObservable(this);
	}

	get hasMore(): boolean {
		return this.books.length < this.safeTotal();
	}

	safeTotal(): number {
		return Number.isFinite(this.total) && this.total >= 0 ? this.total : 0;
	}

	bookMatchesActiveCategory(categoryId?: string | null): boolean {
		const key = this.activeCategoryKey;
		if (key.kind === 'all') return true;
		if (key.kind === 'uncategorized') {
			return categoryId == null;
		}
		return categoryId === key.categoryId;
	}

	resolveImportCategoryId(): string | undefined {
		const key = this.activeCategoryKey;
		if (key.kind === 'category') {
			return key.categoryId;
		}
		const userId = loggedInUserId();
		const last = readLastImportCategoryId(userId);
		if (last && this.categories.some((c) => c.id === last)) {
			return last;
		}
		return undefined;
	}

	async hydrate(): Promise<void> {
		await Promise.all([this.fetchCategories(), this.fetchPage(1, false)]);
	}

	async fetchCategories(): Promise<void> {
		this.categoriesLoading = true;
		try {
			const data = await loadEbookCategoriesSummary();
			runInAction(() => {
				this.categories = data.categories;
				this.uncategorizedCount = data.uncategorizedCount;
				this.totalBookCount = data.totalBookCount;
			});
		} catch {
			// 分类加载失败不阻塞书架
		} finally {
			runInAction(() => {
				this.categoriesLoading = false;
			});
		}
	}

	setActiveCategoryKey(key: EbookShelfCategoryKey): void {
		this.activeCategoryKey = key;
		if (key.kind === 'category') {
			writeLastImportCategoryId(loggedInUserId(), key.categoryId);
		}
		void this.fetchPage(1, false);
	}

	async fetchPage(page: number, append: boolean): Promise<void> {
		const seq = ++this.shelfFetchSeq;
		if (append) {
			this.loadingMore = true;
		} else {
			this.loading = true;
		}
		try {
			const data = await loadEbookShelf({
				pageNo: page,
				pageSize: this.pageSize,
				...shelfQueryFromKey(this.activeCategoryKey),
			});
			if (seq !== this.shelfFetchSeq) return;
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
			if (seq !== this.shelfFetchSeq) return;
			runInAction(() => {
				this.ready = true;
			});
		} finally {
			if (seq === this.shelfFetchSeq) {
				runInAction(() => {
					this.loading = false;
					this.loadingMore = false;
				});
			}
		}
	}

	async loadMore(): Promise<void> {
		if (!this.hasMore || this.loading || this.loadingMore) {
			return;
		}
		await this.fetchPage(this.pageNo + 1, true);
	}

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

	resetOnUserSwitch(): void {
		this.books = [];
		this.bookCache = {};
		this.progMap = {};
		this.total = 0;
		this.pageNo = 1;
		this.ready = false;
		this.loading = false;
		this.loadingMore = false;
		this.categories = [];
		this.uncategorizedCount = 0;
		this.totalBookCount = 0;
		this.activeCategoryKey = { kind: 'all' };
		this.clearUploadState();
	}

	mergeBookIntoShelf(book: Book, isNew: boolean): void {
		this.bookCache[book.id] = book;
		if (!this.bookMatchesActiveCategory(book.categoryId)) {
			return;
		}
		const existed = this.books.some((b) => b.id === book.id);
		this.books = [book, ...this.books.filter((b) => b.id !== book.id)];
		if (!existed && isNew) {
			this.total = this.safeTotal() + 1;
		}
	}

	async createCategory(name: string): Promise<EbookCategory> {
		const created = await createEbookCategory(name);
		await this.fetchCategories();
		return created;
	}

	async renameCategory(id: string, name: string): Promise<void> {
		await updateEbookCategory(id, { name });
		await this.fetchCategories();
	}

	async deleteCategory(id: string): Promise<void> {
		await removeEbookCategory(id);
		runInAction(() => {
			if (
				this.activeCategoryKey.kind === 'category' &&
				this.activeCategoryKey.categoryId === id
			) {
				this.activeCategoryKey = { kind: 'all' };
			}
			const clearCat = (b: Book): Book =>
				b.categoryId === id ? { ...b, categoryId: null } : b;
			this.books = this.books.map(clearCat);
			for (const bookId of Object.keys(this.bookCache)) {
				const hit = this.bookCache[bookId];
				if (hit?.categoryId === id) {
					this.bookCache[bookId] = clearCat(hit);
				}
			}
		});
		await Promise.all([this.fetchCategories(), this.fetchPage(1, false)]);
	}

	async moveCategory(id: string, direction: 'up' | 'down'): Promise<void> {
		const idx = this.categories.findIndex((c) => c.id === id);
		if (idx < 0) return;
		const swapWith = direction === 'up' ? idx - 1 : idx + 1;
		if (swapWith < 0 || swapWith >= this.categories.length) return;
		const ordered = [...this.categories];
		const tmp = ordered[idx];
		ordered[idx] = ordered[swapWith];
		ordered[swapWith] = tmp;
		await reorderEbookCategories(ordered.map((c) => c.id));
		await this.fetchCategories();
	}

	async assignBookCategory(
		bookId: string,
		categoryId: string | null,
	): Promise<void> {
		const updated = await assignEbookBookCategory(bookId, categoryId);
		runInAction(() => {
			const stays = this.bookMatchesActiveCategory(updated.categoryId);
			if (stays) {
				this.books = this.books.map((b) => (b.id === bookId ? updated : b));
			} else {
				const had = this.books.some((b) => b.id === bookId);
				this.books = this.books.filter((b) => b.id !== bookId);
				if (had) {
					this.total = Math.max(0, this.safeTotal() - 1);
				}
			}
			this.bookCache[bookId] = updated;
		});
		void this.fetchCategories();
	}

	async addFromTauri(): Promise<Book | null> {
		const picked = await pickTauri();
		if (!picked) return null;

		const fileName = picked.path.split(/[/\\]/).pop() ?? `book.${picked.fmt}`;
		const uploadToCos = shouldUploadEbookToCos();
		const existingByPath = uploadToCos
			? await findEbookByLocalPath(picked.path)
			: null;
		const importCategoryId = this.resolveImportCategoryId();

		const book =
			existingByPath ??
			(await addEbookFromPath(
				picked.path,
				picked.fmt,
				undefined,
				importCategoryId,
			));

		runInAction(() => {
			const isNew = !existingByPath;
			this.mergeBookIntoShelf(book, isNew);
		});

		if (existingByPath) {
			Toast({
				type: 'info',
				title: translateSync('ebook.shelf.alreadyImportedTitle'),
				message: translateSync('ebook.shelf.alreadyImportedMessage'),
			});
			return book;
		}

		void this.fetchCategories();

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

		const importCategoryId = this.resolveImportCategoryId();

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
				categoryId: importCategoryId,
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
				this.mergeBookIntoShelf(book, !existed);
				this.clearUploadState();
			});
			void this.fetchCategories();
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
		void this.fetchCategories();
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
