import { makeAutoObservable, runInAction } from 'mobx';
import {
	addEbookFromPath,
	loadEbookShelf,
	removeEbook,
	saveEbookProgress,
	uploadEbookFile,
} from '@/service';
import type { Book, Prog } from '@/views/ebook/types';
import { pickTauri } from '@/views/ebook/utils/io';

class EbookStore {
	books: Book[] = [];
	progMap: Record<string, Prog> = {};
	ready = false;
	busy = false;

	constructor() {
		makeAutoObservable(this);
	}

	async hydrate(): Promise<void> {
		try {
			const { books, progMap } = await loadEbookShelf();
			runInAction(() => {
				this.books = books;
				this.progMap = progMap;
				this.ready = true;
			});
		} catch {
			runInAction(() => {
				this.ready = true;
			});
		}
	}

	progOf(bookId: string): Prog | undefined {
		return this.progMap[bookId];
	}

	async addFromTauri(): Promise<Book | null> {
		const picked = await pickTauri();
		if (!picked) return null;
		const dup = this.books.find(
			(b) => b.src.kind === 'path' && b.src.path === picked.path,
		);
		if (dup) return dup;

		const book = await addEbookFromPath(picked.path, picked.fmt);
		runInAction(() => {
			this.books = [book, ...this.books.filter((b) => b.id !== book.id)];
		});
		return book;
	}

	async addFromFile(file: File): Promise<Book> {
		const book = await uploadEbookFile(file);
		runInAction(() => {
			this.books = [book, ...this.books.filter((b) => b.id !== book.id)];
		});
		return book;
	}

	async remove(bookId: string): Promise<void> {
		await removeEbook(bookId);
		runInAction(() => {
			this.books = this.books.filter((b) => b.id !== bookId);
			delete this.progMap[bookId];
		});
	}

	saveProg(patch: Omit<Prog, 'updatedAt'>): void {
		const next: Prog = {
			...patch,
			updatedAt: new Date().toISOString(),
		};
		runInAction(() => {
			this.progMap[patch.bookId] = next;
		});
		void saveEbookProgress(next);
	}

	bookById(id: string): Book | undefined {
		return this.books.find((b) => b.id === id);
	}
}

const ebookStore = new EbookStore();
export default ebookStore;
