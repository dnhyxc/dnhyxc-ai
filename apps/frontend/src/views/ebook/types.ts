export type BookFmt = 'epub' | 'pdf';

/** 书籍文件来源：桌面路径 / 服务端存储 */
export type BookSrc =
	| { kind: 'path'; path: string }
	| { kind: 'store'; localPath?: string };

export type Book = {
	id: string;
	fmt: BookFmt;
	title: string;
	author?: string;
	src: BookSrc;
	size?: number;
	/** /images/ebook-cover_*.jpg 等相对路径 */
	coverUrl?: string;
	addedAt: string;
	categoryId?: string | null;
};

/** 书架分类 */
export type EbookCategory = {
	id: string;
	name: string;
	sortOrder: number;
	bookCount: number;
};

/** 书架 Tab：全部 | 某分类 | 未分类 */
export type EbookShelfCategoryKey =
	| { kind: 'all' }
	| { kind: 'category'; categoryId: string }
	| { kind: 'uncategorized' };

export type EbookCategoriesSummary = {
	categories: EbookCategory[];
	uncategorizedCount: number;
	totalBookCount: number;
};

export type Prog = {
	bookId: string;
	epubCfi?: string;
	pdfPage?: number;
	percent?: number;
	updatedAt: string;
};

/** 阅读页目录项（EPUB nav / PDF outline 共用） */
export type EbookTocItem = {
	label: string;
	href?: string;
	depth?: number;
	/** EPUB：对应 spine 索引，用于目录高亮 */
	spineIndex?: number;
};

export type EbookShelfData = {
	books: Book[];
	progMap: Record<string, Prog>;
	total: number;
	pageNo: number;
	pageSize: number;
};

export type EbookBookDetail = {
	book: Book;
	prog?: Prog;
};
