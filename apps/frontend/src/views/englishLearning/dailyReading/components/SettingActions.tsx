import { Button } from '@ui/index';
import { useI18n } from '@/hooks';
import { cn } from '@/lib/utils';
import { PRACTICE_PRIMARY_ACTION_BTN_CLASS } from '../../practice/constants';
import { LABEL, OPT_OFF } from './classes';

const OPT_BTN = cn(
	'flex h-10 w-full cursor-pointer items-center justify-center rounded-md text-base font-semibold disabled:cursor-not-allowed',
	PRACTICE_PRIMARY_ACTION_BTN_CLASS,
);

export function SettingActions({
	dirty,
	isDefault,
	disabled,
	onSave,
	onReset,
}: {
	dirty: boolean;
	isDefault: boolean;
	disabled: boolean;
	onSave: () => void;
	onReset: () => void;
}) {
	const { t } = useI18n();
	if (!dirty && isDefault) return null;
	return (
		<div className="flex min-w-0 flex-1 flex-col gap-3">
			<h2 className={LABEL}>{t('englishLearning.dailyReading.actions')}</h2>
			<div
				className={cn(
					'grid gap-4',
					dirty && !isDefault ? 'grid-cols-2' : 'grid-cols-1',
				)}
			>
				{!isDefault ? (
					<Button
						type="button"
						variant="ghost"
						disabled={disabled}
						className={cn(
							'h-10 w-full border text-base font-semibold',
							OPT_OFF,
						)}
						onClick={onReset}
					>
						{t('englishLearning.dailyReading.themeReset')}
					</Button>
				) : null}
				{dirty ? (
					<button
						type="button"
						disabled={disabled}
						className={OPT_BTN}
						onClick={onSave}
					>
						{t('englishLearning.dailyReading.save')}
					</button>
				) : null}
			</div>
		</div>
	);
}
