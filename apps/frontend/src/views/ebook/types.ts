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

/** EPUB 读书想法（服务端存储，按 CFI 定位） */
export type EbookThought = {
	id: string;
	userId: number;
	cfiRange: string;
	/** 选中的原文摘录 */
	quote: string;
	/** 用户想法正文 */
	content: string;
	/** 服务端按 userId 实时解析，非持久化字段 */
	username: string;
	avatar: string;
	createdAt: string;
	updatedAt: string;
};

/** 同一 cfiRange 下的想法分组（数据库粒度不变） */
export type EbookThoughtQuoteGroup = {
	cfiRange: string;
	quote: string;
	thoughts: EbookThought[];
	/** quote 字符数；无 quote 时回退 cfiRange.length */
	spanLength: number;
};

/**
 * 一次正文点击解析出的「想法簇」
 * —— 可包含多个严格嵌套（或部分相交）的 quote 分组
 */
export type EbookThoughtClickCluster = {
	/** 引用区默认展示的最外层 cfi / quote */
	primaryCfiRange: string;
	primaryQuote: string;
	/** 按 span 从长到短排序的选区分组 */
	quoteGroups: EbookThoughtQuoteGroup[];
	/** 扁平列表：UI 渲染用 */
	allThoughts: EbookThought[];
	/** 列表内当前聚焦的想法 id；undefined 时使用 primaryQuote */
	selectedThoughtId?: string;
};

/** EPUB 用户划线样式（选区高亮 / 直线下划线 / 波浪线） */
export type EpubHighlightStyle = 'highlight' | 'underline' | 'wavy';

export type EpubHighlightColorId =
	| 'pink'
	| 'purple'
	| 'blue'
	| 'green'
	| 'yellow';

/** EPUB 用户划线（服务端存储，按 CFI 定位） */
export type EbookUserHighlight = {
	id: string;
	userId: number;
	cfiRange: string;
	quote: string;
	style: EpubHighlightStyle;
	color: EpubHighlightColorId;
	createdAt: string;
	updatedAt: string;
};
