import Confirm from '@design/Confirm';
import { Spinner, Toast } from '@ui/index';
import { Sparkles } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { useI18n } from '@/hooks';
import { cn } from '@/lib/utils';
import { hasValidAuthToken } from '@/router/authPaths';
import {
	getEnglishDailyMemorizeSummary,
	resetEnglishDailyMemorizeLibrary,
} from '@/service';
import { DailyWordsPerRoundPicker } from '../../daily/components/DailyWordsPerRoundPicker';
import { useDailyWordCount } from '../../daily/hooks/useDailyWordCount';
import {
	countStarterLibraryEligible,
	countStarterMemorized,
	resetStarterLibraryMemorizeProgress,
} from '../../daily/utils/localSrs';
import {
	dispatchEnglishReviewSummaryRefresh,
	ENGLISH_REVIEW_SUMMARY_REFRESH,
} from '../reviewEvents';
import {
	ENGLISH_SIDEBAR_ICON_GRADIENT,
	ENGLISH_SIDEBAR_TEXT_LINK_GRADIENT,
} from '../sidebarAccents';
import { EnglishSidebarActions } from './EnglishSidebarActions';
import { EnglishSidebarHeader } from './EnglishSidebarHeader';
import { SidebarPanel } from './SidebarPanel';

/** 首页侧栏：今日记词 */
export function DailySession() {
	const { t } = useI18n();
	const navigate = useNavigate();
	const [loading, setLoading] = useState(true);
	const [libraryCount, setLibraryCount] = useState(0);
	const [memorizedCount, setMemorizedCount] = useState(0);
	const [resetConfirmOpen, setResetConfirmOpen] = useState(false);
	const [resetting, setResetting] = useState(false);
	const [wordsPerRound] = useDailyWordCount();

	const loadSummary = useCallback(async () => {
		setLoading(true);
		try {
			if (hasValidAuthToken()) {
				const res = await getEnglishDailyMemorizeSummary({ silent: true });
				setLibraryCount(res.data?.libraryCount ?? 0);
				setMemorizedCount(res.data?.memorizedCount ?? 0);
			} else {
				setLibraryCount(countStarterLibraryEligible());
				setMemorizedCount(countStarterMemorized());
			}
		} catch {
			setLibraryCount(0);
			setMemorizedCount(0);
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

	const isLoggedIn = hasValidAuthToken();
	const libraryPickCount = Math.min(wordsPerRound, libraryCount);
	const canReset = !loading && memorizedCount > 0;

	const onConfirmReset = useCallback(async () => {
		setResetting(true);
		try {
			if (isLoggedIn) {
				const res = await resetEnglishDailyMemorizeLibrary();
				const removed = res.data?.recordsRemoved ?? 0;
				Toast({
					type: 'success',
					title: t('englishLearning.daily.resetSuccess', { count: removed }),
				});
			} else {
				resetStarterLibraryMemorizeProgress();
				Toast({
					type: 'success',
					title: t('englishLearning.daily.resetSuccessGuest'),
				});
			}
			setResetConfirmOpen(false);
			dispatchEnglishReviewSummaryRefresh();
			await loadSummary();
		} catch {
			Toast({
				type: 'error',
				title: t('englishLearning.daily.resetFailed'),
			});
		} finally {
			setResetting(false);
		}
	}, [isLoggedIn, loadSummary, t]);

	return (
		<SidebarPanel className="min-w-0">
			<Confirm
				open={resetConfirmOpen}
				onOpenChange={setResetConfirmOpen}
				title={t('englishLearning.daily.resetConfirmTitle')}
				description={t('englishLearning.daily.resetConfirmDesc', {
					count: memorizedCount,
				})}
				descriptionClassName="text-left"
				confirmText={t('englishLearning.daily.resetConfirmAction')}
				cancelText={t('common.cancel')}
				confirmVariant="destructive"
				closeOnConfirm={false}
				onConfirm={() => void onConfirmReset()}
			/>
			<EnglishSidebarHeader
				icon={Sparkles}
				iconGradient={ENGLISH_SIDEBAR_ICON_GRADIENT.daily}
				title={t('route.englishLearning.daily.title')}
				description={
					loading ? (
						<span className="inline-flex items-start gap-1.5">
							<Spinner className="size-3 text-textcolor/50 mt-0.5" />
							{t('englishLearning.daily.loading')}
						</span>
					) : libraryCount <= 0 ? (
						t('englishLearning.daily.sidebarDescLibraryEmpty')
					) : (
						t('englishLearning.daily.sidebarDescLibrary', {
							poolCount: libraryCount,
							sessionCount: libraryPickCount,
						})
					)
				}
			/>
			<DailyWordsPerRoundPicker
				className="mt-3"
				headerRight={
					<button
						type="button"
						disabled={!canReset || resetting || loading}
						className={cn(
							'shrink-0 text-sm leading-snug',
							!canReset || resetting || loading
								? 'text-textcolor/35 cursor-not-allowed'
								: cn(
										'cursor-pointer',
										ENGLISH_SIDEBAR_TEXT_LINK_GRADIENT.daily,
									),
						)}
						onClick={() => setResetConfirmOpen(true)}
					>
						{resetting
							? t('englishLearning.daily.resetting')
							: t('englishLearning.daily.resetLibrary')}
					</button>
				}
			/>
			<EnglishSidebarActions
				actions={[
					{
						label: t('englishLearning.daily.startLibrary'),
						onClick: () => navigate('/english-learning/daily'),
						disabled: loading || (isLoggedIn && libraryPickCount <= 0),
						gradientKey: 'daily',
					},
					{
						label: t('englishLearning.daily.memorizedLink'),
						onClick: () => navigate('/english-learning/daily/records'),
						gradientKey: 'daily',
					},
				]}
			/>
		</SidebarPanel>
	);
}
