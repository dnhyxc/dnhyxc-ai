/** 阅读页注册的可变 ebook 能力；bridge 冻结后仍读到最新 book / 导航实现 */

export type EbookHostThought = {
	id: string;
	userId: number | string;
	cfiRange: string;
	quote: string;
	content: string;
	username?: string;
	avatar?: string;
	createdAt?: string;
	updatedAt?: string;
	isPublic?: boolean;
};

export type EbookHostHandlers = {
	getBookId: () => string | null;
	getBookTitle: () => string | null;
	navigateToCfi: (cfi: string) => void | Promise<void>;
	openThought: (thought: EbookHostThought) => void;
	closeIdeasList?: () => void;
};

let handlers: EbookHostHandlers | null = null;

export function setEbookHostHandlers(next: EbookHostHandlers | null) {
	handlers = next;
}

export function getEbookHostHandlers(): EbookHostHandlers | null {
	return handlers;
}

export function createEbookModulesApi() {
	return Object.freeze({
		getBookId: () => handlers?.getBookId() ?? null,
		getBookTitle: () => handlers?.getBookTitle() ?? null,
		navigateToCfi: (cfi: string) => {
			const fn = handlers?.navigateToCfi;
			if (!fn) throw new Error('EBOOK_API_UNBOUND');
			return fn(cfi);
		},
		openThought: (thought: EbookHostThought) => {
			const fn = handlers?.openThought;
			if (!fn) throw new Error('EBOOK_API_UNBOUND');
			fn(thought);
		},
		closeIdeasList: () => {
			handlers?.closeIdeasList?.();
		},
	});
}
