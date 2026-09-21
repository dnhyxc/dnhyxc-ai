import { Button, Spinner } from '@ui/index';
import { observer } from 'mobx-react';
import { useEffect } from 'react';
import { useI18n } from '@/hooks';
import { cn } from '@/lib/utils';
import { hasValidAuthToken } from '@/router/authPaths';
import { getEnglishDailyMemorizeSummary } from '@/service';
import englishDailyStore from '@/store/englishDaily';
import { SessionHeader } from '../../components/SessionHeader';
import { PRACTICE_PRIMARY_ACTION_BTN_CLASS } from '../../practice/constants';
import { useDailyWordCount } from '../hooks/useDailyWordCount';
import { countStarterLibraryEligible } from '../utils/localSrs';

type DailyIntroPanelProps = {
	onBack: () => void;
	backLabel: string;
	starting: boolean;
	onStart: () => void;
};

export const DailyIntroPanel = observer(function DailyIntroPanel({
	starting,
	onStart,
}: DailyIntroPanelProps) {
	const { t } = useI18n();
	const isLoggedIn = hasValidAuthToken();
	const [wordsPerRound] = useDailyWordCount();
	const pendingCount = englishDailyStore.libraryCount;

	useEffect(() => {
		if (
			englishDailyStore.libraryCount != null ||
			englishDailyStore.libraryCountLoading
		) {
			return;
		}
		if (!hasValidAuthToken()) {
			englishDailyStore.setLibraryCount(countStarterLibraryEligible());
			return;
		}
		englishDailyStore.beginLibraryCount();
		void getEnglishDailyMemorizeSummary({ silent: true })
			.then((res) =>
				englishDailyStore.setLibraryCount(res.data?.libraryCount ?? 0),
			)
			.catch(() => englishDailyStore.setLibraryCount(0));
	}, []);

	return (
		<div className="flex h-full min-h-0 w-full flex-1 flex-col">
			<SessionHeader className="px-3.5">
				{t('englishLearning.daily.pendingCount', {
					count: pendingCount ?? '…',
				})}
			</SessionHeader>
			<div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden p-4">
				<div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 text-center">
					<p className="text-textcolor text-lg font-semibold leading-snug">
						{t('englishLearning.daily.introTitle')}
					</p>
					<p className="text-textcolor/55 max-w-md text-sm leading-relaxed">
						{t('englishLearning.daily.introDesc', { count: wordsPerRound })}
					</p>
					<p className="text-textcolor/65 max-w-md text-sm leading-relaxed">
						{t('englishLearning.daily.introHint')}
					</p>
					{!isLoggedIn ? (
						<p className="text-textcolor/45 max-w-md text-xs leading-snug">
							{t('englishLearning.daily.guestHint')}
						</p>
					) : null}
				</div>
				<Button
					type="button"
					className={cn(
						'mx-auto h-10 w-full max-w-4xl shrink-0 gap-2',
						PRACTICE_PRIMARY_ACTION_BTN_CLASS,
					)}
					disabled={starting}
					onClick={onStart}
				>
					{starting ? (
						<>
							<Spinner className="size-4 text-white" />
							{t('englishLearning.daily.loading')}
						</>
					) : (
						t('englishLearning.daily.startLibrary')
					)}
				</Button>
			</div>
		</div>
	);
});
