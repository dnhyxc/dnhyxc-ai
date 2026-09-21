import { Spinner } from '@ui/index';
import { CalendarClock } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { useI18n } from '@/hooks';
import { getEnglishPracticeReviewSummary } from '@/service';
import { ENGLISH_REVIEW_SUMMARY_REFRESH } from '../reviewEvents';
import { ENGLISH_SIDEBAR_ICON_GRADIENT } from '../sidebarAccents';
import { EnglishSidebarCard } from './EnglishSidebarCard';

/** 首页侧栏：今日间隔复习 → 进入待复习列表 */
export function ReviewSession() {
	const { t } = useI18n();
	const navigate = useNavigate();
	const [loading, setLoading] = useState(true);
	const [vocabDue, setVocabDue] = useState(0);
	const [classicDue, setClassicDue] = useState(0);

	const loadSummary = useCallback(async () => {
		setLoading(true);
		try {
			const res = await getEnglishPracticeReviewSummary({ silent: true });
			setVocabDue(res.data?.vocabDue ?? 0);
			setClassicDue(res.data?.classicDue ?? 0);
		} catch {
			setVocabDue(0);
			setClassicDue(0);
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		void loadSummary();
		const onRefresh = () => void loadSummary();
		window.addEventListener(ENGLISH_REVIEW_SUMMARY_REFRESH, onRefresh);
		return () => {
			window.removeEventListener(ENGLISH_REVIEW_SUMMARY_REFRESH, onRefresh);
		};
	}, [loadSummary]);

	const totalDue = vocabDue + classicDue;

	return (
		<EnglishSidebarCard
			className="@container min-w-0"
			icon={CalendarClock}
			iconGradient={ENGLISH_SIDEBAR_ICON_GRADIENT.review}
			headerClassName="mb-5.5"
			title={t('route.englishLearning.review.title')}
			description={
				loading ? (
					<span className="inline-flex items-center gap-1.5">
						<Spinner className="size-3" />
						{t('englishLearning.review.loadingDue')}
					</span>
				) : (
					t('englishLearning.review.homeDesc', { count: totalDue })
				)
			}
			actions={[
				{
					label: t('englishLearning.review.vocabNav', { count: vocabDue }),
					onClick: () => navigate('/english-learning/review?kind=vocab'),
					disabled: loading,
					gradientKey: 'review',
				},
				{
					label: t('englishLearning.review.classicNav', { count: classicDue }),
					onClick: () => navigate('/english-learning/review?kind=classic'),
					disabled: loading,
					gradientKey: 'review',
				},
			]}
		/>
	);
}
