/** 主项目事先登记的扩展点。插件只能挂到已编译出的槽上。 */

export type DrawerChrome = {
	owner: 'layout' | 'page';
	persist: boolean;
	modal: boolean;
	order: number;
};

export type Role =
	| { kind: 'toolbar' }
	| {
			kind: 'toggle';
			slot: string;
			opens: string;
			payload: 'word' | 'english' | 'record';
			drawer?: Partial<DrawerChrome>;
	  }
	| {
			kind: 'page';
			slot: string;
			payload: 'none' | 'record';
			trigger: 'icons' | 'custom';
			drawer?: Partial<DrawerChrome>;
	  }
	| { kind: 'command' };

export type ContextKey =
	| 'libraryId'
	| 'kind'
	| 'origin'
	| 'bookId'
	| 'bookTitle'
	| 'knowledgeId'
	| 'docPublic'
	| 'docOwned';

export type CommandName =
	| 'play'
	| 'stop'
	| 'pickJsonFile'
	| 'openCard'
	| 'openReading'
	| 'detailEntries'
	| 'openDetail'
	| 'openDetailList'
	| 'openDetailImport'
	| 'exportWords'
	| 'navigateToCfi'
	| 'openThought'
	| 'closeIdeasList';

export type PointDef = {
	id: string;
	roles: readonly Role[];
	contextKeys: readonly ContextKey[];
	signals: readonly ('pending' | 'stats')[];
	commands: readonly CommandName[];
};

export type HostPointSlot = {
	name: string;
	kind: 'action' | 'drawer' | 'toolbar';
	/** 动作槽点击后打开的抽屉槽。载荷写在那个槽上。 */
	opens?: string;
	layout?: {
		page?: boolean;
		persist?: boolean;
		modal?: boolean;
		order?: number;
	};
};

export type HostPointSpec = {
	id: string;
	slots: readonly HostPointSlot[];
	contextKeys: readonly string[];
	signals: readonly ('pending' | 'stats')[];
	commands: readonly string[];
};

export type StackRule =
	| {
			op: 'cover';
			whenOpen: { point: string; slot: string };
			target: { point: string; slot: string };
	  }
	| {
			op: 'yield';
			whileVisible: { point: string; slot: string };
			self: { point: string; slot: string };
	  };

export const POINT = {
	vocabCard: 'english.vocab.card',
	vocabLibrary: 'english.vocab.library',
	classicCard: 'english.classic.card',
	classicLibrary: 'english.classic.library',
	mistakes: 'english.mistakes',
	review: 'english.review',
	favorites: 'english.favorites',
	dailyReading: 'english.dailyReading',
	dailyReadingArticle: 'english.dailyReading.article',
	ebookRead: 'ebook.read',
	knowledgeArticle: 'knowledge.article',
} as const;

const DEFAULT_CHROME: DrawerChrome = {
	owner: 'layout',
	persist: false,
	modal: true,
	order: 2,
};

function chromeOf(partial?: Partial<DrawerChrome>): DrawerChrome {
	return { ...DEFAULT_CHROME, ...partial };
}

function layoutOf(chrome: DrawerChrome): NonNullable<HostPointSlot['layout']> {
	return {
		page: chrome.owner === 'page',
		persist: chrome.persist,
		modal: chrome.modal,
		order: chrome.order,
	};
}

/** 角色编译成现有槽表。pending 没有 word 按钮时直接抛，不把半套参数放进目录。 */
export function compilePoint(def: PointDef): HostPointSpec {
	const slots: HostPointSlot[] = [];
	for (const role of def.roles) {
		if (role.kind === 'toolbar') {
			slots.push({ name: 'toolbar', kind: 'toolbar' });
			continue;
		}
		if (role.kind === 'command') continue;
		const chrome = chromeOf(role.drawer);
		if (role.kind === 'toggle') {
			slots.push({ name: role.slot, kind: 'action', opens: role.opens });
			slots.push({
				name: role.opens,
				kind: 'drawer',
				layout: layoutOf(chrome),
			});
			continue;
		}
		slots.push({
			name: role.slot,
			kind: 'drawer',
			layout: layoutOf(chrome),
		});
	}
	const wordToggle = def.roles.some(
		(role) => role.kind === 'toggle' && role.payload === 'word',
	);
	if (def.signals.includes('pending') && !wordToggle) {
		throw new Error(`PENDING_WITHOUT_WORD:${def.id}`);
	}
	return {
		id: def.id,
		slots,
		contextKeys: def.contextKeys,
		signals: def.signals,
		commands: def.commands,
	};
}

function listPoint(id: string, contextKeys: readonly ContextKey[]): PointDef {
	return {
		id,
		roles: [
			{ kind: 'toolbar' },
			{
				kind: 'toggle',
				slot: 'item-action',
				opens: 'drawer',
				payload: 'record',
			},
		],
		contextKeys,
		signals: [],
		commands: [],
	};
}

export const pointDefs: readonly PointDef[] = [
	{
		id: POINT.vocabCard,
		roles: [
			{
				kind: 'toggle',
				slot: 'card-action',
				opens: 'drawer',
				payload: 'word',
				drawer: { persist: true, order: 1 },
			},
		],
		contextKeys: [],
		signals: ['pending'],
		commands: ['play', 'stop'],
	},
	{
		id: POINT.vocabLibrary,
		roles: [
			{ kind: 'toolbar' },
			{
				kind: 'toggle',
				slot: 'item-action',
				opens: 'item-drawer',
				payload: 'record',
			},
			{
				kind: 'page',
				slot: 'drawer',
				payload: 'record',
				trigger: 'custom',
				// 列表不跟详解抢焦点锁，滚动锁由 HostPoint 在 modal:false 时加上
				drawer: { owner: 'page', modal: false },
			},
			{
				kind: 'toggle',
				slot: 'library-card-action',
				opens: 'import-drawer',
				payload: 'record',
				drawer: { persist: true, modal: false, order: 0 },
			},
		],
		contextKeys: ['libraryId'],
		signals: ['stats'],
		commands: ['pickJsonFile', 'openCard'],
	},
	{
		id: POINT.classicCard,
		roles: [
			{
				kind: 'toggle',
				slot: 'card-action',
				opens: 'drawer',
				payload: 'english',
			},
		],
		contextKeys: [],
		signals: [],
		commands: [],
	},
	{
		id: POINT.classicLibrary,
		roles: [
			{ kind: 'toolbar' },
			{
				kind: 'toggle',
				slot: 'item-action',
				opens: 'item-drawer',
				payload: 'record',
			},
			{
				kind: 'toggle',
				slot: 'library-card-action',
				opens: 'import-drawer',
				payload: 'record',
			},
			// 没有按钮打开。确认注册表没有插件挂这个槽之后再删
			{
				kind: 'page',
				slot: 'drawer',
				payload: 'none',
				trigger: 'custom',
				drawer: { owner: 'layout' },
			},
		],
		contextKeys: ['libraryId'],
		signals: [],
		commands: [],
	},
	listPoint(POINT.mistakes, ['kind']),
	listPoint(POINT.review, ['kind']),
	listPoint(POINT.favorites, ['kind']),
	listPoint(POINT.dailyReading, ['origin']),
	{
		id: POINT.dailyReadingArticle,
		roles: [{ kind: 'command' }],
		contextKeys: [],
		signals: [],
		commands: [
			'openReading',
			'play',
			'stop',
			'detailEntries',
			'openDetail',
			'openDetailList',
			'openDetailImport',
			'exportWords',
		],
	},
	{
		id: POINT.ebookRead,
		roles: [
			{ kind: 'toolbar' },
			{
				kind: 'page',
				slot: 'drawer',
				payload: 'none',
				trigger: 'icons',
				drawer: { owner: 'page' },
			},
		],
		contextKeys: ['bookId', 'bookTitle'],
		signals: [],
		commands: ['navigateToCfi', 'openThought', 'closeIdeasList'],
	},
	{
		id: POINT.knowledgeArticle,
		roles: [
			{
				kind: 'page',
				slot: 'drawer',
				payload: 'none',
				trigger: 'icons',
				drawer: { owner: 'page', modal: false, persist: false },
			},
		],
		contextKeys: ['knowledgeId', 'docPublic', 'docOwned'],
		signals: ['stats'],
		commands: [],
	},
];

export const hostPoints: Record<string, HostPointSpec> = Object.fromEntries(
	pointDefs.map((def) => [def.id, compilePoint(def)]),
);

/** 打开甲时盖住乙；乙可见时甲只隐藏。列表在详解重新露出来时也让位，对应原来的 tucked。 */
export const stacks: readonly StackRule[] = [
	{
		op: 'cover',
		whenOpen: { point: POINT.vocabLibrary, slot: 'drawer' },
		target: { point: POINT.vocabCard, slot: 'drawer' },
	},
	{
		op: 'yield',
		whileVisible: { point: POINT.vocabCard, slot: 'drawer' },
		self: { point: POINT.vocabLibrary, slot: 'import-drawer' },
	},
	{
		op: 'yield',
		whileVisible: { point: POINT.vocabCard, slot: 'drawer' },
		self: { point: POINT.vocabLibrary, slot: 'drawer' },
	},
];

export function getHostPoint(id: string): HostPointSpec | null {
	return hostPoints[id] ?? null;
}

/** 布局要关掉的全部抽屉。page 的由页面自己挂，其余由布局挂。order 小的在下面。 */
export const layoutDrawerSlots = Object.values(hostPoints)
	.flatMap((spec) =>
		spec.slots
			.filter((slot) => slot.kind === 'drawer')
			.map((slot) => ({ pointId: spec.id, slot })),
	)
	.sort((a, b) => (a.slot.layout?.order ?? 2) - (b.slot.layout?.order ?? 2));
