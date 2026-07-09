import type {
	Book,
	Chapter,
	Highlight,
	ReadingProgress,
	Thought,
	TocItem,
} from '@/types';

const API_BASE = 'https://api.example.com';

interface ApiResponse<T> {
	code: number;
	data: T;
	message?: string;
}

async function request<T>(
	url: string,
	options: UniApp.RequestOptions = {},
): Promise<T> {
	return new Promise((resolve, reject) => {
		uni.request({
			url: `${API_BASE}${url}`,
			method: options.method || 'GET',
			data: options.data,
			header: {
				'Content-Type': 'application/json',
				...options.header,
			},
			success: (res) => {
				const response = res.data as ApiResponse<T>;
				if (response.code === 200) {
					resolve(response.data);
				} else {
					reject(new Error(response.message || '请求失败'));
				}
			},
			fail: (err) => {
				reject(err);
			},
		});
	});
}

export const ebookApi = {
	async getBookshelf(): Promise<Book[]> {
		return request('/ebook/shelf');
	},

	async getBook(bookId: string): Promise<Book> {
		return request(`/ebook/${bookId}`);
	},

	async getChapters(bookId: string): Promise<Chapter[]> {
		return request(`/ebook/${bookId}/chapters`);
	},

	async getChapter(
		bookId: string,
		chapterId: string,
	): Promise<{
		chapter: Chapter;
		highlights: Highlight[];
		thoughts: Thought[];
	}> {
		return request(`/ebook/${bookId}/chapter/${chapterId}`);
	},

	async getToc(bookId: string): Promise<TocItem[]> {
		return request(`/ebook/${bookId}/toc`);
	},

	async saveProgress(
		bookId: string,
		progress: Omit<ReadingProgress, 'bookId'>,
	): Promise<void> {
		await request(`/ebook/${bookId}/progress`, {
			method: 'PUT',
			data: progress,
		});
	},

	async getProgress(bookId: string): Promise<ReadingProgress | null> {
		return request(`/ebook/${bookId}/progress`);
	},

	async addHighlight(highlight: Omit<Highlight, 'id' | 'createdAt'>): Promise<{
		highlightId: string;
	}> {
		return request(`/ebook/${highlight.bookId}/highlight`, {
			method: 'POST',
			data: highlight,
		});
	},

	async addThought(thought: Omit<Thought, 'id' | 'createdAt'>): Promise<{
		thoughtId: string;
	}> {
		return request(`/ebook/${thought.bookId}/thought`, {
			method: 'POST',
			data: thought,
		});
	},

	async getHighlights(bookId: string): Promise<Highlight[]> {
		return request(`/ebook/${bookId}/highlights`);
	},

	async getThoughts(bookId: string): Promise<Thought[]> {
		return request(`/ebook/${bookId}/thoughts`);
	},

	async deleteHighlight(bookId: string, highlightId: string): Promise<void> {
		await request(`/ebook/${bookId}/highlight/${highlightId}`, {
			method: 'DELETE',
		});
	},

	async deleteThought(bookId: string, thoughtId: string): Promise<void> {
		await request(`/ebook/${bookId}/thought/${thoughtId}`, {
			method: 'DELETE',
		});
	},
};
