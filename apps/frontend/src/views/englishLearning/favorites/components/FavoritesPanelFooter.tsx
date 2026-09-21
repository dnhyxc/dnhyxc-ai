/**
 * 收藏列表顶栏操作：全选、移除、听写/拼写、导出（图二：图标+文字链接）
 */
import { Checkbox } from '@ui/checkbox';
import { Label } from '@ui/label';
import { Spinner } from '@ui/spinner';
import { FileDown, Trash2 } from 'lucide-react';
import { useI18n } from '@/hooks';
import { EnglishPracticeEntry } from '../../components/practiceEntry';
import type { PracticeContentKind } from '../../practice/types';

const LINK_CLASS =
	'flex shrink-0 cursor-pointer items-center gap-1.5 whitespace-nowrap text-sm font-medium text-teal-500 hover:text-teal-400 disabled:cursor-not-allowed disabled:opacity-50';

export type FavoritesPanelFooterProps = {
	selectAllId: string;
	showSelection: boolean;
	selectAllCheckboxState: boolean | 'indeterminate';
	selectionDisabled: boolean;
	onToggleSelectAll: (checked: boolean | 'indeterminate') => void;
	selectedCount: number;
	removeDisabled: boolean;
	batchRemoving: boolean;
	onRequestRemove: () => void;
	exportDisabled: boolean;
	exportingDocx: boolean;
	onExportDocx: () => void;
	exportLabel: string;
	showPracticeEntry?: boolean;
	practiceContentKind?: PracticeContentKind;
	practiceDisabled?: boolean;
	practicePoolTotal?: number;
};

export function FavoritesPanelFooter({
	selectAllId,
	showSelection,
	selectAllCheckboxState,
	selectionDisabled,
	onToggleSelectAll,
	selectedCount,
	removeDisabled,
	batchRemoving,
	onRequestRemove,
	exportDisabled,
	exportingDocx,
	onExportDocx,
	exportLabel,
	showPracticeEntry = false,
	practiceContentKind = 'vocab',
	practiceDisabled = false,
	practicePoolTotal,
}: FavoritesPanelFooterProps) {
	const { t } = useI18n();

	return (
		<div className="flex shrink-0 flex-nowrap items-center justify-end gap-3">
			{showSelection ? (
				<div className="flex shrink-0 items-center gap-2">
					<Checkbox
						id={selectAllId}
						checked={selectAllCheckboxState}
						disabled={selectionDisabled}
						onCheckedChange={(v) => onToggleSelectAll(v)}
					/>
					<Label
						htmlFor={selectAllId}
						className="cursor-pointer text-sm font-medium whitespace-nowrap text-teal-500 hover:text-teal-400"
					>
						{t('englishLearning.favoritesDrawer.selectAllLoaded')}
					</Label>
				</div>
			) : null}
			<button
				type="button"
				disabled={removeDisabled}
				className={LINK_CLASS}
				onClick={onRequestRemove}
			>
				{batchRemoving ? (
					<Spinner className="size-4 shrink-0 text-teal-500" />
				) : (
					<Trash2 className="size-4 shrink-0 opacity-90" aria-hidden />
				)}
				<span>
					{batchRemoving
						? t('englishLearning.favoritesDrawer.removing')
						: t('englishLearning.favoritesDrawer.removeSelected', {
								count: selectedCount,
							})}
				</span>
			</button>
			{showPracticeEntry ? (
				<EnglishPracticeEntry
					variant="text"
					showIcon
					disabled={practiceDisabled}
					className="shrink-0 gap-1.5 whitespace-nowrap font-medium"
					practice={{
						contentKind: practiceContentKind,
						source: 'favorites',
						sourceTitle:
							practiceContentKind === 'classic'
								? t('englishLearning.practice.sourceClassicFavorites')
								: t('englishLearning.practice.sourceFavorites'),
						poolTotal:
							practicePoolTotal != null && practicePoolTotal > 0
								? practicePoolTotal
								: undefined,
					}}
				/>
			) : null}
			<button
				type="button"
				disabled={exportDisabled}
				className={LINK_CLASS}
				onClick={() => void onExportDocx()}
			>
				{exportingDocx ? (
					<Spinner className="size-4 shrink-0 text-teal-500" />
				) : (
					<FileDown className="size-4 shrink-0 opacity-90" aria-hidden />
				)}
				<span>{exportingDocx ? t('common.downloading') : exportLabel}</span>
			</button>
		</div>
	);
}
