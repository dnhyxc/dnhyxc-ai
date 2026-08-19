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
	openEbookPublicBook,
	removeEbook,
	removeEbookCategory,
	reorderEbookCategories,
	saveEbookCover,
	saveEbookProgress,
	saveEbookProgressKeepalive,
	setEbookBookVisibility,
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
	EbookPublicSource,
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
	scope?: 'mine' | 'public';
	categoryId?: string;
	uncategorizedOnly?: boolean;
} {
	if (key.kind === 'public') {
		return { scope: 'public' };
	}
	if (key.kind === 'category') {
		return { categoryId: key.categoryId };
	}
	if (key.kind === 'uncategorized') {
		return { uncategorizedOnly: true };
	}
	return {};
}

function bookLastReadMs(book: Book, progMap: Record<string, Prog>): number {
	const prog =
		progMap[book.id] ??
		(book.readingBookId ? progMap[book.readingBookId] : undefined);
	if (prog?.updatedAt) {
		const readAt = Date.parse(prog.updatedAt);
		if (Number.isFinite(readAt)) return readAt;
	}
	const addedAt = Date.parse(book.addedAt);
	return Number.isFinite(addedAt) ? addedAt : 0;
}

/** 最近阅读优先，同阅读时间时公开书靠前 */
function sortBooksByLastRead(
	books: Book[],
	progMap: Record<string, Prog>,
): Book[] {
	return [...books].sort((a, b) => {
		const byRead = bookLastReadMs(b, progMap) - bookLastReadMs(a, progMap);
		if (byRead !== 0) return byRead;
		const aPublic = a.isPublic || a.owner ? 1 : 0;
		const bPublic = b.isPublic || b.owner ? 1 : 0;
		return bPublic - aPublic;
	});
}

export type EbookUploadPhase = 'reading' | 'uploading';

export type EbookUploadState = {
	phase: EbookUploadPhase;
	fileName: string;
	percent: number;
	bookId?: string;
};

/** 本地 progMap 即时更新；远端 PUT 防抖合并，避免听书 relocated 刷屏 */
const PROG_REMOTE_DEBOUNCE_MS = 8_000;
const PROG_PERCENT_SYNC_EPS = 0.005;

function progNeedsRemoteSync(next: Prog, lastSynced?: Prog): boolean {
	if (!lastSynced) return true;
	if (next.epubCfi !== lastSynced.epubCfi) return true;
	if (next.pdfPage !== lastSynced.pdfPage) return true;
	const np = next.percent;
	const lp = lastSynced.percent;
	if (np == null && lp == null) return false;
	if (np == null || lp == null) return true;
	return Math.abs(np - lp) >= PROG_PERCENT_SYNC_EPS;
}

class EbookStore {
	books: Book[] = [];
	bookCache: Record<string, Book> = {};
	publicSourceCache: Record<string, EbookPublicSource> = {};
	progMap: Record<string, Prog> = {};
	lastSyncedProgMap: Record<string, Prog> = {};
	progPendingBookIds = new Set<string>();
	progFlushTimer: ReturnType<typeof setTimeout> | null = null;
	progRemoteInflight: Promise<void> | null = null;
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
	publicBookTotal = 0;
	activeCategoryKey: EbookShelfCategoryKey = { kind: 'all' };
	categoriesLoading = false;
	titleKeyword = '';

	shelfFetchSeq = 0;

	constructor() {
		makeAutoObservable(this);
	}

	get hasMore(): boolean {
		if (this.titleKeyword.trim()) {
			return this.books.length < this.safeTotal();
		}
		if (this.activeCategoryKey.kind === 'all') {
			return this.books.length < this.totalBookCount + this.publicBookTotal;
		}
		return this.books.length < this.safeTotal();
	}

	/** 「全部」Tab 角标：我的源书 + 他人公开书 */
	get shelfAllCount(): number {
		return this.totalBookCount + this.publicBookTotal;
	}

	safeTotal(): number {
		return Number.isFinite(this.total) && this.total >= 0 ? this.total : 0;
	}

	/** 分类 / 未分类 Tab 内最后一本书移走后切回「全部」 */
	resetActiveCategoryIfEmpty(): void {
		if (this.activeCategoryKey.kind === 'all') return;
		if (this.books.length > 0 || this.safeTotal() > 0) return;
		this.activeCategoryKey = { kind: 'all' };
		void this.fetchPage(1, false);
	}

	bookMatchesActiveCategory(categoryId?: string | null): boolean {
		const key = this.activeCategoryKey;
		if (key.kind === 'public') return false;
		if (key.kind === 'all') return true;
		if (key.kind === 'uncategorized') {
			return categoryId == null;
		}
		return categoryId === key.categoryId;
	}

	resolveImportCategoryId(): string | undefined {
		const key = this.activeCategoryKey;
		if (key.kind === 'category') {
			console.log('resolveImportCategoryId', key.categoryId);
			return key.categoryId;
		}
		const userId = loggedInUserId();
		const last = readLastImportCategoryId(userId);
		console.log('resolveImportCategoryId', last, this.categories);
		// if (last && this.categories.some((c) => c.id === last)) {
		// 	return last;
		// }
		return undefined;
	}

	async hydrate(): Promise<void> {
		const tasks: Promise<unknown>[] = [
			this.fetchCategories(),
			this.fetchPage(1, false),
		];
		// 「全部」Tab 的 fetchPage 已拉公开书并写入 publicBookTotal，无需再 pageSize=1 探测
		if (this.activeCategoryKey.kind !== 'all') {
			tasks.push(this.fetchPublicCount());
		}
		await Promise.all(tasks);
	}

	/** 阅读页直链/刷新：只拉单书详情，不请求书架分页（始终刷新，避免书架缓存 isPublic 过期误开 sync） */
	async ensureBookForRead(bookId: string): Promise<Book | undefined> {
		try {
			const detail = await getEbookBook(bookId);
			const { book, prog, publicSource } = detail;
			runInAction(() => {
				this.bookCache[book.id] = book;
				if (publicSource) {
					this.publicSourceCache[book.id] = publicSource;
				} else {
					delete this.publicSourceCache[book.id];
				}
				if (prog) {
					this.progMap[book.id] = prog;
					this.lastSyncedProgMap[book.id] = prog;
				}
				this.ready = true;
			});
			return book;
		} catch {
			runInAction(() => {
				this.ready = true;
			});
			return this.bookById(bookId);
		}
	}

	async fetchPublicCount(): Promise<void> {
		try {
			const data = await loadEbookShelf({
				scope: 'public',
				pageNo: 1,
				pageSize: 1,
			});
			runInAction(() => {
				const nextTotal = Number(data.total);
				this.publicBookTotal =
					Number.isFinite(nextTotal) && nextTotal >= 0 ? nextTotal : 0;
			});
		} catch {
			// 公开数量加载失败不阻塞书架
		}
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

	async refreshList(keyword?: string): Promise<void> {
		if (keyword !== undefined) {
			this.titleKeyword = keyword;
		}
		await this.fetchPage(1, false);
	}

	async fetchPage(page: number, append: boolean): Promise<void> {
		const seq = ++this.shelfFetchSeq;
		if (append) {
			this.loadingMore = true;
		} else {
			this.loading = true;
		}
		try {
			const key = this.activeCategoryKey;
			const title = this.titleKeyword.trim() || undefined;
			const data = await loadEbookShelf({
				pageNo: page,
				pageSize: this.pageSize,
				title,
				...shelfQueryFromKey(key),
			});
			const publicData =
				key.kind === 'all' && page === 1 && !append
					? await loadEbookShelf({
							scope: 'public',
							pageNo: 1,
							pageSize: 100,
							title,
						})
					: null;
			if (seq !== this.shelfFetchSeq) return;
			runInAction(() => {
				if (publicData) {
					const pubTotal = Number(publicData.total);
					this.publicBookTotal =
						Number.isFinite(pubTotal) && pubTotal >= 0 ? pubTotal : 0;
				}
				const mineTotal = Number(data.total);
				const nextTotal =
					key.kind === 'all'
						? (Number.isFinite(mineTotal) && mineTotal >= 0 ? mineTotal : 0) +
							this.publicBookTotal
						: Number(data.total);
				this.total =
					Number.isFinite(nextTotal) && nextTotal >= 0 ? nextTotal : 0;
				this.pageNo = page;
				const nextProgMap =
					key.kind === 'all' && publicData && !append
						? {
								...(publicData.progMap ?? {}),
								...(data.progMap ?? {}),
							}
						: append
							? this.progMap
							: (data.progMap ?? {});
				if (append) {
					const existingIds = new Set(this.books.map((b) => b.id));
					const merged = [...this.books];
					for (const book of data.books) {
						if (!existingIds.has(book.id)) {
							existingIds.add(book.id);
							merged.push(book);
						}
					}
					for (const [bookId, prog] of Object.entries(data.progMap ?? {})) {
						nextProgMap[bookId] = prog;
					}
					this.books = sortBooksByLastRead(merged, nextProgMap);
					this.progMap = nextProgMap;
				} else if (key.kind === 'all' && publicData) {
					const mineIds = new Set(data.books.map((b) => b.id));
					const publicBooks = publicData.books.filter(
						(b) => !mineIds.has(b.id),
					);
					this.progMap = nextProgMap;
					this.seedSyncedProgMap(this.progMap);
					this.books = sortBooksByLastRead(
						[...data.books, ...publicBooks],
						nextProgMap,
					);
				} else {
					this.progMap = nextProgMap;
					this.seedSyncedProgMap(this.progMap);
					this.books = sortBooksByLastRead(data.books, nextProgMap);
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
			const detail = await getEbookBook(bookId);
			const { book, prog, publicSource } = detail;
			runInAction(() => {
				this.bookCache[book.id] = book;
				if (publicSource) {
					this.publicSourceCache[book.id] = publicSource;
				}
				if (prog) {
					this.progMap[book.id] = prog;
					this.lastSyncedProgMap[book.id] = prog;
				}
			});
			return book;
		} catch {
			console.log('fetchBookIfMissing error', bookId);
			return undefined;
		}
	}

	async setBookPublic(bookId: string, isPublic: boolean): Promise<Book> {
		const updated = await setEbookBookVisibility(bookId, isPublic);
		runInAction(() => {
			const next = this.books.map((b) => (b.id === bookId ? updated : b));
			this.books = sortBooksByLastRead(next, this.progMap);
			this.bookCache[bookId] = updated;
		});
		void this.fetchPublicCount();
		return updated;
	}

	async openPublicBook(sourceBookId: string): Promise<string> {
		const { readingBookId } = await openEbookPublicBook(sourceBookId);
		await this.fetchBookIfMissing(readingBookId);
		return readingBookId;
	}

	publicSourceOf(bookId: string): EbookPublicSource | undefined {
		return this.publicSourceCache[bookId];
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
		this.publicSourceCache = {};
		this.progMap = {};
		this.lastSyncedProgMap = {};
		this.progPendingBookIds.clear();
		if (this.progFlushTimer) {
			clearTimeout(this.progFlushTimer);
			this.progFlushTimer = null;
		}
		this.total = 0;
		this.pageNo = 1;
		this.ready = false;
		this.loading = false;
		this.loadingMore = false;
		this.categories = [];
		this.uncategorizedCount = 0;
		this.totalBookCount = 0;
		this.publicBookTotal = 0;
		this.activeCategoryKey = { kind: 'all' };
		this.titleKeyword = '';
		this.clearUploadState();
	}

	mergeBookIntoShelf(book: Book, isNew: boolean): void {
		this.bookCache[book.id] = book;
		if (!this.bookMatchesActiveCategory(book.categoryId)) {
			return;
		}
		const existed = this.books.some((b) => b.id === book.id);
		this.books = sortBooksByLastRead(
			[book, ...this.books.filter((b) => b.id !== book.id)],
			this.progMap,
		);
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
		const current = this.books.find((b) => b.id === bookId);
		if (current?.owner) return;
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
			this.resetActiveCategoryIfEmpty();
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
			delete this.lastSyncedProgMap[bookId];
			this.progPendingBookIds.delete(bookId);
			this.total = Math.max(0, this.safeTotal() - 1);
			this.resetActiveCategoryIfEmpty();
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
			if (
				this.books.some(
					(b) => b.id === patch.bookId || b.readingBookId === patch.bookId,
				)
			) {
				this.books = sortBooksByLastRead(this.books, this.progMap);
			}
		});
		this.scheduleProgRemoteSync(patch.bookId);
	}

	seedSyncedProgMap(map: Record<string, Prog>): void {
		this.lastSyncedProgMap = { ...map };
	}

	scheduleProgRemoteSync(bookId: string): void {
		this.progPendingBookIds.add(bookId);
		if (this.progFlushTimer) clearTimeout(this.progFlushTimer);
		this.progFlushTimer = setTimeout(() => {
			this.progFlushTimer = null;
			void this.flushProgRemoteSync();
		}, PROG_REMOTE_DEBOUNCE_MS);
	}

	/** 离开阅读页 / 切后台 / 刷新时同步；keepalive 供 pagehide 使用 */
	flushProgRemoteSync(
		bookId?: string,
		opts?: { keepalive?: boolean },
	): Promise<void> {
		if (this.progFlushTimer) {
			clearTimeout(this.progFlushTimer);
			this.progFlushTimer = null;
		}
		const ids = bookId ? [bookId] : [...this.progPendingBookIds];
		if (ids.length === 0) return Promise.resolve();

		if (opts?.keepalive) {
			for (const id of ids) {
				const next = this.progMap[id];
				if (!next) {
					this.progPendingBookIds.delete(id);
					continue;
				}
				const last = this.lastSyncedProgMap[id];
				if (!progNeedsRemoteSync(next, last)) {
					this.progPendingBookIds.delete(id);
					continue;
				}
				saveEbookProgressKeepalive(next);
				this.lastSyncedProgMap[id] = next;
				this.progPendingBookIds.delete(id);
			}
			return Promise.resolve();
		}

		const run = async () => {
			for (const id of ids) {
				const next = this.progMap[id];
				if (!next) {
					this.progPendingBookIds.delete(id);
					continue;
				}
				const last = this.lastSyncedProgMap[id];
				if (!progNeedsRemoteSync(next, last)) {
					this.progPendingBookIds.delete(id);
					continue;
				}
				try {
					await saveEbookProgress(next);
					this.lastSyncedProgMap[id] = next;
					this.progPendingBookIds.delete(id);
				} catch {
					this.progPendingBookIds.add(id);
					this.scheduleProgRemoteSync(id);
				}
			}
		};

		this.progRemoteInflight = (this.progRemoteInflight ?? Promise.resolve())
			.then(run, run)
			.finally(() => {
				if (this.progRemoteInflight) this.progRemoteInflight = null;
			});
		return this.progRemoteInflight;
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
