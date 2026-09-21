import { Button } from '@ui/index';
import { useNavigate } from 'react-router';
import { useI18n } from '@/hooks';
import { cn } from '@/lib/utils';
import { SessionHeader } from '../../components/SessionHeader';
import { PRACTICE_PRIMARY_ACTION_BTN_CLASS } from '../../practice/constants';

type DailyDonePanelProps = {
	title: string;
	onBackHome: () => void;
};

export function DailyDonePanel({ title, onBackHome }: DailyDonePanelProps) {
	const { t } = useI18n();
	const navigate = useNavigate();

	return (
		<div className="flex h-full min-h-0 w-full flex-1 flex-col">
			<SessionHeader className="px-3.5">
				<span className="min-w-0 truncate">{title}</span>
			</SessionHeader>
			<div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden p-4">
				<div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-2 text-center">
					<p className="text-textcolor text-lg font-semibold">
						{t('englishLearning.daily.doneTitle')}
					</p>
					<p className="text-textcolor/55 max-w-sm text-sm leading-relaxed">
						{t('englishLearning.daily.doneDesc')}
					</p>
				</div>
				<div className="mx-auto flex w-full max-w-4xl shrink-0 gap-2">
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
		</div>
	);
}
