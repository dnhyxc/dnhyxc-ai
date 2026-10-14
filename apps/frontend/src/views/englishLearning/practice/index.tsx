/**
 * 单词听写 / 拼写练习 — 布局路由（setup / session / summary）
 * M2：sessionStorage 整队快照 + URL sid，刷新续档
 */
import Loading from '@design/Loading';
import { Toast } from '@ui/index';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
	Outlet,
	useLocation,
	useNavigate,
	useSearchParams,
} from 'react-router';
import { useI18n } from '@/hooks';
import { prefetchMinimaxTtsUserPrefs } from '@/utils/minimaxTtsPrefs';
import {
	beginPracticeCloudTtsCacheSession,
	endPracticeCloudTtsCacheSession,
	prefetchCloudTts,
	stopAllPlayback,
} from '@/utils/speech';
import { resolvePracticeTtsCache } from '../utils/ttsCacheFolder';
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
	PracticeSessionCursor,
	PracticeSessionRound,
	PracticeSetupConfig,
	PracticeSource,
} from './types';
import { fetchPracticeContinueQueue } from './utils/fetchWords';
import {
	getPracticeAnswerText,
	isPracticeClassicItem,
	parsePracticeContentKind,
} from './utils/item';
import {
	englishPracticeSessionUrl,
	englishPracticeSetupUrl,
	englishPracticeSummaryUrl,
	mergePracticeSearch,
	parsePracticePoolTotal,
	practicePhaseFromPathname,
} from './utils/paths';
import {
	createPracticeRequestScope,
	type PracticeRequestScope,
} from './utils/practiceRequestScope';
import {
	clearPracticeDraft,
	loadPracticeDraft,
	type PracticeSessionDraft,
	peekPracticeUnfinished,
	replacePracticeDraft,
	savePracticeDraft,
} from './utils/practiceSessionDraft';
import {
	createPracticeTtsPrefetchPipe,
	type PracticeTtsPrefetchPipe,
} from './utils/practiceTtsPrefetchPipe';
import type { PracticeResumeState } from './utils/resumeFromReport';
import { segmentEnglishSentence } from './utils/segmentSentence';
import { prefetchSentenceWordAnnotationsBatch } from './utils/sentenceWordAnnotationCache';
import { warmPracticeFavoriteStatus } from './utils/warmFavoriteStatus';

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

function prefetchClassicBatch(
	items: PracticeItem[],
	signal: AbortSignal,
): void {
	const classicItems = items.filter(isPracticeClassicItem);
	if (classicItems.length === 0) return;
	prefetchSentenceWordAnnotationsBatch(
		classicItems.map((it) => ({
			english: it.english,
			words: segmentEnglishSentence(it.english).map((tok) => tok.raw),
		})),
		{ signal },
	);
}

/** 首屏同步读快照，避免刷新闪配置页 */
function readBootDraft(
	pathname: string,
	search: string,
	navState: unknown,
): PracticeSessionDraft | null {
	if (peekPracticeResume(navState)) return null;
	const phase = practicePhaseFromPathname(pathname);
	if (phase === 'setup') return null;
	const sid = new URLSearchParams(search).get('sid');
	if (!sid) return null;
	return loadPracticeDraft(sid);
}

export default function EnglishLearningPracticePage() {
	const { t } = useI18n();
	const location = useLocation();
	const navigate = useNavigate();
	const [searchParams, setSearchParams] = useSearchParams();
	const phase = practicePhaseFromPathname(location.pathname);

	const bootDraftRef = useRef(
		readBootDraft(location.pathname, location.search, location.state),
	);
	const boot = bootDraftRef.current;

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

	const bootResumeRef = useRef(peekPracticeResume(location.state));
	const [resumeLoading, setResumeLoading] = useState(() => {
		const r = bootResumeRef.current;
		return Boolean(r && r.intent !== 'setup');
	});

	const [sid, setSid] = useState<string | null>(
		() => boot?.sid ?? searchParams.get('sid'),
	);
	const [config, setConfig] = useState<PracticeSetupConfig | null>(
		() => boot?.config ?? null,
	);
	const [queue, setQueue] = useState<PracticeItem[]>(() => boot?.queue ?? []);
	const [index, setIndex] = useState(() => boot?.index ?? 0);
	const [results, setResults] = useState<PracticeAttemptResult[]>(
		() => boot?.results ?? [],
	);
	const [sessionRounds, setSessionRounds] = useState<PracticeSessionRound[]>(
		() => boot?.sessionRounds ?? [],
	);
	const [sessionCursor, setSessionCursor] =
		useState<PracticeSessionCursor | null>(() => boot?.sessionCursor ?? null);
	const [practicedKeys, setPracticedKeys] = useState<string[]>(
		() => boot?.practicedKeys ?? [],
	);
	const [continueLoading, setContinueLoading] = useState(false);
	const [sessionReportId, setSessionReportId] = useState<string | null>(
		() => boot?.sessionReportId ?? null,
	);
	const [bannerEpoch, setBannerEpoch] = useState(0);

	const unfinished = useMemo(() => {
		if (phase !== 'setup') return null;
		return peekPracticeUnfinished({
			contentKind: initialContentKind,
			source: initialSource,
			libraryId: initialLibraryId,
			streamId: initialStreamId,
		});
		// eslint-disable-next-line react-hooks/exhaustive-deps -- bannerEpoch 强制重读 sessionStorage
	}, [
		bannerEpoch,
		initialContentKind,
		initialLibraryId,
		initialSource,
		initialStreamId,
		phase,
	]);

	const ttsPipeRef = useRef<PracticeTtsPrefetchPipe | null>(null);
	const requestScopeRef = useRef<PracticeRequestScope>(
		createPracticeRequestScope(),
	);
	const [requestSignal, setRequestSignal] = useState<AbortSignal>(
		() => requestScopeRef.current.signal,
	);

	const bumpRequestScope = useCallback(() => {
		const signal = requestScopeRef.current.bump();
		setRequestSignal(signal);
		ttsPipeRef.current?.bindSignal(signal);
		return signal;
	}, []);

	useEffect(() => {
		return () => {
			stopAllPlayback();
			requestScopeRef.current.dispose();
		};
	}, []);

	const resumeHandledRef = useRef(false);
	const skipStageGuardRef = useRef(Boolean(boot));

	const searchWithSid = useCallback(
		(nextSid: string | null) =>
			mergePracticeSearch(location.search, { sid: nextSid }),
		[location.search],
	);

	const goSetup = useCallback(
		(opts?: { clearSid?: boolean }) => {
			const q = searchWithSid(opts?.clearSid === false ? sid : null);
			navigate(englishPracticeSetupUrl(q), { replace: true });
		},
		[navigate, searchWithSid, sid],
	);

	const goSession = useCallback(
		(nextSid: string) => {
			skipStageGuardRef.current = true;
			navigate(englishPracticeSessionUrl(searchWithSid(nextSid)));
		},
		[navigate, searchWithSid],
	);

	const goSummary = useCallback(
		(nextSid: string) => {
			skipStageGuardRef.current = true;
			queueMicrotask(() => {
				navigate(englishPracticeSummaryUrl(searchWithSid(nextSid)));
			});
		},
		[navigate, searchWithSid],
	);

	const syncModeToSearch = useCallback(
		(mode: PracticeMode) => {
			setSearchParams(
				(prev) => {
					const next = new URLSearchParams(prev);
					next.set('mode', mode);
					next.delete('run');
					return next;
				},
				{ replace: true },
			);
		},
		[setSearchParams],
	);

	const resetToSetup = useCallback(() => {
		stopAllPlayback();
		requestScopeRef.current.dispose();
		ttsPipeRef.current?.cancel();
		ttsPipeRef.current = null;
		if (sid) clearPracticeDraft(sid);
		setSid(null);
		setConfig(null);
		setQueue([]);
		setIndex(0);
		setResults([]);
		setSessionRounds([]);
		setSessionCursor(null);
		setPracticedKeys([]);
		setSessionReportId(null);
	}, [sid]);

	const persistDraft = useCallback(
		(
			next: Partial<PracticeSessionDraft> & {
				sid: string;
				phase: 'running' | 'summary';
				config: PracticeSetupConfig;
			},
			opts?: { replace?: boolean },
		) => {
			const draft: PracticeSessionDraft = {
				v: 1,
				sid: next.sid,
				phase: next.phase,
				config: next.config,
				queue: next.queue ?? queue,
				index: next.index ?? index,
				results: next.results ?? results,
				sessionRounds: next.sessionRounds ?? sessionRounds,
				sessionCursor:
					next.sessionCursor !== undefined ? next.sessionCursor : sessionCursor,
				practicedKeys: next.practicedKeys ?? practicedKeys,
				sessionReportId:
					next.sessionReportId !== undefined
						? next.sessionReportId
						: sessionReportId,
				updatedAt: new Date().toISOString(),
			};
			if (opts?.replace) replacePracticeDraft(draft);
			else savePracticeDraft(draft);
		},
		[
			index,
			practicedKeys,
			queue,
			results,
			sessionCursor,
			sessionReportId,
			sessionRounds,
		],
	);

	// 状态变化落盘（setup 不写）
	useEffect(() => {
		if (!sid || !config) return;
		if (phase === 'setup') return;
		if (phase === 'running' && queue.length === 0) return;
		if (phase === 'summary' && sessionRounds.length === 0) return;
		savePracticeDraft({
			v: 1,
			sid,
			phase: phase === 'summary' ? 'summary' : 'running',
			config,
			queue,
			index,
			results,
			sessionRounds,
			sessionCursor,
			practicedKeys,
			sessionReportId,
			updatedAt: new Date().toISOString(),
		});
	}, [
		config,
		index,
		phase,
		practicedKeys,
		queue,
		results,
		sessionCursor,
		sessionReportId,
		sessionRounds,
		sid,
	]);

	const startRunning = useCallback(
		(
			items: PracticeItem[],
			setup: PracticeSetupConfig,
			cursor: PracticeSessionCursor,
			opts?: { clearRounds?: boolean; keepSid?: string },
		) => {
			const signal = bumpRequestScope();
			const nextSid =
				opts?.keepSid ??
				(opts?.clearRounds === false && sid ? sid : crypto.randomUUID());
			const nextRounds =
				opts?.clearRounds === false
					? sessionRounds
					: ([] as PracticeSessionRound[]);
			const nextReportId = opts?.clearRounds === false ? sessionReportId : null;
			const nextKeys = items.map((i) => i.key).filter(Boolean);
			const nextPracticed =
				opts?.clearRounds === false
					? mergePracticedKeys(practicedKeys, items)
					: nextKeys;

			setSid(nextSid);
			setConfig(setup);
			setSessionCursor(cursor);
			setPracticedKeys(nextPracticed);
			setQueue(items);
			setIndex(0);
			setResults([]);
			if (opts?.clearRounds !== false) {
				setSessionRounds([]);
				setSessionReportId(null);
			}
			syncModeToSearch(setup.mode);
			warmPracticeFavoriteStatus(items);
			prefetchClassicBatch(items, signal);
			persistDraft(
				{
					sid: nextSid,
					phase: 'running',
					config: setup,
					queue: items,
					index: 0,
					results: [],
					sessionRounds: nextRounds,
					sessionCursor: cursor,
					practicedKeys: nextPracticed,
					sessionReportId: nextReportId,
				},
				{ replace: opts?.clearRounds !== false },
			);
			goSession(nextSid);
		},
		[
			bumpRequestScope,
			goSession,
			persistDraft,
			practicedKeys,
			sessionReportId,
			sessionRounds,
			sid,
			syncModeToSearch,
		],
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
			if (!config || wrongQueue.length === 0 || !sid) return;
			const n = wrongQueue.length;
			const stepped = Math.ceil(n / 10) * 10;
			const count = Math.min(100, Math.max(10, stepped)) as PracticeCountOption;
			const signal = bumpRequestScope();
			const nextConfig = {
				...config,
				contentKind: config.contentKind,
				count,
				isRetryWrong: true,
			};
			setConfig(nextConfig);
			setQueue(wrongQueue);
			setIndex(0);
			setResults([]);
			syncModeToSearch(config.mode);
			warmPracticeFavoriteStatus(wrongQueue);
			prefetchClassicBatch(wrongQueue, signal);
			persistDraft({
				sid,
				phase: 'running',
				config: nextConfig,
				queue: wrongQueue,
				index: 0,
				results: [],
			});
			goSession(sid);
		},
		[bumpRequestScope, config, goSession, persistDraft, sid, syncModeToSearch],
	);

	const onContinuePractice = useCallback(async () => {
		if (!config || !sessionCursor || !sid) return;
		setContinueLoading(true);
		try {
			const excludeKeys = (() => {
				const fromRounds = sessionRounds.flatMap((r) =>
					r.results.map((x) => x.item.key).filter(Boolean),
				);
				return [...new Set([...practicedKeys, ...fromRounds])];
			})();
			const { items, cursor } = await fetchPracticeContinueQueue({
				contentKind: config.contentKind,
				source: config.source,
				count: config.count,
				order: config.order,
				libraryId: config.libraryId,
				streamId: config.streamId,
				poolTotal: config.poolTotal ?? initialPoolTotal,
				cursor: sessionCursor,
				excludeKeys,
			});
			if (items.length === 0) {
				const practiced = excludeKeys.length;
				if (
					config.poolTotal != null &&
					practiced > 0 &&
					practiced < config.poolTotal
				) {
					setConfig({ ...config, poolTotal: practiced });
				}
				Toast({
					type: 'warning',
					title:
						config.source === 'review'
							? t('englishLearning.practice.continueReviewEmpty')
							: config.contentKind === 'classic'
								? t('englishLearning.practice.continueEmptyClassic')
								: t('englishLearning.practice.continueEmpty'),
				});
				return;
			}
			const nextKeys = mergePracticedKeys(practicedKeys, items);
			const nextConfig = config.isRetryWrong
				? { ...config, isRetryWrong: false }
				: config;
			setSessionCursor(cursor);
			setPracticedKeys(nextKeys);
			const signal = bumpRequestScope();
			setQueue(items);
			setIndex(0);
			setResults([]);
			if (config.isRetryWrong) setConfig(nextConfig);
			warmPracticeFavoriteStatus(items);
			prefetchClassicBatch(items, signal);
			persistDraft({
				sid,
				phase: 'running',
				config: nextConfig,
				queue: items,
				index: 0,
				results: [],
				sessionCursor: cursor,
				practicedKeys: nextKeys,
			});
			goSession(sid);
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
	}, [
		bumpRequestScope,
		config,
		goSession,
		initialPoolTotal,
		persistDraft,
		practicedKeys,
		sessionCursor,
		sessionRounds,
		sid,
		t,
	]);

	const onBackToSetup = useCallback(() => {
		resetToSetup();
		goSetup({ clearSid: true });
		setBannerEpoch((n) => n + 1);
	}, [goSetup, resetToSetup]);

	const applyDraftToState = useCallback(
		(d: PracticeSessionDraft) => {
			setSid(d.sid);
			setConfig(d.config);
			setQueue(d.queue);
			setIndex(d.index);
			setResults(d.results);
			setSessionRounds(d.sessionRounds);
			setSessionCursor(d.sessionCursor);
			setPracticedKeys(d.practicedKeys);
			setSessionReportId(d.sessionReportId);
			syncModeToSearch(d.config.mode);
			warmPracticeFavoriteStatus(d.queue);
			const signal = bumpRequestScope();
			prefetchClassicBatch(d.queue, signal);
		},
		[bumpRequestScope, syncModeToSearch],
	);

	const onContinueResume = useCallback(
		(mode: PracticeMode) => {
			if (!unfinished) return;
			const d = loadPracticeDraft(unfinished.sid);
			if (!d) {
				setBannerEpoch((n) => n + 1);
				return;
			}
			const next = {
				...d,
				config: { ...d.config, mode },
			};
			savePracticeDraft(next);
			applyDraftToState(next);
			skipStageGuardRef.current = true;
			if (next.phase === 'summary') goSummary(next.sid);
			else goSession(next.sid);
		},
		[applyDraftToState, goSession, goSummary, unfinished],
	);

	const onDiscardResume = useCallback(() => {
		if (!unfinished) return;
		clearPracticeDraft(unfinished.sid);
		setBannerEpoch((n) => n + 1);
	}, [unfinished]);

	useEffect(() => {
		if (skipStageGuardRef.current) {
			skipStageGuardRef.current = false;
			return;
		}
		if (resumeLoading) return;
		if (phase === 'running' && (!config || queue.length === 0)) {
			goSetup({ clearSid: true });
			return;
		}
		if (phase === 'summary' && (!config || sessionRounds.length === 0)) {
			goSetup({ clearSid: true });
		}
	}, [
		config,
		goSetup,
		phase,
		queue.length,
		resumeLoading,
		sessionRounds.length,
	]);

	useEffect(() => {
		if (resumeHandledRef.current) return;
		const resume = peekPracticeResume(location.state);
		if (!resume) return;
		resumeHandledRef.current = true;
		void (async () => {
			try {
				if (resume.intent === 'setup') {
					resetToSetup();
					goSetup({ clearSid: true });
					return;
				}
				if (resume.intent === 'retryWrong' && resume.retryItems?.length) {
					const nextSid = crypto.randomUUID();
					const signal = bumpRequestScope();
					const nextConfig = { ...resume.config, isRetryWrong: true };
					setSid(nextSid);
					setConfig(nextConfig);
					setSessionCursor(emptyCursor());
					setPracticedKeys(resume.excludeKeys);
					setQueue(resume.retryItems);
					setIndex(0);
					setResults([]);
					setSessionRounds(resume.priorRounds ?? []);
					setSessionReportId(resume.reportId ?? null);
					syncModeToSearch(resume.config.mode);
					warmPracticeFavoriteStatus(resume.retryItems);
					prefetchClassicBatch(resume.retryItems, signal);
					replacePracticeDraft({
						v: 1,
						sid: nextSid,
						phase: 'running',
						config: nextConfig,
						queue: resume.retryItems,
						index: 0,
						results: [],
						sessionRounds: resume.priorRounds ?? [],
						sessionCursor: emptyCursor(),
						practicedKeys: resume.excludeKeys,
						sessionReportId: resume.reportId ?? null,
						updatedAt: new Date().toISOString(),
					});
					goSession(nextSid);
					return;
				}
				if (resume.intent === 'continue') {
					setContinueLoading(true);
					try {
						const urlLibraryId = searchParams.get('libraryId') ?? undefined;
						const urlStreamId = searchParams.get('streamId') ?? undefined;
						const urlPoolTotal = parsePracticePoolTotal(
							searchParams.get('poolTotal'),
						);
						const { items, cursor } = await fetchPracticeContinueQueue({
							contentKind: resume.config.contentKind,
							source: resume.config.source,
							count: resume.config.count,
							order: resume.config.order,
							libraryId: resume.config.libraryId ?? urlLibraryId,
							streamId: resume.config.streamId ?? urlStreamId,
							poolTotal: resume.config.poolTotal ?? urlPoolTotal,
							cursor: emptyCursor(),
							excludeKeys: resume.excludeKeys,
						});
						if (items.length === 0) {
							Toast({
								type: 'warning',
								title:
									resume.config.contentKind === 'classic'
										? t('englishLearning.practice.continueEmptyClassic')
										: t('englishLearning.practice.continueEmpty'),
							});
							resetToSetup();
							goSetup({ clearSid: true });
							return;
						}
						const nextSid = crypto.randomUUID();
						const nextConfig = {
							...resume.config,
							libraryId: resume.config.libraryId ?? urlLibraryId,
							streamId: resume.config.streamId ?? urlStreamId,
							poolTotal: resume.config.poolTotal ?? urlPoolTotal,
							isRetryWrong: false,
						};
						const nextKeys = mergePracticedKeys(resume.excludeKeys, items);
						setSid(nextSid);
						setConfig(nextConfig);
						setSessionCursor(cursor);
						setPracticedKeys(nextKeys);
						const signal = bumpRequestScope();
						setQueue(items);
						setIndex(0);
						setResults([]);
						setSessionRounds(resume.priorRounds ?? []);
						setSessionReportId(resume.reportId ?? null);
						syncModeToSearch(resume.config.mode);
						warmPracticeFavoriteStatus(items);
						prefetchClassicBatch(items, signal);
						replacePracticeDraft({
							v: 1,
							sid: nextSid,
							phase: 'running',
							config: nextConfig,
							queue: items,
							index: 0,
							results: [],
							sessionRounds: resume.priorRounds ?? [],
							sessionCursor: cursor,
							practicedKeys: nextKeys,
							sessionReportId: resume.reportId ?? null,
							updatedAt: new Date().toISOString(),
						});
						goSession(nextSid);
					} catch (e) {
						Toast({
							type: 'error',
							title:
								e instanceof Error
									? e.message
									: t('englishLearning.practice.loadFailed'),
						});
						resetToSetup();
						goSetup({ clearSid: true });
					} finally {
						setContinueLoading(false);
					}
				}
			} finally {
				setResumeLoading(false);
			}
		})();
	}, [
		bumpRequestScope,
		goSession,
		goSetup,
		location.state,
		resetToSetup,
		searchParams,
		syncModeToSearch,
		t,
	]);

	const onStepComplete = useCallback(
		(result: PracticeAttemptResult) => {
			const retryPass = Boolean(config?.isRetryWrong);
			const activeSid = sid;
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
							requestScopeRef.current.dispose();
							if (activeSid) goSummary(activeSid);
						} else {
							bumpRequestScope();
						}
						return q;
					});
					return nextIndex;
				});
				return next;
			});
		},
		[bumpRequestScope, config?.isRetryWrong, goSummary, sid],
	);

	const onGoPrevious = useCallback(() => {
		stopAllPlayback();
		setIndex((i) => {
			if (i <= 0) return 0;
			const prev = i - 1;
			bumpRequestScope();
			setResults((r) => r.slice(0, prev));
			return prev;
		});
	}, [bumpRequestScope]);

	const currentItem = queue[index];

	const queueAnswerTexts = useMemo(
		() => queue.map((it) => getPracticeAnswerText(it).trim()),
		[queue],
	);

	const practiceTtsDisk = useMemo(
		() =>
			config
				? resolvePracticeTtsCache({
						contentKind: config.contentKind,
						source: config.source,
						libraryId: config.libraryId,
						streamId: config.streamId,
						sourceTitle: config.sourceTitle,
					})
				: {},
		[config],
	);

	useEffect(() => {
		if (phase !== 'running' || queueAnswerTexts.length === 0) {
			ttsPipeRef.current?.cancel();
			ttsPipeRef.current = null;
			endPracticeCloudTtsCacheSession();
			return;
		}
		beginPracticeCloudTtsCacheSession(100);
		ttsPipeRef.current?.cancel();
		ttsPipeRef.current = createPracticeTtsPrefetchPipe(queueAnswerTexts, {
			ahead: 5,
			signal: requestScopeRef.current.signal,
			cacheFolder: practiceTtsDisk.cacheFolder,
			cacheTitle: practiceTtsDisk.cacheTitle,
		});
		return () => {
			ttsPipeRef.current?.cancel();
			ttsPipeRef.current = null;
			endPracticeCloudTtsCacheSession();
		};
	}, [
		phase,
		queueAnswerTexts,
		practiceTtsDisk.cacheFolder,
		practiceTtsDisk.cacheTitle,
	]);

	const onTtsPipelineKick = useCallback((cursorIndex: number) => {
		ttsPipeRef.current?.kick(cursorIndex);
	}, []);

	useEffect(() => {
		if (phase !== 'running' || !currentItem) return;
		prefetchMinimaxTtsUserPrefs();
		const first = getPracticeAnswerText(currentItem).trim();
		if (first) {
			prefetchCloudTts(first, {
				whole: true,
				signal: requestSignal,
				persistDisk: true,
				cacheFolder: practiceTtsDisk.cacheFolder,
				cacheTitle: practiceTtsDisk.cacheTitle,
			});
		}
	}, [
		phase,
		currentItem,
		requestSignal,
		practiceTtsDisk.cacheFolder,
		practiceTtsDisk.cacheTitle,
	]);

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
			contentLayout="fill"
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
					replaceUnfinished={Boolean(unfinished)}
					resume={
						unfinished
							? {
									sid: unfinished.sid,
									description:
										unfinished.phase === 'summary'
											? t('englishLearning.sessionDraft.practiceSummary', {
													source:
														unfinished.sourceTitle ||
														t('englishLearning.practice.sourceLibrary'),
												})
											: t('englishLearning.sessionDraft.practiceRunning', {
													source:
														unfinished.sourceTitle ||
														t('englishLearning.practice.sourceLibrary'),
													current: unfinished.current,
													total: unfinished.total,
												}),
									continueLabel: t('englishLearning.sessionDraft.continue'),
									discardLabel: t('englishLearning.sessionDraft.discard'),
									mode: unfinished.mode,
									order: unfinished.order,
									count: unfinished.count,
									reportSaveMode: unfinished.reportSaveMode,
								}
							: null
					}
					onContinueResume={onContinueResume}
					onDiscardResume={onDiscardResume}
					onStarted={onStarted}
				/>
			) : null}
			{!resumeLoading && phase === 'running' && config && currentItem ? (
				<Session
					mode={config.mode}
					item={currentItem}
					itemIndex={index}
					sourceTitle={config.sourceTitle}
					cacheFolder={practiceTtsDisk.cacheFolder}
					cacheTitle={practiceTtsDisk.cacheTitle}
					onTtsPipelineKick={onTtsPipelineKick}
					requestSignal={requestSignal}
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
			<Outlet />
		</PracticePageShell>
	);
}
