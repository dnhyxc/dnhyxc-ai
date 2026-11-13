/**
 * 单词解析在主站侧的会话。插件不能直接改抽屉，卡片、列表和顶栏都通过这里对齐。
 *
 * 解析抽屉：记下当前词和打开来源。卡片上再点同一个词会关掉；从列表或导入列表点词只打开。
 * 列表顶替详解时做标记，详解抽屉不再播退场，避免和列表的滑入叠在一起。
 * 生成中的词单独记着，关抽屉或换词都不清，请求结束才清，卡片上的状态才能对上。
 * 解析列表：记下当前词库，以及「共 n 条 / 已加载 m 条」，供列表插件拉数据和顶栏展示。
 */
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

// 解析列表当前词库；插件只需要 id，标题由主站抽屉自己拿
export type VocabDetailListLibrary = { libraryId: string };

// 词汇库页选中的库；没进词库页或已离开时为 null
let listLibrary: VocabDetailListLibrary | null = null;
// 列表插件订阅词库切换，用来清空并重拉第一页
const listLibraryListeners = new Set<() => void>();

// 词汇库页随路由 libraryId 写入或清空；离开页面时在清理函数里传 null
export function setVocabDetailListLibrary(
	target: VocabDetailListLibrary | null,
): void {
	// 空白 id 当成没有词库，避免插件用空串去请求列表
	const id = target?.libraryId.trim() ?? '';
	// 只保留 trim 后的 id，丢掉调用方多带的字段
	const next = id ? { libraryId: id } : null;
	// 同一本库重复写入不通知，否则列表插件会把已加载的页清掉重来
	if ((listLibrary?.libraryId ?? '') === (next?.libraryId ?? '')) return;
	listLibrary = next;
	// 拷贝一份再通知，避免某个监听器退订时改到正在遍历的 Set
	for (const listener of [...listLibraryListeners]) listener();
}

// 给列表插件读当前词库；返回副本，插件改返回值不会写回这里
export function getListLibrary(): VocabDetailListLibrary | null {
	return listLibrary ? { libraryId: listLibrary.libraryId } : null;
}

// 词库变化时回调；返回的函数在插件卸载时退订
export function subscribeListLibrary(listener: () => void): () => void {
	listLibraryListeners.add(listener);
	// 退订只删这一个监听，不影响其它仍开着的列表抽屉
	return () => listLibraryListeners.delete(listener);
}
