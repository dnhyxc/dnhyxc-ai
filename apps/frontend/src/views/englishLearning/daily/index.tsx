/**
 * 英语学习：今日记词（intro / session / done）独立路由
 * M2：sessionStorage 快照 + URL sid，刷新续档
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
	Outlet,
	useLocation,
	useNavigate,
	useSearchParams,
} from 'react-router';
import { useI18n } from '@/hooks';
import type { PracticeReportSaveMode } from '../practice/types';
import { shufflePracticeItems } from '../practice/utils/grading';
import { DailyCardSession } from './components/DailyCardSession';
import { DailyDonePanel } from './components/DailyDonePanel';
import { DailyIntroPanel } from './components/DailyIntroPanel';
import { DailyPageLayout } from './components/DailyPageLayout';
import type {
	DailyMemorizeMode,
	DailySessionRound,
	DailySessionSummary,
	DailyVocabCard,
} from './types';
import {
	clearDailyDraft,
	type DailyPendingRecord,
	type DailySessionDraft,
	loadDailyDraft,
	peekDailyUnfinished,
	replaceDailyDraft,
	saveDailyDraft,
} from './utils/dailySessionDraft';
import { loadDailyCards } from './utils/loadDailyCards';
import {
	dailyPhaseFromPathname,
	englishDailyDoneUrl,
	englishDailyIntroUrl,
	englishDailySessionUrl,
	mergeDailySearch,
} from './utils/paths';

function readBootDraft(
	pathname: string,
	search: string,
): DailySessionDraft | null {
	const phase = dailyPhaseFromPathname(pathname);
	if (phase === 'intro') return null;
	const sid = new URLSearchParams(search).get('sid');
	if (!sid) return null;
	return loadDailyDraft(sid);
}

export default function EnglishLearningDailyPage() {
	const { t } = useI18n();
	const navigate = useNavigate();
	const location = useLocation();
	const [, setSearchParams] = useSearchParams();
	const phase = dailyPhaseFromPathname(location.pathname);

	const bootDraftRef = useRef(
		readBootDraft(location.pathname, location.search),
	);
	const boot = bootDraftRef.current;

	const [starting, setStarting] = useState(false);
	const [continueLoading, setContinueLoading] = useState(false);
	const [sid, setSid] = useState<string | null>(
		() => boot?.sid ?? new URLSearchParams(location.search).get('sid'),
	);
	const [cards, setCards] = useState<DailyVocabCard[]>(() => boot?.cards ?? []);
	const [cardIndex, setCardIndex] = useState(() => boot?.index ?? 0);
	const [pendingRecords, setPendingRecords] = useState<DailyPendingRecord[]>(
		() => boot?.pendingRecords ?? [],
	);
	const [mode, setMode] = useState<DailyMemorizeMode>(
		() => boot?.mode ?? 'recognition',
	);
	const [reportSaveMode, setReportSaveMode] = useState<PracticeReportSaveMode>(
		() => boot?.reportSaveMode ?? 'manual',
	);
	const [summary, setSummary] = useState<DailySessionSummary | null>(
		() => boot?.summary ?? null,
	);
	const [sessionRounds, setSessionRounds] = useState<DailySessionRound[]>(
		() => boot?.sessionRounds ?? [],
	);
	const [isRetryWrong, setIsRetryWrong] = useState(
		() => boot?.isRetryWrong ?? false,
	);
	const practicedKeysRef = useRef<string[]>(boot?.practicedKeys ?? []);
	const allowEmptyDoneRef = useRef(Boolean(boot?.allowEmptyDone));
	const skipStageGuardRef = useRef(Boolean(boot));
	const [bannerEpoch, setBannerEpoch] = useState(0);

	const unfinished = useMemo(() => {
		if (phase !== 'intro') return null;
		return peekDailyUnfinished();
		// eslint-disable-next-line react-hooks/exhaustive-deps -- bannerEpoch 强制重读
	}, [bannerEpoch, phase]);

	const backHome = useCallback(() => {
		navigate('/english-learning');
	}, [navigate]);

	const searchWithSid = useCallback(
		(nextSid: string | null) =>
			mergeDailySearch(location.search, { sid: nextSid }),
		[location.search],
	);

	const goIntro = useCallback(() => {
		navigate(englishDailyIntroUrl(searchWithSid(null)), { replace: true });
	}, [navigate, searchWithSid]);

	const goSession = useCallback(
		(nextSid: string) => {
			skipStageGuardRef.current = true;
			navigate(englishDailySessionUrl(searchWithSid(nextSid)));
		},
		[navigate, searchWithSid],
	);

	const goDone = useCallback(
		(nextSid: string) => {
			skipStageGuardRef.current = true;
			queueMicrotask(() => {
				navigate(englishDailyDoneUrl(searchWithSid(nextSid)));
			});
		},
		[navigate, searchWithSid],
	);

	const stripLegacyRun = useCallback(() => {
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

	const resetToIntro = useCallback(() => {
		if (sid) clearDailyDraft(sid);
		setSid(null);
		setCards([]);
		setCardIndex(0);
		setPendingRecords([]);
		setSummary(null);
		setSessionRounds([]);
		setIsRetryWrong(false);
		practicedKeysRef.current = [];
		allowEmptyDoneRef.current = false;
	}, [sid]);

	useEffect(() => {
		if (!sid) return;
		if (phase === 'intro') return;
		if (phase === 'session' && cards.length === 0 && !allowEmptyDoneRef.current)
			return;
		if (
			phase === 'done' &&
			summary == null &&
			sessionRounds.length === 0 &&
			!allowEmptyDoneRef.current
		) {
			return;
		}
		saveDailyDraft({
			v: 1,
			sid,
			phase: phase === 'done' ? 'done' : 'session',
			mode,
			reportSaveMode,
			cards,
			index: cardIndex,
			pendingRecords,
			sessionRounds,
			summary,
			isRetryWrong,
			practicedKeys: practicedKeysRef.current,
			sessionReportId: null,
			allowEmptyDone: allowEmptyDoneRef.current,
			updatedAt: new Date().toISOString(),
		});
	}, [
		cardIndex,
		cards,
		isRetryWrong,
		mode,
		pendingRecords,
		phase,
		reportSaveMode,
		sessionRounds,
		sid,
		summary,
	]);

	const beginSession = useCallback(
		(
			nextCards: DailyVocabCard[],
			nextMode: DailyMemorizeMode,
			retry: boolean,
			opts?: { keepSid?: string },
		) => {
			const nextSid = opts?.keepSid ?? crypto.randomUUID();
			const nextKeys = mergeKeys(
				retry || opts?.keepSid ? practicedKeysRef.current : [],
				nextCards.map((c) => c.key),
			);
			if (!opts?.keepSid && !retry) {
				practicedKeysRef.current = nextKeys;
			} else {
				practicedKeysRef.current = mergeKeys(
					practicedKeysRef.current,
					nextCards.map((c) => c.key),
				);
			}
			setSid(nextSid);
			setMode(nextMode);
			setCards(nextCards);
			setCardIndex(0);
			setPendingRecords([]);
			setSummary(null);
			setIsRetryWrong(retry);
			allowEmptyDoneRef.current = false;
			stripLegacyRun();
			const draft: DailySessionDraft = {
				v: 1,
				sid: nextSid,
				phase: 'session',
				mode: nextMode,
				reportSaveMode,
				cards: nextCards,
				index: 0,
				pendingRecords: [],
				sessionRounds,
				summary: null,
				isRetryWrong: retry,
				practicedKeys: practicedKeysRef.current,
				sessionReportId: null,
				updatedAt: new Date().toISOString(),
			};
			if (opts?.keepSid) saveDailyDraft(draft);
			else replaceDailyDraft(draft);
			goSession(nextSid);
		},
		[goSession, reportSaveMode, sessionRounds, stripLegacyRun],
	);

	const onStart = useCallback(
		async (
			nextMode: DailyMemorizeMode,
			nextReportSaveMode: PracticeReportSaveMode,
		) => {
			setStarting(true);
			setIsRetryWrong(false);
			practicedKeysRef.current = [];
			setSummary(null);
			setSessionRounds([]);
			setReportSaveMode(nextReportSaveMode);
			try {
				const loaded = await loadDailyCards();
				if (loaded.length === 0) {
					const nextSid = crypto.randomUUID();
					setCards([]);
					setSid(nextSid);
					allowEmptyDoneRef.current = true;
					stripLegacyRun();
					replaceDailyDraft({
						v: 1,
						sid: nextSid,
						phase: 'done',
						mode: nextMode,
						reportSaveMode: nextReportSaveMode,
						cards: [],
						index: 0,
						pendingRecords: [],
						sessionRounds: [],
						summary: null,
						isRetryWrong: false,
						practicedKeys: [],
						sessionReportId: null,
						allowEmptyDone: true,
						updatedAt: new Date().toISOString(),
					});
					goDone(nextSid);
					return;
				}
				setReportSaveMode(nextReportSaveMode);
				beginSession(loaded, nextMode, false);
			} finally {
				setStarting(false);
			}
		},
		[beginSession, goDone, stripLegacyRun],
	);

	const onComplete = useCallback(
		(next: DailySessionSummary) => {
			if (!sid) return;
			let nextRounds = sessionRounds;
			if (isRetryWrong) {
				const correctKeys = new Set(next.correctCards.map((c) => c.key));
				nextRounds = sessionRounds.map((round) => {
					const moved: DailyVocabCard[] = [];
					const stillWrong: DailyVocabCard[] = [];
					for (const card of round.wrongCards) {
						if (correctKeys.has(card.key)) moved.push(card);
						else stillWrong.push(card);
					}
					if (moved.length === 0) return round;
					return {
						...round,
						wrongCards: stillWrong,
						correctCards: [...round.correctCards, ...moved],
					};
				});
				setSessionRounds(nextRounds);
				setIsRetryWrong(false);
			} else {
				const maxIdx = sessionRounds.reduce(
					(m, r) => Math.max(m, r.roundIndex),
					0,
				);
				nextRounds = [
					...sessionRounds,
					{
						roundIndex: maxIdx + 1,
						wrongCards: next.wrongCards,
						correctCards: next.correctCards,
						completedAt: new Date().toISOString(),
					},
				];
				setSessionRounds(nextRounds);
			}
			setSummary(next);
			allowEmptyDoneRef.current = false;
			stripLegacyRun();
			saveDailyDraft({
				v: 1,
				sid,
				phase: 'done',
				mode,
				reportSaveMode,
				cards,
				index: cardIndex,
				pendingRecords,
				sessionRounds: nextRounds,
				summary: next,
				isRetryWrong: false,
				practicedKeys: practicedKeysRef.current,
				sessionReportId: null,
				updatedAt: new Date().toISOString(),
			});
			goDone(sid);
		},
		[
			cardIndex,
			cards,
			goDone,
			isRetryWrong,
			mode,
			pendingRecords,
			reportSaveMode,
			sessionRounds,
			sid,
			stripLegacyRun,
		],
	);

	const onContinuePractice = useCallback(async () => {
		if (!sid) return;
		setContinueLoading(true);
		try {
			const loaded = await loadDailyCards(practicedKeysRef.current);
			if (loaded.length === 0) {
				return;
			}
			beginSession(loaded, mode, false, { keepSid: sid });
		} finally {
			setContinueLoading(false);
		}
	}, [beginSession, mode, sid]);

	const onRetryWrong = useCallback(() => {
		if (!sid) return;
		const wrong = new Map<string, DailyVocabCard>();
		for (const round of sessionRounds) {
			for (const card of round.wrongCards) {
				if (!wrong.has(card.key)) wrong.set(card.key, card);
			}
		}
		if (wrong.size === 0) return;
		beginSession(shufflePracticeItems([...wrong.values()]), mode, true, {
			keepSid: sid,
		});
	}, [beginSession, mode, sessionRounds, sid]);

	const onBackToSetup = useCallback(() => {
		resetToIntro();
		goIntro();
		setBannerEpoch((n) => n + 1);
	}, [goIntro, resetToIntro]);

	const applyDraftToState = useCallback((d: DailySessionDraft) => {
		setSid(d.sid);
		setMode(d.mode);
		setReportSaveMode(d.reportSaveMode);
		setCards(d.cards);
		setCardIndex(d.index);
		setPendingRecords(d.pendingRecords);
		setSessionRounds(d.sessionRounds);
		setSummary(d.summary);
		setIsRetryWrong(d.isRetryWrong);
		practicedKeysRef.current = d.practicedKeys;
		allowEmptyDoneRef.current = Boolean(d.allowEmptyDone);
	}, []);

	const onContinueResume = useCallback(
		(nextMode: DailyMemorizeMode) => {
			if (!unfinished) return;
			const d = loadDailyDraft(unfinished.sid);
			if (!d) {
				setBannerEpoch((n) => n + 1);
				return;
			}
			const next = { ...d, mode: nextMode };
			saveDailyDraft(next);
			applyDraftToState(next);
			skipStageGuardRef.current = true;
			if (next.phase === 'done') goDone(next.sid);
			else goSession(next.sid);
		},
		[applyDraftToState, goDone, goSession, unfinished],
	);

	const onDiscardResume = useCallback(() => {
		if (!unfinished) return;
		clearDailyDraft(unfinished.sid);
		setBannerEpoch((n) => n + 1);
	}, [unfinished]);

	const onCardProgress = useCallback(
		(progress: { index: number; pendingRecords: DailyPendingRecord[] }) => {
			setCardIndex(progress.index);
			setPendingRecords(progress.pendingRecords);
		},
		[],
	);

	useEffect(() => {
		if (skipStageGuardRef.current) {
			skipStageGuardRef.current = false;
			return;
		}
		if (phase === 'session' && cards.length === 0) {
			goIntro();
			return;
		}
		if (
			phase === 'done' &&
			summary == null &&
			sessionRounds.length === 0 &&
			!allowEmptyDoneRef.current
		) {
			goIntro();
		}
	}, [cards.length, goIntro, phase, sessionRounds.length, summary]);

	const title = t('route.englishLearning.daily.title');
	const backLabel = t('englishLearning.daily.backHome');

	return (
		<DailyPageLayout
			title={title}
			onBack={backHome}
			backLabel={backLabel}
			contentLayout="fill"
			flush
		>
			{phase === 'intro' ? (
				<DailyIntroPanel
					starting={starting}
					replaceUnfinished={Boolean(unfinished)}
					resume={
						unfinished
							? {
									sid: unfinished.sid,
									description:
										unfinished.phase === 'done'
											? t('englishLearning.sessionDraft.dailyDone')
											: t('englishLearning.sessionDraft.dailyRunning', {
													current: unfinished.current,
													total: unfinished.total,
												}),
									continueLabel: t('englishLearning.sessionDraft.continue'),
									discardLabel: t('englishLearning.sessionDraft.discard'),
									mode: unfinished.mode,
									reportSaveMode: unfinished.reportSaveMode,
									wordsPerRound: unfinished.wordsPerRound,
								}
							: null
					}
					onContinueResume={onContinueResume}
					onDiscardResume={onDiscardResume}
					onStart={(nextMode, nextReportSaveMode) =>
						void onStart(nextMode, nextReportSaveMode)
					}
				/>
			) : null}

			{phase === 'session' && cards.length > 0 ? (
				<DailyCardSession
					key={`${sid}:${cards.map((c) => c.key).join(',')}`}
					cards={cards}
					mode={mode}
					initialIndex={cardIndex}
					initialPendingRecords={pendingRecords}
					onProgress={onCardProgress}
					onComplete={onComplete}
				/>
			) : null}

			{phase === 'done' ? (
				<DailyDonePanel
					mode={mode}
					summary={summary}
					rounds={sessionRounds}
					reportSaveMode={reportSaveMode}
					isRetryWrong={isRetryWrong}
					continueLoading={continueLoading}
					onBackHome={backHome}
					onContinuePractice={() => void onContinuePractice()}
					onRetryWrong={onRetryWrong}
					onBackToSetup={onBackToSetup}
				/>
			) : null}
			<Outlet />
		</DailyPageLayout>
	);
}

function mergeKeys(prev: string[], next: string[]): string[] {
	const set = new Set(prev);
	for (const k of next) set.add(k);
	return [...set];
}
