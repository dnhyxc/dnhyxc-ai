/**
 * 单词听写 / 拼写练习 — 路由页（index）
 */
import Loading from '@design/Loading';
import { Toast } from '@ui/index';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useSearchParams } from 'react-router';
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
	PracticeSessionRound,
	PracticeSetupConfig,
	PracticeSource,
} from './types';
import { fetchPracticeContinueQueue } from './utils/fetchWords';
import { isPracticeClassicItem, parsePracticeContentKind } from './utils/item';
import { parsePracticePoolTotal } from './utils/paths';
import type { PracticeResumeState } from './utils/resumeFromReport';
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

function emptyCursor(): PracticeSessionCursor {
	return { nextSequentialPageIndex: 0, usedRandomPageIndices: [] };
}

/** 重练做对的词：历轮 wrong → correct（不追加轮次） */
function applyRetryCorrections(
	rounds: PracticeSessionRound[],
	retryResults: PracticeAttemptResult[],
): PracticeSessionRound[] {
	const byKey = new Map(
		retryResults.filter((r) => r.correct).map((r) => [r.item.key, r]),
	);
	if (byKey.size === 0) return rounds;
	return rounds.map((round) => ({
		...round,
		results: round.results.map((r) => {
			if (r.correct) return r;
			const hit = byKey.get(r.item.key);
			if (!hit) return r;
			return { ...r, correct: true, userInput: hit.userInput };
		}),
	}));
}

function peekPracticeResume(state: unknown): PracticeResumeState | undefined {
	return (state as { practiceResume?: PracticeResumeState } | null)
		?.practiceResume;
}

export default function EnglishLearningPracticePage() {
	const { t } = useI18n();
	const location = useLocation();
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

	// 报告续练：首帧就挡住 Setup，避免闪配置页
	const bootResumeRef = useRef(peekPracticeResume(location.state));
	const [resumeLoading, setResumeLoading] = useState(() => {
		const r = bootResumeRef.current;
		return Boolean(r && r.intent !== 'setup');
	});

	const [phase, setPhase] = useState<PracticePhase>('setup');
	const [config, setConfig] = useState<PracticeSetupConfig | null>(null);
	const [queue, setQueue] = useState<PracticeItem[]>([]);
	const [index, setIndex] = useState(0);
	const [, setResults] = useState<PracticeAttemptResult[]>([]);
	const [sessionRounds, setSessionRounds] = useState<PracticeSessionRound[]>(
		[],
	);
	const [sessionCursor, setSessionCursor] =
		useState<PracticeSessionCursor | null>(null);
	const [practicedKeys, setPracticedKeys] = useState<string[]>([]);
	const [continueLoading, setContinueLoading] = useState(false);
	const [sessionReportId, setSessionReportId] = useState<string | null>(null);

	useEffect(() => {
		return () => stopAllPlayback();
	}, []);

	const skipRunResetRef = useRef(false);
	const resumeHandledRef = useRef(false);

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
		setSessionRounds([]);
		setSessionCursor(null);
		setPracticedKeys([]);
		setSessionReportId(null);
	}, []);

	const startRunning = useCallback(
		(
			items: PracticeItem[],
			setup: PracticeSetupConfig,
			cursor: PracticeSessionCursor,
			opts?: { clearRounds?: boolean },
		) => {
			setConfig(setup);
			setSessionCursor(cursor);
			setPracticedKeys(items.map((i) => i.key).filter(Boolean));
			setQueue(items);
			setIndex(0);
			setResults([]);
			if (opts?.clearRounds !== false) {
				setSessionRounds([]);
				setSessionReportId(null);
			}
			markPracticeRunning(setup.mode);
			setPhase('running');
			const classicItems = items.filter(isPracticeClassicItem);
			if (classicItems.length > 0) {
				prefetchSentenceWordAnnotationsBatch(
					classicItems.map((it) => ({
						english: it.english,
						words: segmentEnglishSentence(it.english).map((tok) => tok.raw),
					})),
				);
			}
		},
		[markPracticeRunning],
	);

	const onStarted = useCallback(
		(
			items: PracticeItem[],
			setup: PracticeSetupConfig,
			cursor: PracticeSessionCursor,
		) => {
			startRunning(items, setup, cursor, { clearRounds: true });
		},
		[startRunning],
	);

	const onRetryWrong = useCallback(
		(wrongQueue: PracticeItem[]) => {
			if (!config || wrongQueue.length === 0) return;
			const n = wrongQueue.length;
			const stepped = Math.ceil(n / 10) * 10;
			const count = Math.min(100, Math.max(10, stepped)) as PracticeCountOption;
			setConfig({
				...config,
				contentKind: config.contentKind,
				count,
				isRetryWrong: true,
			});
			setQueue(wrongQueue);
			setIndex(0);
			setResults([]);
			// 保留 sessionRounds / sessionReportId / practicedKeys / cursor
			markPracticeRunning(config.mode);
			setPhase('running');
			const classicItems = wrongQueue.filter(isPracticeClassicItem);
			if (classicItems.length > 0) {
				prefetchSentenceWordAnnotationsBatch(
					classicItems.map((it) => ({
						english: it.english,
						words: segmentEnglishSentence(it.english).map((tok) => tok.raw),
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
			// 保留 sessionRounds / sessionReportId
			if (config.isRetryWrong) {
				setConfig({ ...config, isRetryWrong: false });
			}
			setPhase('running');
			const classicItems = items.filter(isPracticeClassicItem);
			if (classicItems.length > 0) {
				prefetchSentenceWordAnnotationsBatch(
					classicItems.map((it) => ({
						english: it.english,
						words: segmentEnglishSentence(it.english).map((tok) => tok.raw),
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

	// 报告详情续练：location.state 注入
	useEffect(() => {
		if (resumeHandledRef.current) return;
		const resume = peekPracticeResume(location.state);
		if (!resume) return;
		resumeHandledRef.current = true;
		void (async () => {
			try {
				if (resume.intent === 'setup') {
					resetToSetup();
					clearPracticeRunning();
					return;
				}
				if (resume.intent === 'retryWrong' && resume.retryItems?.length) {
					setConfig({ ...resume.config, isRetryWrong: true });
					setSessionCursor(emptyCursor());
					setPracticedKeys(resume.excludeKeys);
					setQueue(resume.retryItems);
					setIndex(0);
					setResults([]);
					setSessionRounds(resume.priorRounds ?? []);
					setSessionReportId(resume.reportId ?? null);
					markPracticeRunning(resume.config.mode);
					setPhase('running');
					const classicItems = resume.retryItems.filter(isPracticeClassicItem);
					if (classicItems.length > 0) {
						prefetchSentenceWordAnnotationsBatch(
							classicItems.map((it) => ({
								english: it.english,
								words: segmentEnglishSentence(it.english).map((tok) => tok.raw),
							})),
						);
					}
					return;
				}
				if (resume.intent === 'continue') {
					setContinueLoading(true);
					try {
						const { items, cursor } = await fetchPracticeContinueQueue({
							contentKind: resume.config.contentKind,
							source: resume.config.source,
							count: resume.config.count,
							order: resume.config.order,
							libraryId: resume.config.libraryId,
							streamId: resume.config.streamId,
							poolTotal: resume.config.poolTotal,
							cursor: emptyCursor(),
							excludeKeys: resume.excludeKeys,
						});
						if (items.length === 0) {
							Toast({
								type: 'warning',
								title: t('englishLearning.practice.continueEmpty'),
							});
							resetToSetup();
							return;
						}
						setConfig({ ...resume.config, isRetryWrong: false });
						setSessionCursor(cursor);
						setPracticedKeys(mergePracticedKeys(resume.excludeKeys, items));
						setQueue(items);
						setIndex(0);
						setResults([]);
						// 带入报告历轮 + 原 reportId，本轮完成后接第 N+1 轮并覆盖保存
						setSessionRounds(resume.priorRounds ?? []);
						setSessionReportId(resume.reportId ?? null);
						markPracticeRunning(resume.config.mode);
						setPhase('running');
					} catch (e) {
						Toast({
							type: 'error',
							title:
								e instanceof Error
									? e.message
									: t('englishLearning.practice.loadFailed'),
						});
						resetToSetup();
					} finally {
						setContinueLoading(false);
					}
				}
			} finally {
				setResumeLoading(false);
			}
		})();
	}, [
		clearPracticeRunning,
		location.state,
		markPracticeRunning,
		resetToSetup,
		t,
	]);

	const onStepComplete = useCallback(
		(result: PracticeAttemptResult) => {
			const retryPass = Boolean(config?.isRetryWrong);
			setResults((prev) => {
				const next = [...prev, result];
				setIndex((prevIndex) => {
					const nextIndex = prevIndex + 1;
					setQueue((q) => {
						if (nextIndex >= q.length) {
							if (retryPass) {
								setSessionRounds((rounds) =>
									applyRetryCorrections(rounds, next),
								);
								setConfig((c) => (c ? { ...c, isRetryWrong: false } : c));
							} else {
								setSessionRounds((rounds) => {
									const maxIdx = rounds.reduce(
										(m, r) => Math.max(m, r.roundIndex),
										0,
									);
									return [
										...rounds,
										{
											roundIndex: maxIdx + 1,
											results: next,
											completedAt: new Date().toISOString(),
										},
									];
								});
							}
							setPhase('summary');
						}
						return q;
					});
					return nextIndex;
				});
				return next;
			});
		},
		[config?.isRetryWrong],
	);

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
		if (resumeLoading) {
			return initialContentKind === 'classic'
				? t('route.englishLearning.practice.classicTitle')
				: t('route.englishLearning.practice.title');
		}
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
	}, [initialContentKind, initialSource, phase, resumeLoading, t]);

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
			headerRight={
				phase === 'summary' ? (
					<PracticeShortcutsMenu practiceMode={undefined} slotBoard={false} />
				) : undefined
			}
		>
			{resumeLoading ? (
				<div className="flex flex-1 items-center justify-center py-16">
					<Loading />
				</div>
			) : phase === 'setup' ? (
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
			{!resumeLoading && phase === 'running' && config && currentItem ? (
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
			{!resumeLoading &&
			phase === 'summary' &&
			config &&
			sessionRounds.length > 0 ? (
				<Summary
					rounds={sessionRounds}
					practicedTotal={practicedKeys.length}
					config={config}
					sessionReportId={sessionReportId}
					onSessionReportId={setSessionReportId}
					continueLoading={continueLoading}
					onRetryWrong={onRetryWrong}
					onContinuePractice={() => void onContinuePractice()}
					onBackToSetup={onBackToSetup}
				/>
			) : null}
		</PracticePageShell>
	);
}
