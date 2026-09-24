/**
 * 英语学习：今日记词（intro / session / done）
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
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
import { loadDailyCards } from './utils/loadDailyCards';

type PagePhase = 'intro' | 'session' | 'done';

export default function EnglishLearningDailyPage() {
	const { t } = useI18n();
	const navigate = useNavigate();
	const [searchParams, setSearchParams] = useSearchParams();
	const [phase, setPhase] = useState<PagePhase>('intro');
	const [starting, setStarting] = useState(false);
	const [continueLoading, setContinueLoading] = useState(false);
	const [cards, setCards] = useState<DailyVocabCard[]>([]);
	const [mode, setMode] = useState<DailyMemorizeMode>('recognition');
	const [reportSaveMode, setReportSaveMode] =
		useState<PracticeReportSaveMode>('manual');
	const [summary, setSummary] = useState<DailySessionSummary | null>(null);
	const [sessionRounds, setSessionRounds] = useState<DailySessionRound[]>([]);
	const [isRetryWrong, setIsRetryWrong] = useState(false);
	const practicedKeysRef = useRef<string[]>([]);
	const skipRunResetRef = useRef(false);

	const backHome = useCallback(() => {
		navigate('/english-learning');
	}, [navigate]);

	const markDailyRunning = useCallback(() => {
		skipRunResetRef.current = true;
		setSearchParams(
			(prev) => {
				const next = new URLSearchParams(prev);
				next.set('run', '1');
				return next;
			},
			{ replace: true },
		);
	}, [setSearchParams]);

	const clearDailyRunning = useCallback(() => {
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
		setPhase('intro');
		setCards([]);
		setSummary(null);
		setSessionRounds([]);
		setIsRetryWrong(false);
		practicedKeysRef.current = [];
	}, []);

	const beginSession = useCallback(
		(
			nextCards: DailyVocabCard[],
			nextMode: DailyMemorizeMode,
			retry: boolean,
		) => {
			setMode(nextMode);
			setCards(nextCards);
			setSummary(null);
			setIsRetryWrong(retry);
			practicedKeysRef.current = mergeKeys(
				practicedKeysRef.current,
				nextCards.map((c) => c.key),
			);
			markDailyRunning();
			setPhase('session');
		},
		[markDailyRunning],
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
					setCards([]);
					clearDailyRunning();
					setPhase('done');
					return;
				}
				beginSession(loaded, nextMode, false);
			} finally {
				setStarting(false);
			}
		},
		[beginSession, clearDailyRunning],
	);

	const onComplete = useCallback(
		(next: DailySessionSummary) => {
			if (isRetryWrong) {
				// 重练不追加轮次：改对的词从历轮 wrong 挪到 correct，提升总正确率
				const correctKeys = new Set(next.correctCards.map((c) => c.key));
				setSessionRounds((prev) =>
					prev.map((round) => {
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
					}),
				);
				setIsRetryWrong(false);
			} else {
				setSessionRounds((prev) => {
					const maxIdx = prev.reduce((m, r) => Math.max(m, r.roundIndex), 0);
					return [
						...prev,
						{
							roundIndex: maxIdx + 1,
							wrongCards: next.wrongCards,
							correctCards: next.correctCards,
							completedAt: new Date().toISOString(),
						},
					];
				});
			}
			setSummary(next);
			clearDailyRunning();
			setPhase('done');
		},
		[clearDailyRunning, isRetryWrong],
	);

	const onContinuePractice = useCallback(async () => {
		setContinueLoading(true);
		try {
			const loaded = await loadDailyCards(practicedKeysRef.current);
			if (loaded.length === 0) {
				return;
			}
			beginSession(loaded, mode, false);
		} finally {
			setContinueLoading(false);
		}
	}, [beginSession, mode]);

	const onRetryWrong = useCallback(() => {
		const wrong = new Map<string, DailyVocabCard>();
		for (const round of sessionRounds) {
			for (const card of round.wrongCards) {
				if (!wrong.has(card.key)) wrong.set(card.key, card);
			}
		}
		if (wrong.size === 0) return;
		beginSession(shufflePracticeItems([...wrong.values()]), mode, true);
	}, [beginSession, mode, sessionRounds]);

	useEffect(() => {
		if (searchParams.get('run') === '1') {
			skipRunResetRef.current = false;
			return;
		}
		if (skipRunResetRef.current || phase !== 'session') return;
		resetToIntro();
	}, [phase, resetToIntro, searchParams]);

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
					onStart={(nextMode, nextReportSaveMode) =>
						void onStart(nextMode, nextReportSaveMode)
					}
				/>
			) : null}

			{phase === 'session' && cards.length > 0 ? (
				<DailyCardSession cards={cards} mode={mode} onComplete={onComplete} />
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
					onBackToSetup={resetToIntro}
				/>
			) : null}
		</DailyPageLayout>
	);
}

function mergeKeys(prev: string[], next: string[]): string[] {
	const set = new Set(prev);
	for (const k of next) set.add(k);
	return [...set];
}
