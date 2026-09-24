import Confirm from '@design/Confirm';
import { Spinner, Toast } from '@ui/index';
import { Sparkles } from 'lucide-react';
import { observer } from 'mobx-react';
import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { useI18n } from '@/hooks';
import { cn } from '@/lib/utils';
import { hasValidAuthToken } from '@/router/authPaths';
import {
	getEnglishDailyMemorizeSummary,
	resetEnglishDailyMemorizeLibrary,
} from '@/service';
import englishDailyStore from '@/store/englishDaily';
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
import { EnglishSidebarCard } from './EnglishSidebarCard';

/** 首页侧栏：今日记词 */
export const DailySession = observer(function DailySession() {
	const { t } = useI18n();
	const navigate = useNavigate();
	const [loading, setLoading] = useState(true);
	const [memorizedCount, setMemorizedCount] = useState(0);
	const [resetConfirmOpen, setResetConfirmOpen] = useState(false);
	const [resetting, setResetting] = useState(false);

	const libraryCount = englishDailyStore.libraryCount ?? 0;

	const loadSummary = useCallback(async () => {
		setLoading(true);
		englishDailyStore.beginLibraryCount();
		try {
			if (hasValidAuthToken()) {
				const res = await getEnglishDailyMemorizeSummary({ silent: true });
				englishDailyStore.setLibraryCount(res.data?.libraryCount ?? 0);
				englishDailyStore.setMemorizedCount(res.data?.memorizedCount ?? 0);
				setMemorizedCount(res.data?.memorizedCount ?? 0);
			} else {
				englishDailyStore.setLibraryCount(countStarterLibraryEligible());
				const n = countStarterMemorized();
				englishDailyStore.setMemorizedCount(n);
				setMemorizedCount(n);
			}
		} catch {
			englishDailyStore.setLibraryCount(0);
			englishDailyStore.setMemorizedCount(0);
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
	const canReset = !loading && memorizedCount > 0;
	const canStart = !loading && (!isLoggedIn || libraryCount > 0);

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
		<EnglishSidebarCard
			className="min-w-0"
			prepend={
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
			}
			resumeModuleKey="daily-memorize"
			icon={Sparkles}
			iconGradient={ENGLISH_SIDEBAR_ICON_GRADIENT.daily}
			title={t('route.englishLearning.daily.title')}
			description={
				loading ? (
					<span className="inline-flex items-start gap-1.5">
						<Spinner className="size-3 text-textcolor/50 mt-0.5" />
						{t('englishLearning.daily.loading')}
					</span>
				) : (
					t('englishLearning.daily.sidebarDescLibrary')
				)
			}
			actions={[
				{
					label: t('englishLearning.daily.startLibrary'),
					onClick: () => navigate('/english-learning/daily'),
					disabled: !canStart,
					gradientKey: 'daily',
				},
				{
					label: t('englishLearning.daily.memorizedLink'),
					onClick: () => navigate('/english-learning/daily/records'),
					gradientKey: 'daily',
				},
			]}
		>
			<div className="mt-2 min-w-0">
				<div className="flex items-center justify-between gap-2">
					<p className="text-textcolor/45 text-sm font-medium tracking-wide">
						{t('englishLearning.daily.sidebarStatsLabel')}
					</p>
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
				</div>
				<div className="mt-2 grid grid-cols-2 gap-3">
					<div
						className={cn(
							'flex min-w-0 items-center justify-between gap-2 rounded-md border px-2.5 pt-1.5 pb-2',
							'border-emerald-500/20 bg-linear-to-r from-emerald-400/10 to-teal-500/10',
						)}
					>
						<span className="text-textcolor/55 shrink-0 text-xs font-medium">
							{t('englishLearning.daily.sidebarStatMemorized')}
						</span>
						<span className="text-emerald-600 dark:text-emerald-400 min-w-0 truncate text-base font-semibold tabular-nums leading-none">
							{loading ? '…' : memorizedCount}
						</span>
					</div>
					<div
						className={cn(
							'flex min-w-0 items-center justify-between gap-2 rounded-md border px-2.5 pt-1.5 pb-2',
							'border-sky-500/20 bg-linear-to-r from-sky-400/10 to-cyan-500/10',
						)}
					>
						<span className="text-textcolor/55 shrink-0 text-xs font-medium">
							{t('englishLearning.daily.sidebarStatPending')}
						</span>
						<span className="text-sky-700 dark:text-cyan-400 min-w-0 truncate text-base font-semibold tabular-nums leading-none">
							{loading ? '…' : libraryCount}
						</span>
					</div>
				</div>
			</div>
		</EnglishSidebarCard>
	);
});
