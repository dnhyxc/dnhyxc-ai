export type VocabDetailSource = 'card' | 'list';

export type VocabCardSnapshot = {
	word: string;
	pos?: string | null;
	ipa?: string | null;
	translationZh?: string | null;
	example?: string | null;
	/** 列表点进来才铺 Loading；卡片打开沿用词头。 */
	source?: VocabDetailSource;
};

export type VocabDetailSession = {
	open: boolean;
	pluginId: string | null;
	card: VocabCardSnapshot | null;
};

let session: VocabDetailSession = { open: false, pluginId: null, card: null };
/** 列表顶替详解：详解抽屉不要再播退场，否则两个右滑叠在一起，列表 Loading 会偏右。 */
let replacedByList = false;
const listeners = new Set<() => void>();
const pendingLemmas = new Set<string>();
const pendingListeners = new Set<() => void>();

function lemmaKey(word: string): string {
	return word.trim().replace(/\s+/g, ' ').toLowerCase();
}

function sameLemma(a: string, b: string): boolean {
	const left = a.trim().replace(/\s+/g, ' ').toLowerCase();
	const right = b.trim().replace(/\s+/g, ' ').toLowerCase();
	return left.length > 0 && left === right;
}

function emit(): void {
	for (const listener of [...listeners]) listener();
}

export function readVocabDetailSession(): VocabDetailSession {
	return {
		open: session.open,
		pluginId: session.pluginId,
		card: session.card ? { ...session.card } : null,
	};
}

/** 再点同一插件的同一个词则关闭，换词则替换快照。 */
export function openVocabDetail(
	pluginId: string,
	card: VocabCardSnapshot,
): void {
	if (!card.word.trim()) return;
	if (
		session.open &&
		session.pluginId === pluginId &&
		session.card &&
		sameLemma(session.card.word, card.word)
	) {
		closeVocabDetail();
		return;
	}
	replacedByList = false;
	session = { open: true, pluginId, card: { ...card, source: 'card' } };
	emit();
}

/** 列表点词：只打开。同一词再点也不关闭。 */
export function showVocabDetail(
	pluginId: string,
	card: VocabCardSnapshot,
): void {
	if (!card.word.trim()) return;
	replacedByList = false;
	session = { open: true, pluginId, card: { ...card, source: 'list' } };
	emit();
}

export function markVocabDetailReplacedByList(): void {
	replacedByList = true;
}

export function vocabDetailReplacedByList(): boolean {
	return replacedByList;
}

export function closeVocabDetail(): void {
	session = { open: false, pluginId: null, card: null };
	emit();
}

export function getSnapshot(): VocabCardSnapshot | null {
	return session.card ? { ...session.card } : null;
}

export function subscribeVocabDetail(listener: () => void): () => void {
	listeners.add(listener);
	return () => listeners.delete(listener);
}

/** 该词的详解请求还在飞。关抽屉、换词都不清掉，请求结束才清。 */
export function setVocabDetailPending(word: string, pending: boolean): void {
	const key = lemmaKey(word);
	if (!key) return;
	const has = pendingLemmas.has(key);
	if (pending === has) return;
	if (pending) pendingLemmas.add(key);
	else pendingLemmas.delete(key);
	for (const listener of [...pendingListeners]) listener();
}

export function isVocabDetailPending(word: string): boolean {
	return pendingLemmas.has(lemmaKey(word));
}

export function subscribeVocabDetailPending(listener: () => void): () => void {
	pendingListeners.add(listener);
	return () => pendingListeners.delete(listener);
}

export type VocabDetailListStats = { total: number; loaded: number };

let listStats: VocabDetailListStats | null = null;
const listStatsListeners = new Set<() => void>();

export function readVocabDetailListStats(): VocabDetailListStats | null {
	return listStats ? { ...listStats } : null;
}

export function setVocabDetailListStats(
	next: VocabDetailListStats | null,
): void {
	listStats = next ? { total: next.total, loaded: next.loaded } : null;
	for (const listener of [...listStatsListeners]) listener();
}

export function subscribeVocabDetailListStats(
	listener: () => void,
): () => void {
	listStatsListeners.add(listener);
	return () => listStatsListeners.delete(listener);
}
