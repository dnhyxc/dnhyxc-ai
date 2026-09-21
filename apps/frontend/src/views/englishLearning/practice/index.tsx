/**
 * 单词听写 / 拼写练习 — 路由页（index）
 */
import { Toast } from '@ui/index';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { useI18n } from '@/hooks';
import { stopAllPlayback } from '@/utils/speech';
import { PracticePageShell } from './components/shell';
import { PracticeShortcutsMenu } from './components/shell/PracticeShortcutsMenu';
import { Session } from './Session';
import { Setup } from './Setup';
import { Summary } from './Summary';
import type {
	PracticeAttemptResult,
	PracticeCountOption,
	PracticeItem,
	PracticeMode,
	PracticePhase,
	PracticeSessionCursor,
	PracticeSetupConfig,
	PracticeSource,
} from './types';
import { fetchPracticeContinueQueue } from './utils/fetchWords';
import { isPracticeClassicItem, parsePracticeContentKind } from './utils/item';
import { parsePracticePoolTotal } from './utils/paths';
import { segmentEnglishSentence } from './utils/segmentSentence';
import { prefetchSentenceWordAnnotationsBatch } from './utils/sentenceWordAnnotationCache';

function parseSource(raw: string | null): PracticeSource {
	if (
		raw === 'library' ||
		raw === 'pack' ||
		raw === 'live' ||
		raw === 'mistakes' ||
		raw === 'dailyMemorize' ||
		raw === 'review'
	) {
		return raw;
	}
	return 'favorites';
}

function parseMode(raw: string | null): PracticeMode {
	return raw === 'spelling' ? 'spelling' : 'dictation';
}

function mergePracticedKeys(prev: string[], items: PracticeItem[]): string[] {
	const set = new Set(prev);
	for (const item of items) {
		if (item.key) set.add(item.key);
	}
	return [...set];
}

export default function EnglishLearningPracticePage() {
	const { t } = useI18n();
	const navigate = useNavigate();
	const [searchParams, setSearchParams] = useSearchParams();

	const initialContentKind = useMemo(
		() => parsePracticeContentKind(searchParams.get('contentKind')),
		[searchParams],
	);
	const initialSource = useMemo(
		() => parseSource(searchParams.get('source')),
		[searchParams],
	);
	const initialMode = useMemo(
		() => parseMode(searchParams.get('mode')),
		[searchParams],
	);
	const initialLibraryId = searchParams.get('libraryId') ?? undefined;
	const initialStreamId = searchParams.get('streamId') ?? undefined;
	const initialSourceTitle = searchParams.get('sourceTitle') ?? undefined;
	const initialPoolTotal = useMemo(
		() => parsePracticePoolTotal(searchParams.get('poolTotal')),
		[searchParams],
	);
	const initialReturnStreamId =
		searchParams.get('returnStreamId')?.trim() || undefined;
	const returnToHome = searchParams.get('returnTo') === 'home';

	const [phase, setPhase] = useState<PracticePhase>('setup');
	const [config, setConfig] = useState<PracticeSetupConfig | null>(null);
	const [queue, setQueue] = useState<PracticeItem[]>([]);
	const [index, setIndex] = useState(0);
	const [results, setResults] = useState<PracticeAttemptResult[]>([]);
	const [sessionCursor, setSessionCursor] =
		useState<PracticeSessionCursor | null>(null);
	const [practicedKeys, setPracticedKeys] = useState<string[]>([]);
	const [continueLoading, setContinueLoading] = useState(false);

	useEffect(() => {
		return () => stopAllPlayback();
	}, []);

	const onExit = useCallback(() => {
		stopAllPlayback();
		if (returnToHome) {
			navigate('/english-learning');
			return;
		}
		const kind = initialContentKind;
		if (initialSource === 'favorites') {
			navigate(
				`/english-learning/favorites?kind=${kind === 'classic' ? 'classic' : 'vocab'}`,
			);
			return;
		}
		if (initialSource === 'library') {
			navigate(
				`/english-learning/library?kind=${kind === 'classic' ? 'classic' : 'vocab'}`,
			);
			return;
		}
		if (initialSource === 'mistakes') {
			navigate(
				kind === 'classic'
					? '/english-learning/mistakes?kind=classic'
					: '/english-learning/mistakes?kind=vocab',
			);
			return;
		}
		if (initialSource === 'dailyMemorize') {
			navigate('/english-learning/daily/records');
			return;
		}
		if (initialSource === 'review') {
			navigate(
				kind === 'classic'
					? '/english-learning/review?kind=classic'
					: '/english-learning/review?kind=vocab',
			);
			return;
		}
		if (initialSource === 'pack') {
			const backStreamId = initialReturnStreamId || initialStreamId;
			if (backStreamId) {
				navigate(
					`/english-learning/stream?kind=${kind === 'classic' ? 'classic' : 'vocab'}&streamId=${encodeURIComponent(backStreamId)}`,
				);
				return;
			}
		}
		navigate('/english-learning');
	}, [
		initialContentKind,
		initialReturnStreamId,
		initialSource,
		initialStreamId,
		navigate,
		returnToHome,
	]);

	const skipRunResetRef = useRef(false);

	const markPracticeRunning = useCallback(
		(mode: PracticeMode) => {
			skipRunResetRef.current = true;
			setSearchParams(
				(prev) => {
					const next = new URLSearchParams(prev);
					next.set('mode', mode);
					next.set('run', '1');
					return next;
				},
				{ replace: true },
			);
		},
		[setSearchParams],
	);

	const clearPracticeRunning = useCallback(() => {
		setSearchParams(
			(prev) => {
				if (!prev.has('run')) return prev;
				const next = new URLSearchParams(prev);
				next.delete('run');
				return next;
			},
			{ replace: true },
		);
	}, [setSearchParams]);

	const resetToSetup = useCallback(() => {
		stopAllPlayback();
		setPhase('setup');
		setConfig(null);
		setQueue([]);
		setIndex(0);
		setResults([]);
		setSessionCursor(null);
		setPracticedKeys([]);
	}, []);

	const onStarted = useCallback(
		(
			items: PracticeItem[],
			setup: PracticeSetupConfig,
			cursor: PracticeSessionCursor,
		) => {
			setConfig(setup);
			setSessionCursor(cursor);
			setPracticedKeys(items.map((i) => i.key).filter(Boolean));
			setQueue(items);
			setIndex(0);
			setResults([]);
			markPracticeRunning(setup.mode);
			setPhase('running');

			// 经典句：开局先 cacheOnly 灌内存，miss 再异步补模型
			const classicItems = items.filter(isPracticeClassicItem);
			if (classicItems.length > 0) {
				prefetchSentenceWordAnnotationsBatch(
					classicItems.map((it) => ({
						english: it.english,
						words: segmentEnglishSentence(it.english).map((t) => t.raw),
					})),
				);
			}
		},
		[markPracticeRunning],
	);

	const onRetryWrong = useCallback(
		(wrongQueue: PracticeItem[]) => {
			if (!config || wrongQueue.length === 0) return;
			const n = wrongQueue.length;
			const stepped = Math.ceil(n / 10) * 10;
			const count = Math.min(100, Math.max(10, stepped)) as PracticeCountOption;
			const nextConfig: PracticeSetupConfig = {
				...config,
				contentKind: config.contentKind,
				count,
			};
			setConfig(nextConfig);
			setPracticedKeys((prev) => mergePracticedKeys(prev, wrongQueue));
			setQueue(wrongQueue);
			setIndex(0);
			setResults([]);
			setPhase('running');
			markPracticeRunning(nextConfig.mode);
			const classicItems = wrongQueue.filter(isPracticeClassicItem);
			if (classicItems.length > 0) {
				prefetchSentenceWordAnnotationsBatch(
					classicItems.map((it) => ({
						english: it.english,
						words: segmentEnglishSentence(it.english).map((t) => t.raw),
					})),
				);
			}
		},
		[config, markPracticeRunning],
	);

	const onContinuePractice = useCallback(async () => {
		if (!config || !sessionCursor) return;
		setContinueLoading(true);
		try {
			const { items, cursor } = await fetchPracticeContinueQueue({
				contentKind: config.contentKind,
				source: config.source,
				count: config.count,
				order: config.order,
				libraryId: config.libraryId,
				streamId: config.streamId,
				poolTotal: config.poolTotal ?? initialPoolTotal,
				cursor: sessionCursor,
				excludeKeys: practicedKeys,
			});
			if (items.length === 0) {
				Toast({
					type: 'warning',
					title:
						config.source === 'review'
							? t('englishLearning.practice.continueReviewEmpty')
							: t('englishLearning.practice.continueEmpty'),
				});
				return;
			}
			setSessionCursor(cursor);
			setPracticedKeys((prev) => mergePracticedKeys(prev, items));
			setQueue(items);
			setIndex(0);
			setResults([]);
			setPhase('running');
			const classicItems = items.filter(isPracticeClassicItem);
			if (classicItems.length > 0) {
				prefetchSentenceWordAnnotationsBatch(
					classicItems.map((it) => ({
						english: it.english,
						words: segmentEnglishSentence(it.english).map((t) => t.raw),
					})),
				);
			}
		} catch (e) {
			Toast({
				type: 'error',
				title:
					e instanceof Error
						? e.message
						: t('englishLearning.practice.loadFailed'),
			});
		} finally {
			setContinueLoading(false);
		}
	}, [config, initialPoolTotal, practicedKeys, sessionCursor, t]);

	const onBackToSetup = useCallback(() => {
		resetToSetup();
		clearPracticeRunning();
	}, [clearPracticeRunning, resetToSetup]);

	useEffect(() => {
		if (searchParams.get('run') === '1') {
			skipRunResetRef.current = false;
			return;
		}
		if (skipRunResetRef.current || phase === 'setup') return;
		resetToSetup();
	}, [phase, resetToSetup, searchParams]);

	const onStepComplete = useCallback((result: PracticeAttemptResult) => {
		setResults((prev) => [...prev, result]);
		setIndex((prevIndex) => {
			const nextIndex = prevIndex + 1;
			setQueue((q) => {
				if (nextIndex >= q.length) {
					setPhase('summary');
				}
				return q;
			});
			return nextIndex;
		});
	}, []);

	const onGoPrevious = useCallback(() => {
		stopAllPlayback();
		setIndex((i) => {
			if (i <= 0) return 0;
			const prev = i - 1;
			setResults((r) => r.slice(0, prev));
			return prev;
		});
	}, []);

	const currentItem = queue[index];

	const shellTitle = useMemo(() => {
		if (phase === 'setup') {
			if (initialSource === 'review') {
				return t('route.englishLearning.review.title');
			}
			return initialContentKind === 'classic'
				? t('englishLearning.practice.classicSetupTitle')
				: t('englishLearning.practice.setupTitle');
		}
		if (phase === 'summary') return t('englishLearning.practice.summaryTitle');
		return initialContentKind === 'classic'
			? t('route.englishLearning.practice.classicTitle')
			: t('route.englishLearning.practice.title');
	}, [initialContentKind, initialSource, phase, t]);

	const shellSubtitle = useMemo(() => {
		if (phase !== 'running' || !config) return undefined;
		return t('englishLearning.practice.progress', {
			current: index + 1,
			total: queue.length,
		});
	}, [config, index, phase, queue.length, t]);

	return (
		<PracticePageShell
			title={shellTitle}
			subtitle={shellSubtitle}
			contentLayout={
				phase === 'summary' || phase === 'running' || phase === 'setup'
					? 'fill'
					: 'center'
			}
			flush={phase === 'running' || phase === 'setup'}
			onBack={phase === 'summary' ? onExit : undefined}
			backLabel={t('englishLearning.practice.back')}
			headerRight={
				phase === 'summary' ? (
					<PracticeShortcutsMenu practiceMode={undefined} slotBoard={false} />
				) : undefined
			}
		>
			{phase === 'setup' ? (
				<Setup
					initialContentKind={initialContentKind}
					initialSource={initialSource}
					initialMode={initialMode}
					initialLibraryId={initialLibraryId}
					initialStreamId={initialStreamId}
					initialSourceTitle={initialSourceTitle}
					initialPoolTotal={initialPoolTotal}
					headerExtra={
						<PracticeShortcutsMenu practiceMode={undefined} slotBoard={false} />
					}
					onStarted={onStarted}
				/>
			) : null}
			{phase === 'running' && config && currentItem ? (
				<Session
					mode={config.mode}
					item={currentItem}
					sourceTitle={config.sourceTitle}
					isLastQuestion={index >= queue.length - 1}
					canGoPrevious={index > 0}
					onGoPrevious={onGoPrevious}
					onStepComplete={onStepComplete}
					progressLabel={shellSubtitle}
					headerExtra={
						<PracticeShortcutsMenu practiceMode={config.mode} slotBoard />
					}
				/>
			) : null}
			{phase === 'summary' && config ? (
				<Summary
					results={results}
					practicedTotal={practicedKeys.length}
					config={config}
					continueLoading={continueLoading}
					onRetryWrong={onRetryWrong}
					onContinuePractice={() => void onContinuePractice()}
					onBackToSetup={onBackToSetup}
				/>
			) : null}
		</PracticePageShell>
	);
}
