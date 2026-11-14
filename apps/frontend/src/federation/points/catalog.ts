/** 主项目事先登记的扩展点。插件只能挂到这里已有的 id 和槽位上。 */

export type HostPointSlot = {
	name: string;
	kind: 'action' | 'drawer' | 'toolbar';
	/** 动作槽点击后打开的抽屉槽。载荷写在那个槽上。 */
	opens?: string;
	/**
	 * 布局怎么挂这个抽屉。不写就由布局挂一个普通抽屉，离开英语学习时关掉。
	 * order 小的先挂，后挂的盖在上面。
	 */
	layout?: {
		/** 页面自己画，布局只负责离开时关掉 */
		page?: boolean;
		/** 一直挂着，关掉时保留退场。被盖住时不播退场 */
		persist?: boolean;
		/** false：不锁焦点，方便上面再叠一层 */
		modal?: boolean;
		/** 目标槽开着且没被盖住时，本抽屉只隐藏，不关闭 */
		yieldTo?: { point: string; slot: string };
		order?: number;
	};
};

export type HostPointSpec = {
	id: string;
	slots: readonly HostPointSlot[];
	contextKeys: readonly string[];
	signals: readonly ('pending' | 'stats')[];
	commands: readonly string[];
	covers?: { slot: string; targetPoint: string; targetSlot: string };
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
	ebookRead: 'ebook.read',
} as const;

function listPoint(id: string, contextKeys: readonly string[]): HostPointSpec {
	return {
		id,
		slots: [
			{ name: 'toolbar', kind: 'toolbar' },
			{ name: 'item-action', kind: 'action', opens: 'drawer' },
			{ name: 'drawer', kind: 'drawer' },
		],
		contextKeys,
		signals: [],
		commands: [],
	};
}

export const hostPoints: Record<string, HostPointSpec> = {
	[POINT.vocabCard]: {
		id: POINT.vocabCard,
		slots: [
			{ name: 'card-action', kind: 'action', opens: 'drawer' },
			{ name: 'drawer', kind: 'drawer', layout: { persist: true, order: 1 } },
		],
		contextKeys: [],
		signals: ['pending'],
		commands: ['play', 'stop'],
	},
	[POINT.vocabLibrary]: {
		id: POINT.vocabLibrary,
		slots: [
			{ name: 'toolbar', kind: 'toolbar' },
			{ name: 'item-action', kind: 'action', opens: 'item-drawer' },
			{ name: 'item-drawer', kind: 'drawer' },
			{ name: 'drawer', kind: 'drawer', layout: { page: true } },
			{ name: 'library-card-action', kind: 'action', opens: 'import-drawer' },
			{
				name: 'import-drawer',
				kind: 'drawer',
				layout: {
					persist: true,
					modal: false,
					order: 0,
					yieldTo: { point: POINT.vocabCard, slot: 'drawer' },
				},
			},
		],
		contextKeys: ['libraryId'],
		signals: ['stats'],
		commands: ['pickJsonFile', 'openCard'],
		covers: {
			slot: 'drawer',
			targetPoint: POINT.vocabCard,
			targetSlot: 'drawer',
		},
	},
	[POINT.classicCard]: {
		id: POINT.classicCard,
		slots: [
			{ name: 'card-action', kind: 'action', opens: 'drawer' },
			{ name: 'drawer', kind: 'drawer' },
		],
		contextKeys: [],
		signals: [],
		commands: [],
	},
	[POINT.classicLibrary]: {
		...listPoint(POINT.classicLibrary, ['libraryId']),
		slots: [
			{ name: 'toolbar', kind: 'toolbar' },
			{ name: 'item-action', kind: 'action', opens: 'item-drawer' },
			{ name: 'item-drawer', kind: 'drawer' },
			{ name: 'drawer', kind: 'drawer' },
			{ name: 'library-card-action', kind: 'action', opens: 'import-drawer' },
			{ name: 'import-drawer', kind: 'drawer' },
		],
	},
	[POINT.mistakes]: listPoint(POINT.mistakes, ['kind']),
	[POINT.review]: listPoint(POINT.review, ['kind']),
	[POINT.favorites]: listPoint(POINT.favorites, ['kind']),
	[POINT.dailyReading]: listPoint(POINT.dailyReading, ['origin']),
	[POINT.ebookRead]: {
		id: POINT.ebookRead,
		slots: [
			{ name: 'toolbar', kind: 'toolbar' },
			{ name: 'drawer', kind: 'drawer', layout: { page: true } },
		],
		contextKeys: ['bookId', 'bookTitle'],
		signals: [],
		commands: ['navigateToCfi', 'openThought', 'closeIdeasList'],
	},
};

export function getHostPoint(id: string): HostPointSpec | null {
	return hostPoints[id] ?? null;
}

/** 布局要关掉的全部门抽屉。page 的由页面自己挂，其余由布局挂。order 小的在下面。 */
export const layoutDrawerSlots = Object.values(hostPoints)
	.flatMap((spec) =>
		spec.slots
			.filter((slot) => slot.kind === 'drawer')
			.map((slot) => ({ pointId: spec.id, slot })),
	)
	.sort((a, b) => (a.slot.layout?.order ?? 2) - (b.slot.layout?.order ?? 2));
