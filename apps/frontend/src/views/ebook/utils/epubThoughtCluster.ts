import type { Rendition } from 'epubjs';
import type {
	EbookThought,
	EbookThoughtClickCluster,
	EbookThoughtQuoteGroup,
} from '../types';
import {
	beginEpubAnnotationSyncScope,
	cfiFromDomRange,
	endEpubAnnotationSyncScope,
	resolveCfiDomRange,
} from './epubRangeGeometry';
import { isThoughtCfiRangeStrictlyContained } from './epubThoughtAnnotations';

export function groupThoughtsByCfi(
	thoughts: EbookThought[],
): Map<string, EbookThought[]> {
	const grouped = new Map<string, EbookThought[]>();
	for (const thought of thoughts) {
		const cfi = thought.cfiRange.trim();
		if (!cfi) continue;
		const list = grouped.get(cfi) ?? [];
		list.push(thought);
		grouped.set(cfi, list);
	}
	return grouped;
}

export function thoughtGroupSpanLength(group: EbookThought[]): number {
	const quote = group[0]?.quote?.trim();
	if (quote && quote.length > 0) return quote.length;
	return group[0]?.cfiRange.length ?? 0;
}

function sortThoughtsByCreatedAtDesc(thoughts: EbookThought[]): EbookThought[] {
	return [...thoughts].sort(
		(a, b) => getThoughtCreatedAtTime(b) - getThoughtCreatedAtTime(a),
	);
}

function getThoughtCreatedAtTime(thought: EbookThought): number {
	const time = new Date(thought.createdAt).getTime();
	return Number.isFinite(time) ? time : 0;
}

function getQuoteGroupNewestTime(group: EbookThoughtQuoteGroup): number {
	let newest = 0;
	for (const thought of group.thoughts) {
		newest = Math.max(newest, getThoughtCreatedAtTime(thought));
	}
	return newest;
}

/** 侧栏列表：各摘录分组按组内最新想法时间倒序 */
function sortQuoteGroupsByNewestThoughtDesc(
	quoteGroups: EbookThoughtQuoteGroup[],
): void {
	quoteGroups.sort(
		(left, right) =>
			getQuoteGroupNewestTime(right) - getQuoteGroupNewestTime(left),
	);
}

function buildQuoteGroup(
	cfiRange: string,
	thoughts: EbookThought[],
): EbookThoughtQuoteGroup {
	const sorted = sortThoughtsByCreatedAtDesc(thoughts);
	return {
		cfiRange,
		quote: sorted[0]?.quote ?? '',
		thoughts: sorted,
		spanLength: thoughtGroupSpanLength(sorted),
	};
}

/** 两 CFI 是否存在严格嵌套关系（任一方向） */
function isNestedEitherWay(
	rend: Rendition,
	leftCfi: string,
	rightCfi: string,
	leftGroup: EbookThought[],
	rightGroup: EbookThought[],
): boolean {
	if (leftCfi === rightCfi) return true;
	return (
		isThoughtCfiRangeStrictlyContained(
			leftCfi,
			rightCfi,
			leftGroup,
			rightGroup,
			rend,
		) ||
		isThoughtCfiRangeStrictlyContained(
			rightCfi,
			leftCfi,
			rightGroup,
			leftGroup,
			rend,
		)
	);
}

/** 连通图规则版本（算法变更时递增，使旧缓存失效） */
const CONNECTIVITY_GRAPH_VERSION = 'v5';

function normalizeGapText(text: string): string {
	return text.replace(/\s+/g, '');
}

function buildGapRangeBetween(earlier: Range, later: Range): Range | null {
	try {
		const doc = earlier.startContainer.ownerDocument;
		if (
			!doc ||
			earlier.startContainer.ownerDocument !==
				later.startContainer.ownerDocument
		) {
			return null;
		}
		const [left, right] =
			earlier.compareBoundaryPoints(Range.START_TO_START, later) <= 0
				? [earlier, later]
				: [later, earlier];
		if (left.compareBoundaryPoints(Range.END_TO_START, right) > 0) {
			return null;
		}
		const gapRange = doc.createRange();
		gapRange.setStart(left.endContainer, left.endOffset);
		gapRange.setEnd(right.startContainer, right.startOffset);
		return gapRange;
	} catch {
		return null;
	}
}

/** 选区是否严格落在 earlier 与 later 之间的开区间 */
function isRangeStrictlyBetween(
	earlier: Range,
	later: Range,
	inner: Range,
): boolean {
	try {
		return (
			earlier.compareBoundaryPoints(Range.END_TO_START, inner) <= 0 &&
			inner.compareBoundaryPoints(Range.END_TO_START, later) <= 0
		);
	} catch {
		return false;
	}
}

function rangeIntersectsGap(range: Range, gap: Range): boolean {
	try {
		return (
			range.compareBoundaryPoints(Range.START_TO_END, gap) <= 0 &&
			range.compareBoundaryPoints(Range.END_TO_START, gap) >= 0
		);
	} catch {
		return false;
	}
}

/**
 * 间隙是否被落在 A 与 B 之间的想法选区完全覆盖（如单独标注的「，」）。
 * 未标注的标点/空白不在此列。
 */
function isGapFullyCoveredByAnnotatedThoughts(
	earlier: Range,
	later: Range,
	allRanges: Range[],
): boolean {
	const gapRange = buildGapRangeBetween(earlier, later);
	if (!gapRange) return false;
	if (gapRange.collapsed) return true;

	const gapNorm = normalizeGapText(gapRange.toString());
	if (gapNorm.length === 0) return false;

	const inGapRanges = allRanges.filter((range) =>
		isRangeStrictlyBetween(earlier, later, range),
	);
	if (inGapRanges.length === 0) return false;

	const union = mergeDomRangeUnion(inGapRanges);
	if (!union) return false;
	return normalizeGapText(union.toString()) === gapNorm;
}

/** 存在跨间隙选区同时搭接 A、B（如跨行选中 C+换行+D） */
function isBridgedBySpanningThought(
	earlier: Range,
	later: Range,
	earlierCfi: string,
	laterCfi: string,
	allRanges: Range[],
	allCfis: string[],
): boolean {
	const gapRange = buildGapRangeBetween(earlier, later);
	for (let i = 0; i < allRanges.length; i++) {
		const cfi = allCfis[i];
		if (!cfi || cfi === earlierCfi || cfi === laterCfi) continue;
		const span = allRanges[i]!;
		if (!doRangesTouchOrOverlap(earlier, span)) continue;
		if (!doRangesTouchOrOverlap(later, span)) continue;
		if (!gapRange || gapRange.collapsed) return true;
		if (rangeIntersectsGap(span, gapRange)) return true;
	}
	return false;
}

/**
 * 两想法 CFI 是否连通：相交/嵌套；或间隙被已标注想法覆盖；或跨行选区搭接两侧。
 * 未单独标注的标点/空白/换行不连通。
 */
function areThoughtCfisConnected(
	rend: Rendition,
	leftCfi: string,
	rightCfi: string,
	leftGroup: EbookThought[],
	rightGroup: EbookThought[],
	leftRange: Range,
	rightRange: Range,
	allRanges: Range[],
	allCfis: string[],
): boolean {
	if (leftCfi === rightCfi) return true;
	if (
		leftRange.startContainer.ownerDocument !==
		rightRange.startContainer.ownerDocument
	) {
		return false;
	}
	if (doRangesTouchOrOverlap(leftRange, rightRange)) return true;
	if (isNestedEitherWay(rend, leftCfi, rightCfi, leftGroup, rightGroup)) {
		return true;
	}
	if (isGapFullyCoveredByAnnotatedThoughts(leftRange, rightRange, allRanges)) {
		return true;
	}
	return isBridgedBySpanningThought(
		leftRange,
		rightRange,
		leftCfi,
		rightCfi,
		allRanges,
		allCfis,
	);
}

/** 从 CFI 提取 spine 路径，用于限定同章节候选集 */
export function extractCfiSpineHint(cfiRange: string): string {
	const match = cfiRange.match(/epubcfi\(([^!]+)!/);
	return match?.[1] ?? cfiRange;
}

/** 切换书籍时清空章节连通图缓存 */
export function invalidateThoughtClusterConnectivityCache(): void {
	chapterConnectivityCache = null;
}

type ChapterConnectivityCache = {
	key: string;
	adj: Map<string, Set<string>>;
};

let chapterConnectivityCache: ChapterConnectivityCache | null = null;

/** 仅保留与 spine 同章节的 CFI */
function filterCfisBySpineHint(
	byCfi: Map<string, EbookThought[]>,
	spineHint: string,
): string[] {
	return [...byCfi.keys()].filter(
		(cfi) => extractCfiSpineHint(cfi) === spineHint,
	);
}

function buildChapterConnectivityCacheKey(
	byCfi: Map<string, EbookThought[]>,
	spineHint: string,
): string {
	return `${CONNECTIVITY_GRAPH_VERSION}\0${spineHint}\0${filterCfisBySpineHint(byCfi, spineHint).sort().join('\0')}`;
}

/** 文档序稀疏建图：只比较相邻 + 可能重叠的对，等价于全量 O(m²) */
function buildThoughtConnectivityAdjacency(
	rend: Rendition,
	byCfi: Map<string, EbookThought[]>,
	sortedCfis: string[],
	resolved: Map<string, Range>,
): Map<string, Set<string>> {
	const adj = new Map<string, Set<string>>();
	for (const cfi of sortedCfis) {
		adj.set(cfi, new Set());
	}

	const allRanges = sortedCfis.map((cfi) => resolved.get(cfi)!);

	for (let i = 0; i < sortedCfis.length; i++) {
		const cfiA = sortedCfis[i]!;
		const rangeA = resolved.get(cfiA)!;
		const groupA = byCfi.get(cfiA) ?? [];
		for (let j = i + 1; j < sortedCfis.length; j++) {
			const cfiB = sortedCfis[j]!;
			const rangeB = resolved.get(cfiB)!;
			const groupB = byCfi.get(cfiB) ?? [];
			const adjacent = j === i + 1;
			if (!adjacent) {
				try {
					if (rangeA.compareBoundaryPoints(Range.END_TO_START, rangeB) < 0) {
						const gapBridged =
							isGapFullyCoveredByAnnotatedThoughts(rangeA, rangeB, allRanges) ||
							isBridgedBySpanningThought(
								rangeA,
								rangeB,
								cfiA,
								cfiB,
								allRanges,
								sortedCfis,
							);
						if (!gapBridged) break;
					} else if (!doRangesTouchOrOverlap(rangeA, rangeB)) {
						continue;
					}
				} catch {
					continue;
				}
			}
			if (
				!areThoughtCfisConnected(
					rend,
					cfiA,
					cfiB,
					groupA,
					groupB,
					rangeA,
					rangeB,
					allRanges,
					sortedCfis,
				)
			) {
				continue;
			}
			adj.get(cfiA)!.add(cfiB);
			adj.get(cfiB)!.add(cfiA);
		}
	}
	return adj;
}

function getChapterConnectivityAdjacency(
	rend: Rendition,
	byCfi: Map<string, EbookThought[]>,
	spineHint: string,
): Map<string, Set<string>> {
	const key = buildChapterConnectivityCacheKey(byCfi, spineHint);
	if (chapterConnectivityCache?.key === key) {
		return chapterConnectivityCache.adj;
	}

	const scopedCfis = filterCfisBySpineHint(byCfi, spineHint);
	const resolved = new Map<string, Range>();
	const sortedCfis: string[] = [];

	for (const cfi of scopedCfis) {
		const range = resolveCfiDomRange(rend, cfi);
		if (!range) continue;
		resolved.set(cfi, range);
		sortedCfis.push(cfi);
	}

	sortedCfis.sort((a, b) =>
		resolved
			.get(a)!
			.compareBoundaryPoints(Range.START_TO_START, resolved.get(b)!),
	);

	const adj = buildThoughtConnectivityAdjacency(
		rend,
		byCfi,
		sortedCfis,
		resolved,
	);
	chapterConnectivityCache = { key, adj };
	return adj;
}

/**
 * 从 seed CFI 出发，收集连通闭包（相交/嵌套/已标注间隙覆盖/跨行搭接）。
 */
function collectConnectedClosureAroundCfis(
	rend: Rendition,
	byCfi: Map<string, EbookThought[]>,
	seedCfis: string[],
): Set<string> {
	const result = new Set<string>();
	for (const cfi of seedCfis) {
		const key = cfi.trim();
		if (key) result.add(key);
	}
	if (result.size === 0) return result;

	const spineHint = extractCfiSpineHint([...result][0]!);
	const adj = getChapterConnectivityAdjacency(rend, byCfi, spineHint);

	const queue = [...result];
	while (queue.length > 0) {
		const cfi = queue.shift()!;
		for (const next of adj.get(cfi) ?? []) {
			if (result.has(next)) continue;
			result.add(next);
			queue.push(next);
		}
	}

	return result;
}

/** 相交或端点相接（端点相接时间隙无未标注字符） */
function doRangesTouchOrOverlap(a: Range, b: Range): boolean {
	try {
		if (a.startContainer.ownerDocument !== b.startContainer.ownerDocument) {
			return false;
		}
		return (
			a.compareBoundaryPoints(Range.END_TO_START, b) >= 0 &&
			a.compareBoundaryPoints(Range.START_TO_END, b) <= 0
		);
	} catch {
		return false;
	}
}

function mergeDomRangeUnion(ranges: Range[]): Range | null {
	if (ranges.length === 0) return null;
	try {
		const union = ranges[0].cloneRange();
		for (let i = 1; i < ranges.length; i++) {
			const range = ranges[i]!;
			if (union.compareBoundaryPoints(Range.START_TO_START, range) > 0) {
				union.setStart(range.startContainer, range.startOffset);
			}
			if (union.compareBoundaryPoints(Range.END_TO_END, range) < 0) {
				union.setEnd(range.endContainer, range.endOffset);
			}
		}
		return union;
	} catch {
		return null;
	}
}

/** 多分组 cluster：引用区为 DOM 并集文本；primaryCfi 取 span 最长分组（避免 union→CFI 回写） */
function pickPrimaryCfiFromQuoteGroups(
	quoteGroups: EbookThoughtQuoteGroup[],
): string {
	let primaryCfi = quoteGroups[0]?.cfiRange ?? '';
	let primarySpan = -1;
	for (const group of quoteGroups) {
		if (group.spanLength > primarySpan) {
			primarySpan = group.spanLength;
			primaryCfi = group.cfiRange;
		}
	}
	return primaryCfi;
}

function resolveClusterPrimaryDisplay(
	rend: Rendition | undefined,
	quoteGroups: EbookThoughtQuoteGroup[],
	resolvedByCfi?: Map<string, Range | null>,
): { primaryCfiRange: string; primaryQuote: string } {
	const fallback = quoteGroups[0]!;
	if (!rend || quoteGroups.length <= 1) {
		return {
			primaryCfiRange: fallback.cfiRange,
			primaryQuote: fallback.quote,
		};
	}

	const ranges = quoteGroups
		.map((group) => {
			const cached = resolvedByCfi?.get(group.cfiRange);
			if (cached !== undefined) return cached;
			return resolveCfiDomRange(rend, group.cfiRange);
		})
		.filter((range): range is Range => range !== null);
	if (ranges.length === 0) {
		return {
			primaryCfiRange: fallback.cfiRange,
			primaryQuote: fallback.quote,
		};
	}

	const union = mergeDomRangeUnion(ranges);
	const unionQuote = union?.toString().trim();
	if (!unionQuote) {
		return {
			primaryCfiRange: fallback.cfiRange,
			primaryQuote: fallback.quote,
		};
	}

	return {
		primaryCfiRange: pickPrimaryCfiFromQuoteGroups(quoteGroups),
		primaryQuote: unionQuote,
	};
}

export function buildThoughtClickCluster(
	rend: Rendition | undefined,
	allThoughts: EbookThought[],
	hitCfis: string[],
	selectedThoughtId?: string,
): EbookThoughtClickCluster | null {
	const byCfi = groupThoughtsByCfi(allThoughts);
	const quoteGroups: EbookThoughtQuoteGroup[] = [];

	for (const cfi of hitCfis) {
		const key = cfi.trim();
		if (!key) continue;
		const group = byCfi.get(key);
		if (!group || group.length === 0) continue;
		quoteGroups.push(buildQuoteGroup(key, group));
	}

	if (quoteGroups.length === 0) return null;

	const resolvedByCfi = new Map<string, Range | null>();
	if (rend) {
		for (const cfi of hitCfis) {
			const key = cfi.trim();
			if (!key || resolvedByCfi.has(key)) continue;
			resolvedByCfi.set(key, resolveCfiDomRange(rend, key));
		}
	}

	sortQuoteGroupsByNewestThoughtDesc(quoteGroups);

	const primaryDisplay = resolveClusterPrimaryDisplay(
		rend,
		quoteGroups,
		resolvedByCfi,
	);
	const flattenedThoughts = quoteGroups.flatMap((group) => group.thoughts);
	return {
		primaryCfiRange: primaryDisplay.primaryCfiRange,
		primaryQuote: primaryDisplay.primaryQuote,
		quoteGroups,
		allThoughts: sortThoughtsByCreatedAtDesc(flattenedThoughts),
		selectedThoughtId,
	};
}

function withThoughtClusterSyncScope<T>(fn: () => T): T {
	beginEpubAnnotationSyncScope();
	try {
		return fn();
	} finally {
		endEpubAnnotationSyncScope();
	}
}

export function buildThoughtClickClusterFromCandidates(
	rend: Rendition,
	allThoughts: EbookThought[],
	candidates: EbookThought[],
): EbookThoughtClickCluster | null {
	if (candidates.length === 0) return null;

	const hitAtClickCfis = [
		...new Set(
			candidates.map((thought) => thought.cfiRange.trim()).filter(Boolean),
		),
	];

	const byCfi = groupThoughtsByCfi(allThoughts);
	return withThoughtClusterSyncScope(() => {
		const hitCfis = [
			...collectConnectedClosureAroundCfis(rend, byCfi, hitAtClickCfis),
		];
		return buildThoughtClickCluster(rend, allThoughts, hitCfis);
	});
}

export function expandClusterFromMarkSeed(
	rend: Rendition,
	allThoughts: EbookThought[],
	seedThoughts: EbookThought[],
	_isClickInCfi?: (cfi: string) => boolean,
): EbookThoughtClickCluster | null {
	if (seedThoughts.length === 0) return null;

	const seedCfis = [
		...new Set(
			seedThoughts.map((thought) => thought.cfiRange.trim()).filter(Boolean),
		),
	];
	if (seedCfis.length === 0) return null;

	const byCfi = groupThoughtsByCfi(allThoughts);
	return withThoughtClusterSyncScope(() => {
		const hitCfis = [
			...collectConnectedClosureAroundCfis(rend, byCfi, seedCfis),
		];
		return buildThoughtClickCluster(rend, allThoughts, hitCfis);
	});
}

export function buildSingleCfiCluster(
	allThoughts: EbookThought[],
	cfiRange: string,
	selectedThoughtId?: string,
): EbookThoughtClickCluster | null {
	const key = cfiRange.trim();
	if (!key) return null;
	return buildThoughtClickCluster(
		undefined,
		allThoughts,
		[key],
		selectedThoughtId,
	);
}

export function reconcileThoughtClickCluster(
	cluster: EbookThoughtClickCluster,
	allThoughts: EbookThought[],
	rend?: Rendition,
): EbookThoughtClickCluster | null {
	const hitCfis = cluster.quoteGroups.map((group) => group.cfiRange);
	const selectedThoughtId =
		cluster.selectedThoughtId &&
		allThoughts.some((thought) => thought.id === cluster.selectedThoughtId)
			? cluster.selectedThoughtId
			: undefined;

	return rend
		? withThoughtClusterSyncScope(() =>
				buildThoughtClickCluster(rend, allThoughts, hitCfis, selectedThoughtId),
			)
		: buildThoughtClickCluster(rend, allThoughts, hitCfis, selectedThoughtId);
}

export function getThoughtClusterDisplayQuote(
	cluster: EbookThoughtClickCluster,
): string {
	if (cluster.selectedThoughtId) {
		const selected = cluster.allThoughts.find(
			(thought) => thought.id === cluster.selectedThoughtId,
		);
		if (selected?.quote.trim()) return selected.quote;
	}
	return cluster.primaryQuote;
}

export function getThoughtClusterDisplayCfi(
	cluster: EbookThoughtClickCluster,
): string {
	if (cluster.selectedThoughtId) {
		const selected = cluster.allThoughts.find(
			(thought) => thought.id === cluster.selectedThoughtId,
		);
		if (selected?.cfiRange.trim()) return selected.cfiRange.trim();
	}
	return cluster.primaryCfiRange;
}

/** 侧栏引用区划线判定/操作所用的 CFI + quote（聚合引用时用 DOM 并集，避免 partial 误判） */
export function getThoughtClusterHighlightSubject(
	cluster: EbookThoughtClickCluster,
	rend?: Rendition,
): { cfiRange: string; quote: string } {
	const quote = getThoughtClusterDisplayQuote(cluster).trim();
	const cfiRange = getThoughtClusterDisplayCfi(cluster);
	if (!rend || !quote) return { cfiRange, quote };

	if (cluster.quoteGroups.length > 1 && !cluster.selectedThoughtId) {
		const ranges = cluster.quoteGroups
			.map((group) => resolveCfiDomRange(rend, group.cfiRange))
			.filter((range): range is Range => range !== null);
		const union = mergeDomRangeUnion(ranges);
		const unionQuote = union?.toString().trim();
		if (union && unionQuote && unionQuote === quote) {
			const unionCfi = cfiFromDomRange(rend, union);
			if (unionCfi) {
				return { cfiRange: unionCfi, quote: unionQuote };
			}
		}
	}

	return { cfiRange, quote };
}
