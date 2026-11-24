/**
 * 单词卡 / 语句卡右上角单条标注。
 * 进行中画停止方块；卸载不取消，刷新靠服务端在途名单把图标画回来。
 */

import { Button, Toast } from '@ui/index';
import { Square, WholeWord } from 'lucide-react';
import { useSyncExternalStore } from 'react';
import { useI18n } from '@/hooks';
import { translateSync } from '@/i18n';
import { cn } from '@/lib/utils';
import {
	cancelEnglishVocabDetail,
	cancelReannotateEnglishSentenceWords,
	getCardAnnotateRunning,
	reannotateEnglishSentenceWords,
	regenerateEnglishVocabDetail,
} from '@/service';
import { dropSentenceWordAnnotationCache } from '@/views/englishLearning/practice/utils/sentenceWordAnnotationCache';

type Kind = 'sentence' | 'word';

type Snap = { sentences: string[]; words: string[] };

const EMPTY: Snap = { sentences: [], words: [] };

/**
 * 服务端名单与本地乐观项合并。
 * 请求已经结束、服务端也没有的项，视为这一轮结束。
 */
function reconcileRunning(
	server: readonly string[],
	optimistic: readonly string[],
	settled: ReadonlySet<string>,
): { view: string[]; finished: string[] } {
	const finished: string[] = [];
	const view = [...server];
	for (const item of optimistic) {
		if (server.includes(item)) continue;
		if (settled.has(item)) {
			finished.push(item);
			continue;
		}
		view.push(item);
	}
	return { view, finished };
}

{
	const settled = new Set(['gone']);
	const merged = reconcileRunning(['keep'], ['keep', 'gone', 'wait'], settled);
	if (
		merged.finished.length !== 1 ||
		merged.finished[0] !== 'gone' ||
		merged.view.length !== 2 ||
		!merged.view.includes('keep') ||
		!merged.view.includes('wait')
	) {
		throw new Error('reconcileRunning');
	}
}

let serverSnap: Snap = EMPTY;
let viewSnap: Snap = EMPTY;
const optimisticSentences = new Set<string>();
const optimisticWords = new Set<string>();
const settledSentences = new Set<string>();
const settledWords = new Set<string>();
const listeners = new Set<() => void>();
/** 开始请求还没返回时，停止先记在这里，返回后再断开，避免停止比开始先到服务端。 */
const startLock = new Set<string>();
const stopAfterStart = new Set<string>();
let timer: ReturnType<typeof setInterval> | null = null;
let refreshing: Promise<Set<string>> | null = null;

function toastAnnotate(ok: boolean) {
	Toast({
		type: ok ? 'success' : 'error',
		title: translateSync(
			ok
				? 'englishLearning.cardAnnotate.success'
				: 'englishLearning.cardAnnotate.failed',
		),
	});
}

function toastFinished(
	rows: { id: string; ok: boolean }[] | undefined,
	kind: Kind,
	toasted: Set<string>,
) {
	for (const row of rows ?? []) {
		toastAnnotate(row.ok);
		toasted.add(`${kind}:${row.id.trim().toLowerCase()}`);
	}
}

function sentenceId(text: string): string {
	return text.trim().toLowerCase();
}

function wordId(text: string): string {
	return text.trim().replace(/\s+/g, ' ').toLowerCase();
}

function same(a: Snap, b: Snap): boolean {
	return (
		a.sentences.join('\0') === b.sentences.join('\0') &&
		a.words.join('\0') === b.words.join('\0')
	);
}

function emit() {
	for (const fn of listeners) fn();
}

function publish() {
	const next: Snap = {
		sentences: reconcileRunning(
			serverSnap.sentences,
			[...optimisticSentences],
			settledSentences,
		).view,
		words: reconcileRunning(
			serverSnap.words,
			[...optimisticWords],
			settledWords,
		).view,
	};
	if (same(viewSnap, next)) return;
	viewSnap = next;
	emit();
	if (next.sentences.length > 0 || next.words.length > 0) {
		if (timer == null) timer = setInterval(() => void refresh(), 2000);
		return;
	}
	if (timer != null) {
		clearInterval(timer);
		timer = null;
	}
}

function applyServer(next: Snap) {
	for (const english of serverSnap.sentences) {
		if (!next.sentences.includes(english))
			dropSentenceWordAnnotationCache(english);
	}
	const sentenceDone = reconcileRunning(
		next.sentences,
		[...optimisticSentences],
		settledSentences,
	).finished;
	for (const english of sentenceDone) {
		optimisticSentences.delete(english);
		settledSentences.delete(english);
		dropSentenceWordAnnotationCache(english);
	}
	const wordDone = reconcileRunning(
		next.words,
		[...optimisticWords],
		settledWords,
	).finished;
	for (const word of wordDone) {
		optimisticWords.delete(word);
		settledWords.delete(word);
	}
	for (const english of [...optimisticSentences]) {
		if (next.sentences.includes(english)) {
			optimisticSentences.delete(english);
			settledSentences.delete(english);
		}
	}
	for (const word of [...optimisticWords]) {
		if (next.words.includes(word)) {
			optimisticWords.delete(word);
			settledWords.delete(word);
		}
	}
	serverSnap = next;
	publish();
}

function refresh(): Promise<Set<string>> {
	if (refreshing) return refreshing;
	refreshing = getCardAnnotateRunning()
		.then((res) => {
			const toasted = new Set<string>();
			toastFinished(res.data?.finished?.sentences, 'sentence', toasted);
			toastFinished(res.data?.finished?.words, 'word', toasted);
			applyServer({
				sentences: (res.data?.sentences ?? []).map((item) =>
					item.trim().toLowerCase(),
				),
				words: (res.data?.words ?? []).map((item) => item.trim().toLowerCase()),
			});
			return toasted;
		})
		.catch(() => new Set<string>())
		.finally(() => {
			refreshing = null;
		});
	return refreshing;
}

async function refreshAfter(): Promise<Set<string>> {
	const seen = refreshing ? await refreshing : new Set<string>();
	const next = await refresh();
	return new Set([...seen, ...next]);
}

function subscribeCardAnnotate(onStoreChange: () => void) {
	listeners.add(onStoreChange);
	void refresh();
	return () => {
		listeners.delete(onStoreChange);
	};
}

function getCardAnnotateSnapshot(): Snap {
	return viewSnap;
}

function lockId(kind: Kind, id: string): string {
	return `${kind}:${id}`;
}

async function cancelCardAnnotate(kind: Kind, text: string): Promise<void> {
	if (kind === 'sentence') await cancelReannotateEnglishSentenceWords(text);
	else await cancelEnglishVocabDetail(text);
}

async function toggleCardAnnotate(kind: Kind, text: string): Promise<void> {
	const id = kind === 'sentence' ? sentenceId(text) : wordId(text);
	if (!id) return;
	const lock = lockId(kind, id);
	const running = (
		kind === 'sentence' ? viewSnap.sentences : viewSnap.words
	).includes(id);
	if (running) {
		if (startLock.has(lock)) {
			stopAfterStart.add(lock);
			return;
		}
		try {
			await cancelCardAnnotate(kind, text);
		} finally {
			await refreshAfter();
		}
		return;
	}
	if (startLock.has(lock)) return;
	if (kind === 'sentence') optimisticSentences.add(id);
	else optimisticWords.add(id);
	startLock.add(lock);
	publish();
	let accepted = false;
	try {
		if (kind === 'sentence') await reannotateEnglishSentenceWords(text);
		else await regenerateEnglishVocabDetail(text);
		accepted = true;
	} catch {
		accepted = false;
	} finally {
		startLock.delete(lock);
		if (kind === 'sentence') settledSentences.add(id);
		else settledWords.add(id);
		const stopped = stopAfterStart.delete(lock);
		if (stopped) {
			try {
				await cancelCardAnnotate(kind, text);
			} catch {
				// 停止失败时名单里还在，图标保持停止
			}
		}
		const toasted = await refreshAfter();
		if (!stopped && !accepted && !toasted.has(lock)) toastAnnotate(false);
	}
}

export function AnnotateButton({ kind, text }: { kind: Kind; text: string }) {
	const { t } = useI18n();
	const snap = useSyncExternalStore(
		subscribeCardAnnotate,
		getCardAnnotateSnapshot,
		getCardAnnotateSnapshot,
	);
	const id = kind === 'sentence' ? sentenceId(text) : wordId(text);
	const running = (kind === 'sentence' ? snap.sentences : snap.words).includes(
		id,
	);
	return (
		<Button
			type="button"
			variant="ghost"
			size="sm"
			onClick={(event) => {
				event.stopPropagation();
				void toggleCardAnnotate(kind, text);
			}}
			className={cn(
				'h-7 w-7 shrink-0 rounded-md border p-0 transition-colors',
				running
					? 'border-teal-500/40 bg-teal-500/15 text-teal-500'
					: 'border-theme/10 text-textcolor/65 hover:border-teal-500/15 hover:bg-teal-500/10 hover:text-teal-500',
			)}
			aria-label={
				running
					? t('englishLearning.cardAnnotate.stop')
					: t('englishLearning.cardAnnotate.action')
			}
		>
			{running ? (
				<Square className="size-3.5 fill-current" aria-hidden />
			) : (
				<WholeWord className="size-4.5" aria-hidden />
			)}
		</Button>
	);
}
