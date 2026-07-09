export interface Book {
	id: string;
	title: string;
	author: string;
	coverUrl: string;
	description?: string;
	progress: number;
	lastReadTime?: number;
	chapterCount?: number;
	wordCount?: number;
}

export interface Chapter {
	id: string;
	title: string;
	content: string;
	textContent: string;
	wordCount: number;
	order: number;
}

export interface TocItem {
	id: string;
	title: string;
	href: string;
	children?: TocItem[];
}

export interface Highlight {
	id: string;
	bookId: string;
	chapterId: string;
	text: string;
	startOffset: number;
	endOffset: number;
	color: string;
	createdAt: number;
}

export interface Thought {
	id: string;
	bookId: string;
	chapterId: string;
	text: string;
	content: string;
	startOffset: number;
	endOffset: number;
	createdAt: number;
}

export interface ReadingProgress {
	bookId: string;
	chapterId: string;
	scrollPosition: number;
	percent: number;
	timestamp: number;
}

export interface ReaderSettings {
	fontSize: number;
	lineHeight: number;
	bgColor: 'white' | 'sepia' | 'dark';
}

export interface EpubMetadata {
	title: string;
	author: string;
	cover: string;
	identifier?: string;
}

export interface EpubSpineItem {
	id: string;
	title: string;
	href: string;
}

export type ThemeMode = 'light' | 'dark' | 'sepia';
