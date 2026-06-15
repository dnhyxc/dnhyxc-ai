declare module 'epubjs' {
	import type { Book, Location, Rendition } from 'epubjs/types';

	export type { Book, Location, Rendition };

	export default function ePub(
		urlOrData: string | ArrayBuffer | Blob,
		options?: Record<string, unknown>,
	): Book;
}
