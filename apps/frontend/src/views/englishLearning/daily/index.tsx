/**
 * 英语学习：今日记词（intro / session / done）
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { useI18n } from '@/hooks';
import { DailyCardSession } from './components/DailyCardSession';
import { DailyDonePanel } from './components/DailyDonePanel';
import { DailyIntroPanel } from './components/DailyIntroPanel';
import { DailyPageLayout } from './components/DailyPageLayout';
import type { DailyVocabCard } from './types';
import { loadDailyCards } from './utils/loadDailyCards';

type PagePhase = 'intro' | 'session' | 'done';

export default function EnglishLearningDailyPage() {
	const { t } = useI18n();
	const navigate = useNavigate();
	const [searchParams, setSearchParams] = useSearchParams();
	const [phase, setPhase] = useState<PagePhase>('intro');
	const [starting, setStarting] = useState(false);
	const [cards, setCards] = useState<DailyVocabCard[]>([]);
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
	}, []);

	const onStart = useCallback(async () => {
		setStarting(true);
		try {
			const loaded = await loadDailyCards();
			if (loaded.length === 0) {
				setCards([]);
				clearDailyRunning();
				setPhase('done');
				return;
			}
			setCards(loaded);
			markDailyRunning();
			setPhase('session');
		} finally {
			setStarting(false);
		}
	}, [clearDailyRunning, markDailyRunning]);

	const onComplete = useCallback(() => {
		clearDailyRunning();
		setPhase('done');
	}, [clearDailyRunning]);

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
					onBack={backHome}
					backLabel={backLabel}
					starting={starting}
					onStart={() => void onStart()}
				/>
			) : null}

			{phase === 'session' && cards.length > 0 ? (
				<DailyCardSession cards={cards} onComplete={onComplete} />
			) : null}

			{phase === 'done' ? (
				<DailyDonePanel title={title} onBackHome={backHome} />
			) : null}
		</DailyPageLayout>
	);
}
