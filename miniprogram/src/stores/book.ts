import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import type { Book, ReaderSettings, ReadingProgress } from '@/types';

export const useBookStore = defineStore('book', () => {
	const books = ref<Book[]>([]);
	const currentBookId = ref<string | null>(null);
	const progressMap = ref<Map<string, ReadingProgress>>(new Map());
	const settings = ref<ReaderSettings>({
		fontSize: 16,
		lineHeight: 1.8,
		bgColor: 'white',
	});

	const currentBook = computed(() => {
		if (!currentBookId.value) return null;
		return books.value.find((b) => b.id === currentBookId.value) || null;
	});

	function setBooks(newBooks: Book[]) {
		books.value = newBooks;
	}

	function addBook(book: Book) {
		const index = books.value.findIndex((b) => b.id === book.id);
		if (index >= 0) {
			books.value[index] = book;
		} else {
			books.value.push(book);
		}
	}

	function removeBook(bookId: string) {
		books.value = books.value.filter((b) => b.id !== bookId);
	}

	function setCurrentBook(bookId: string) {
		currentBookId.value = bookId;
	}

	function getProgress(bookId: string): ReadingProgress | undefined {
		return progressMap.value.get(bookId);
	}

	function saveProgress(bookId: string, progress: ReadingProgress) {
		progressMap.value.set(bookId, progress);
		uni.setStorageSync(`progress_${bookId}`, progress);
	}

	function loadProgress(bookId: string) {
		const stored = uni.getStorageSync(`progress_${bookId}`);
		if (stored) {
			progressMap.value.set(bookId, stored);
			return stored;
		}
		return undefined;
	}

	function setSettings(newSettings: Partial<ReaderSettings>) {
		settings.value = { ...settings.value, ...newSettings };
		uni.setStorageSync('reader_settings', settings.value);
	}

	function loadSettings() {
		const stored = uni.getStorageSync('reader_settings');
		if (stored) {
			settings.value = stored;
		}
	}

	function getThemeClass() {
		switch (settings.value.bgColor) {
			case 'dark':
				return 'dark';
			case 'sepia':
				return 'sepia';
			default:
				return '';
		}
	}

	return {
		books,
		currentBookId,
		currentBook,
		progressMap,
		settings,
		setBooks,
		addBook,
		removeBook,
		setCurrentBook,
		getProgress,
		saveProgress,
		loadProgress,
		setSettings,
		loadSettings,
		getThemeClass,
	};
});
