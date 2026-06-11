import { Button, Spinner } from '@ui/index';
import { CalendarClock } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { useI18n } from '@/hooks';
import { cn } from '@/lib/utils';
import { getEnglishPracticeReviewSummary } from '@/service';
import { useOpenEnglishPractice } from '../../components/practiceEntry';
import { ENGLISH_REVIEW_SUMMARY_REFRESH } from '../reviewEvents';
import {
	ENGLISH_SIDEBAR_BTN_GRADIENT,
	ENGLISH_SIDEBAR_ICON_GRADIENT,
} from '../sidebarAccents';

/** 首页侧栏：今日间隔复习 */
export function ReviewSession() {
	const { t } = useI18n();
	const openPractice = useOpenEnglishPractice();
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
		<div className="rounded-none pt-4 @container min-w-0 mt-3.5">
			<div className="mb-3.5 flex items-start gap-3">
				<div
					className={cn(
						'flex size-10 shrink-0 items-center justify-center rounded-md',
						ENGLISH_SIDEBAR_ICON_GRADIENT.review,
					)}
				>
					<CalendarClock className="size-6 text-white" aria-hidden />
				</div>
				<div className="min-w-0 flex-1 flex flex-col justify-between">
					<div className="text-textcolor font-semibold leading-tight">
						{t('route.englishLearning.review.title')}
					</div>
					<div className="h-5 flex items-center justify-between gap-2 text-textcolor/50 mt-1 text-xs leading-snug">
						{loading ? (
							<span className="inline-flex items-center gap-1.5">
								<Spinner className="size-3" />
								{t('englishLearning.review.loadingDue')}
							</span>
						) : (
							t('englishLearning.review.homeDesc', { count: totalDue })
						)}
					</div>
				</div>
			</div>
			<div className="flex flex-wrap items-center gap-3.5 mt-4.5">
				<Button
					type="button"
					size="sm"
					disabled={loading || vocabDue <= 0}
					className={cn(
						'h-9 min-w-0 flex-1 gap-2 rounded-md px-3 text-white',
						ENGLISH_SIDEBAR_BTN_GRADIENT.review,
					)}
					onClick={() =>
						openPractice({
							source: 'review',
							contentKind: 'vocab',
							returnTo: 'home',
						})
					}
				>
					{t('englishLearning.review.vocabNav', { count: vocabDue })}
				</Button>
				<Button
					type="button"
					size="sm"
					disabled={loading || classicDue <= 0}
					className={cn(
						'h-9 min-w-0 flex-1 gap-2 rounded-md px-3 text-white',
						ENGLISH_SIDEBAR_BTN_GRADIENT.review,
					)}
					onClick={() =>
						openPractice({
							source: 'review',
							contentKind: 'classic',
							returnTo: 'home',
						})
					}
				>
					{t('englishLearning.review.classicNav', { count: classicDue })}
				</Button>
			</div>
		</div>
	);
}
