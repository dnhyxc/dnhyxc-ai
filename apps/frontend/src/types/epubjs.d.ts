declare module 'epubjs' {
	import type { Book, Rendition } from 'epubjs/types';

	export type { Book, Rendition };

	export default function ePub(
		urlOrData: string | ArrayBuffer | Blob,
		options?: Record<string, unknown>,
	): Book;
}
