/**
 * 英语学习：今日记词（intro / session / done）
 */
import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router';
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
	const [phase, setPhase] = useState<PagePhase>('intro');
	const [starting, setStarting] = useState(false);
	const [cards, setCards] = useState<DailyVocabCard[]>([]);

	const backHome = useCallback(() => {
		navigate('/english-learning');
	}, [navigate]);

	const onStart = useCallback(async () => {
		setStarting(true);
		try {
			const loaded = await loadDailyCards();
			if (loaded.length === 0) {
				setCards([]);
				setPhase('done');
				return;
			}
			setCards(loaded);
			setPhase('session');
		} finally {
			setStarting(false);
		}
	}, []);

	const title = t('route.englishLearning.daily.title');
	const backLabel = t('englishLearning.daily.backHome');

	return (
		<DailyPageLayout
			title={title}
			onBack={backHome}
			backLabel={backLabel}
			contentLayout="center"
		>
			{phase === 'intro' ? (
				<DailyIntroPanel starting={starting} onStart={() => void onStart()} />
			) : null}

			{phase === 'session' && cards.length > 0 ? (
				<DailyCardSession cards={cards} onComplete={() => setPhase('done')} />
			) : null}

			{phase === 'done' ? <DailyDonePanel onBackHome={backHome} /> : null}
		</DailyPageLayout>
	);
}
