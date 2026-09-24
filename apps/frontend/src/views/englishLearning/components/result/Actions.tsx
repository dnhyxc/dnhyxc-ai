/**
 * 结算板 — 底部操作（单行、按功能区配色）
 */
import { Button, Spinner } from '@ui/index';
import {
	Archive,
	BookmarkPlus,
	ClipboardList,
	ListPlus,
	RotateCcw,
	Save,
	Settings2,
} from 'lucide-react';
import { useNavigate } from 'react-router';
import { cn } from '@/lib/utils';

export type ActionsProps = {
	hasWrongItems: boolean;
	continueLoading: boolean;
	saveMistakesLoading?: boolean;
	mistakesPath?: string;
	/** idle 可点；saving 转圈；saved 禁用；hidden 不展示 */
	reportSaveState?: 'idle' | 'saving' | 'saved' | 'hidden';
	labels: {
		retryWrong: string;
		practiceAgain: string;
		continuePractice: string;
		openMistakes: string;
		saveMistakes: string;
		saveReport: string;
		reportSaved: string;
		viewReports: string;
	};
	onRetryWrong: () => void;
	onBackToSetup: () => void;
	onContinuePractice: () => void;
	onSaveMistakes?: () => void;
	onSaveReport?: () => void;
	onViewReports?: () => void;
};

const ACTION_BTN_BASE = cn(
	'h-10 min-h-10 min-w-0 border flex-1 gap-1.5 px-0! text-sm font-medium shadow-none',
	'rounded-md transition-colors',
	'disabled:pointer-events-none disabled:opacity-50',
);

const ACTION_BTN_TONE = {
	retry: cn(
		ACTION_BTN_BASE,
		'border-rose-500/30 bg-rose-500/[0.18] text-rose-500',
		'hover:border-rose-500/45 hover:bg-rose-500/[0.15] mt-px',
	),
	continue: cn(
		ACTION_BTN_BASE,
		'border-teal-500/50 bg-teal-500/[0.3] text-teal-600',
		'hover:border-teal-500/55 hover:bg-teal-500/25 dark:text-teal-300',
	),
	setup: cn(
		ACTION_BTN_BASE,
		'border-sky-500/35 bg-sky-500/[0.18] text-sky-500',
		'hover:border-sky-500/50 hover:bg-sky-500/[0.14] dark:text-sky-300',
	),
	openMistakes: cn(
		ACTION_BTN_BASE,
		'border-orange-500/35 bg-orange-500/[0.18] text-orange-600',
		'hover:border-orange-500/50 hover:bg-orange-500/20 dark:text-orange-400',
	),
	saveMistakes: cn(
		ACTION_BTN_BASE,
		'border-amber-500/35 bg-amber-500/[0.18] text-amber-600',
		'hover:border-amber-500/50 hover:bg-amber-500/20 dark:text-amber-400',
	),
	saveReport: cn(
		ACTION_BTN_BASE,
		'border-violet-500/35 bg-violet-500/[0.18] text-violet-600',
		'hover:border-violet-500/50 hover:bg-violet-500/20 dark:text-violet-400',
	),
	viewReports: cn(
		ACTION_BTN_BASE,
		'border-theme/20 bg-theme/10 text-textcolor/80',
		'hover:border-theme/30 hover:bg-theme/15',
	),
} as const;

export function Actions({
	hasWrongItems,
	continueLoading,
	saveMistakesLoading = false,
	mistakesPath = '/english-learning/mistakes',
	reportSaveState = 'hidden',
	labels,
	onRetryWrong,
	onBackToSetup,
	onContinuePractice,
	onSaveMistakes,
	onSaveReport,
	onViewReports,
}: ActionsProps) {
	const navigate = useNavigate();
	const showSaveReport =
		reportSaveState !== 'hidden' && typeof onSaveReport === 'function';

	return (
		<div className="flex w-full shrink-0 flex-nowrap items-stretch gap-2">
			{hasWrongItems ? (
				<Button
					type="button"
					variant="ghost"
					className={ACTION_BTN_TONE.retry}
					onClick={onRetryWrong}
				>
					<RotateCcw className="size-3.5 shrink-0" aria-hidden />
					<span className="truncate">{labels.retryWrong}</span>
				</Button>
			) : null}
			<Button
				type="button"
				variant="ghost"
				disabled={continueLoading}
				className={ACTION_BTN_TONE.continue}
				onClick={onContinuePractice}
			>
				{continueLoading ? (
					<Spinner className="size-4 shrink-0 text-teal-500" />
				) : (
					<ListPlus className="size-3.5 shrink-0" aria-hidden />
				)}
				<span className="truncate">{labels.continuePractice}</span>
			</Button>
			<Button
				type="button"
				variant="ghost"
				className={ACTION_BTN_TONE.setup}
				onClick={onBackToSetup}
			>
				<Settings2 className="size-3.5 shrink-0" aria-hidden />
				<span className="truncate">{labels.practiceAgain}</span>
			</Button>
			{showSaveReport ? (
				<Button
					type="button"
					variant="ghost"
					disabled={reportSaveState === 'saving' || reportSaveState === 'saved'}
					className={ACTION_BTN_TONE.saveReport}
					onClick={() => void onSaveReport()}
				>
					{reportSaveState === 'saving' ? (
						<Spinner className="size-4 shrink-0 text-violet-600" />
					) : (
						<Save className="size-3.5 shrink-0" aria-hidden />
					)}
					<span className="truncate">
						{reportSaveState === 'saved'
							? labels.reportSaved
							: labels.saveReport}
					</span>
				</Button>
			) : null}
			{onViewReports ? (
				<Button
					type="button"
					variant="ghost"
					className={ACTION_BTN_TONE.viewReports}
					onClick={onViewReports}
				>
					<Archive className="size-3.5 shrink-0" aria-hidden />
					<span className="truncate">{labels.viewReports}</span>
				</Button>
			) : null}
			{hasWrongItems && onSaveMistakes ? (
				<Button
					type="button"
					variant="ghost"
					disabled={saveMistakesLoading}
					className={ACTION_BTN_TONE.saveMistakes}
					onClick={() => void onSaveMistakes()}
				>
					{saveMistakesLoading ? (
						<Spinner className="size-4 shrink-0 text-amber-600" />
					) : (
						<BookmarkPlus className="size-3.5 shrink-0" aria-hidden />
					)}
					<span className="truncate">{labels.saveMistakes}</span>
				</Button>
			) : null}
			<Button
				type="button"
				variant="ghost"
				className={ACTION_BTN_TONE.openMistakes}
				onClick={() => navigate(mistakesPath)}
			>
				<ClipboardList className="size-3.5 shrink-0" aria-hidden />
				<span className="truncate">{labels.openMistakes}</span>
			</Button>
		</div>
	);
}
