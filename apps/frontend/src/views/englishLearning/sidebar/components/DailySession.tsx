import Confirm from '@design/Confirm';
import { Button, Spinner, Toast } from '@ui/index';
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
import { DailyWordsPerRoundPopover } from '../../daily/components/DailyWordsPerRoundPopover';
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
	ENGLISH_SIDEBAR_BTN_GRADIENT,
	ENGLISH_SIDEBAR_ICON_GRADIENT,
	ENGLISH_SIDEBAR_TEXT_LINK_GRADIENT,
} from '../sidebarAccents';
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
			<div className="mb-3.5 flex items-start gap-3">
				<div
					className={cn(
						'flex size-10 shrink-0 items-center justify-center rounded-md',
						ENGLISH_SIDEBAR_ICON_GRADIENT.daily,
					)}
				>
					<Sparkles className="size-6 text-white" aria-hidden />
				</div>
				<div className="min-w-0 flex-1 flex flex-col justify-between">
					<div className="flex items-center justify-between gap-2">
						<div className="text-textcolor min-w-0 font-semibold leading-tight">
							{t('route.englishLearning.daily.title')}
						</div>
						<div className="flex shrink-0 items-center gap-3">
							<DailyWordsPerRoundPopover />
							<button
								type="button"
								disabled={!canReset || resetting || loading}
								className={cn(
									'text-xs leading-snug',
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
					</div>
					<div className="text-textcolor/50 mt-1 flex h-5 items-center gap-2 text-xs leading-snug">
						{loading ? (
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
						)}
					</div>
				</div>
			</div>
			<div className="mt-4.5 flex flex-wrap items-center gap-3.5">
				<Button
					type="button"
					size="sm"
					disabled={loading || (isLoggedIn && libraryPickCount <= 0)}
					className={cn(
						'h-9 min-w-0 flex-1 gap-1.5 rounded-md px-2 text-sm text-white',
						ENGLISH_SIDEBAR_BTN_GRADIENT.daily,
					)}
					onClick={() => navigate('/english-learning/daily')}
				>
					{t('englishLearning.daily.startLibrary')}
				</Button>
				<Button
					type="button"
					size="sm"
					className={cn(
						'h-9 min-w-0 flex-1 gap-1.5 rounded-md px-2 text-sm text-white',
						ENGLISH_SIDEBAR_BTN_GRADIENT.daily,
					)}
					onClick={() => navigate('/english-learning/daily/records')}
				>
					{t('englishLearning.daily.memorizedLink')}
				</Button>
			</div>
		</SidebarPanel>
	);
}
