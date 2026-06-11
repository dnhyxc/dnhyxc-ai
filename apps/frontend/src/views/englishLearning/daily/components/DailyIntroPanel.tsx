import { Button, Spinner } from '@ui/index';
import { Sparkles } from 'lucide-react';
import { useI18n } from '@/hooks';
import { cn } from '@/lib/utils';
import { hasValidAuthToken } from '@/router/authPaths';
import { PracticeCard } from '../../practice/components/shell';
import {
	PRACTICE_PAGE_CONTENT_CLASS,
	PRACTICE_PRIMARY_ACTION_BTN_CLASS,
} from '../../practice/constants';
import { DAILY_FOOTER_PANEL_CLASS } from '../constants';
import { useDailyWordCount } from '../hooks/useDailyWordCount';

type DailyIntroPanelProps = {
	starting: boolean;
	onStart: () => void;
};

export function DailyIntroPanel({ starting, onStart }: DailyIntroPanelProps) {
	const { t } = useI18n();
	const isLoggedIn = hasValidAuthToken();
	const [wordsPerRound] = useDailyWordCount();

	return (
		<div className={PRACTICE_PAGE_CONTENT_CLASS}>
			<PracticeCard className="border-theme/10 overflow-hidden p-0 shadow-sm">
				<div className="border-theme/10 bg-teal-500/10 flex items-center gap-3 border-b px-4 py-3">
					<div className="bg-teal-500/15 flex size-10 shrink-0 items-center justify-center rounded-md">
						<Sparkles
							className="size-5 text-teal-600 dark:text-teal-400"
							aria-hidden
						/>
					</div>
					<div className="min-w-0 flex-1">
						<p className="text-textcolor text-sm font-semibold leading-snug">
							{t('englishLearning.daily.introTitle')}
						</p>
						<p className="text-textcolor/50 mt-1 text-xs leading-snug">
							{t('englishLearning.daily.introDesc', {
								count: wordsPerRound,
							})}
						</p>
					</div>
				</div>

				<div className="px-4 py-5">
					<p className="text-textcolor/65 text-center text-sm leading-relaxed">
						{t('englishLearning.daily.introHint')}
					</p>
					{!isLoggedIn ? (
						<p className="text-textcolor/45 mt-3 text-center text-xs leading-snug">
							{t('englishLearning.daily.guestHint')}
						</p>
					) : null}
				</div>

				<div className="border-theme/10 border-t px-4 py-4">
					<div className={DAILY_FOOTER_PANEL_CLASS}>
						<Button
							type="button"
							className={cn(
								'h-10 w-full gap-2',
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
			</PracticeCard>
		</div>
	);
}
