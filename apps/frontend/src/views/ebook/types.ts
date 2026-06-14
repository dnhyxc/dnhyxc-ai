export type BookFmt = 'epub' | 'pdf';

/** 书籍文件来源：桌面路径 / 服务端存储 */
export type BookSrc = { kind: 'path'; path: string } | { kind: 'store' };

export type Book = {
	id: string;
	fmt: BookFmt;
	title: string;
	author?: string;
	src: BookSrc;
	size?: number;
	addedAt: string;
};

export type Prog = {
	bookId: string;
	epubCfi?: string;
	pdfPage?: number;
	percent?: number;
	updatedAt: string;
};

export type EpubToc = { label: string; href: string };

export type EbookShelfData = {
	books: Book[];
	progMap: Record<string, Prog>;
};
