/** IntentFrame 纯类型，避免与 spill 循环依赖。 */

export type IntentSlots = {
	catalog: boolean;
	inventory: boolean;
	filterLabels: string[];
	/** isCategoryAsk && !generate：kind 兼容，即使 labels 为空 */
	categoryAsk: boolean;
	libraryCue?: {
		raw: string;
		libraryId?: string;
		status: 'one' | 'ambiguous' | 'none' | 'absent';
	};
	domain?:
		| 'mistakes'
		| 'favorites'
		| 'libraries'
		| 'notes'
		| 'packs'
		| 'reading';
	mutate: {
		action: 'add' | 'remove' | 'query' | null;
		side: 'vocab' | 'classic' | 'both' | 'card';
	};
	generate?: 'pack' | 'reading' | null;
};

export type PlanStep =
	| { type: 'hangCatalog'; setPresented: false }
	| { type: 'resolveLibrary' }
	| { type: 'hangInventory'; setPresented: boolean }
	| { type: 'classify'; labels: string[] }
	| { type: 'ensureFilterThenPropose' }
	| { type: 'proposeFavorite' }
	| { type: 'noop' };

export type IntentFrame = {
	slots: IntentSlots;
	plan: PlanStep[];
};

/** 上一轮稳定槽位摘要（不落库，仅本会话内存/当轮推导）。 */
export type PriorFrameSummary = {
	libraryCue?: IntentSlots['libraryCue'];
	domain?: IntentSlots['domain'];
	categoryAsk?: boolean;
	filterLabels?: string[];
	contentKind?: 'vocab' | 'classic';
};

export type IntentFrameContext = {
	priorUserTexts: string[];
	priorLibraryCards?: { title: string; contentKind?: string }[];
	openProposalKind?: string | null;
	/** M3：跨轮继承库/域 */
	priorFrame?: PriorFrameSummary;
};
