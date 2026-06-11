import { Button } from '@ui/index';
import { useNavigate } from 'react-router';
import { useI18n } from '@/hooks';
import { cn } from '@/lib/utils';
import { PracticeCard } from '../../practice/components/shell';
import {
	PRACTICE_PAGE_CONTENT_CLASS,
	PRACTICE_PRIMARY_ACTION_BTN_CLASS,
} from '../../practice/constants';
import { DAILY_FOOTER_PANEL_CLASS } from '../constants';

type DailyDonePanelProps = {
	onBackHome: () => void;
};

export function DailyDonePanel({ onBackHome }: DailyDonePanelProps) {
	const { t } = useI18n();
	const navigate = useNavigate();

	return (
		<div className={PRACTICE_PAGE_CONTENT_CLASS}>
			<PracticeCard className="border-theme/10 overflow-hidden p-0 shadow-sm">
				<div className="border-theme/10 bg-teal-500/10 flex flex-col items-center gap-2 border-b px-4 py-8 text-center">
					<p className="text-textcolor text-lg font-semibold">
						{t('englishLearning.daily.doneTitle')}
					</p>
					<p className="text-textcolor/55 max-w-sm text-sm leading-relaxed">
						{t('englishLearning.daily.doneDesc')}
					</p>
				</div>
				<div className="border-theme/10 border-t px-4 py-4">
					<div className={cn(DAILY_FOOTER_PANEL_CLASS, 'flex gap-2')}>
						<Button
							type="button"
							className={cn(
								'h-10 min-w-0 flex-1 gap-2',
								PRACTICE_PRIMARY_ACTION_BTN_CLASS,
							)}
							onClick={onBackHome}
						>
							{t('englishLearning.daily.backHome')}
						</Button>
						<Button
							type="button"
							className={cn(
								'h-10 min-w-0 flex-1 gap-2',
								PRACTICE_PRIMARY_ACTION_BTN_CLASS,
							)}
							onClick={() => navigate('/english-learning/daily/records')}
						>
							{t('englishLearning.daily.memorizedLink')}
						</Button>
					</div>
				</div>
			</PracticeCard>
		</div>
	);
}
