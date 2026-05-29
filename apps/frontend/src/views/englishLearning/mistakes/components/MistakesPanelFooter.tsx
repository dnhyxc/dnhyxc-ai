/**
 * 错题集页底栏：全选已加载、批量移除
 */
import { Checkbox } from '@ui/checkbox';
import { Button } from '@ui/index';
import { Label } from '@ui/label';
import { Spinner } from '@ui/spinner';
import { useI18n } from '@/hooks';
import type { PracticeContentKind } from '../../practice/types';
import { EnglishPracticeEntry } from '../../shared/practiceEntry';

export type MistakesPanelFooterProps = {
	selectAllId: string;
	showSelection: boolean;
	selectAllCheckboxState: boolean | 'indeterminate';
	selectionDisabled: boolean;
	onToggleSelectAll: (checked: boolean | 'indeterminate') => void;
	selectedCount: number;
	removeDisabled: boolean;
	batchRemoving: boolean;
	onRequestRemove: () => void;
	/** 底栏右侧：听写/拼写（与收藏页一致） */
	showPracticeEntry?: boolean;
	practiceContentKind?: PracticeContentKind;
	practiceDisabled?: boolean;
	practicePoolTotal?: number;
};

export function MistakesPanelFooter({
	selectAllId,
	showSelection,
	selectAllCheckboxState,
	selectionDisabled,
	onToggleSelectAll,
	selectedCount,
	removeDisabled,
	batchRemoving,
	onRequestRemove,
	showPracticeEntry = false,
	practiceContentKind = 'vocab',
	practiceDisabled = false,
	practicePoolTotal,
}: MistakesPanelFooterProps) {
	const { t } = useI18n();

	const practiceSourceTitle =
		practiceContentKind === 'classic'
			? t('englishLearning.practice.sourceClassicMistakes')
			: t('englishLearning.practice.sourceMistakes');

	return (
		<footer className="flex h-12 shrink-0 flex-wrap items-center justify-between gap-3 px-5">
			<div className="flex items-center gap-2">
				{showSelection ? (
					<div className="flex shrink-0 flex-wrap items-center gap-3">
						<div className="flex items-center gap-2">
							<Checkbox
								id={selectAllId}
								checked={selectAllCheckboxState}
								disabled={selectionDisabled}
								onCheckedChange={(v) => onToggleSelectAll(v)}
							/>
							<Label
								htmlFor={selectAllId}
								className="cursor-pointer text-sm text-textcolor/85"
							>
								{t('englishLearning.mistakes.selectAllLoaded')}
							</Label>
						</div>
						<span className="text-textcolor/60 text-sm">
							{t('englishLearning.mistakes.selectedCount', {
								count: selectedCount,
							})}
						</span>
					</div>
				) : null}
			</div>
			<div className="flex flex-wrap items-center justify-end gap-2">
				<Button
					type="button"
					size="sm"
					disabled={removeDisabled}
					className="w-24 shrink-0 pb-1 text-white bg-rose-700 hover:bg-rose-800"
					onClick={onRequestRemove}
				>
					{batchRemoving ? (
						<>
							<Spinner className="h-4 w-4" />
							{t('englishLearning.mistakes.removing')}
						</>
					) : (
						t('englishLearning.mistakes.removeSelected')
					)}
				</Button>
				{showPracticeEntry ? (
					<EnglishPracticeEntry
						variant="button"
						showIcon={false}
						disabled={practiceDisabled}
						practice={{
							contentKind: practiceContentKind,
							source: 'mistakes',
							sourceTitle: practiceSourceTitle,
							poolTotal:
								practicePoolTotal != null && practicePoolTotal > 0
									? practicePoolTotal
									: undefined,
						}}
					/>
				) : null}
			</div>
		</footer>
	);
}
