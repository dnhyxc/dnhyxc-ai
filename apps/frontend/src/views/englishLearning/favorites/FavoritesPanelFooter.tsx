/**
 * 收藏列表面板底部：全选已加载、已选数量、批量移除、导出 Docx
 */
import { Checkbox } from '@ui/checkbox';
import { Button } from '@ui/index';
import { Label } from '@ui/label';
import { Spinner } from '@ui/spinner';
import { useI18n } from '@/hooks';
import type { PracticeContentKind } from '../practice/types';
import { EnglishPracticeEntry } from '../shared/practiceEntry';

export type FavoritesPanelFooterProps = {
	/** 全选 Checkbox 的 id，需与 Label htmlFor 一致 */
	selectAllId: string;
	/** 是否展示全选与已选计数（有条目且非首屏 loading） */
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
	/** 导出按钮文案（单词 / 经典句 i18n 由父组件传入） */
	exportLabel: string;
	/** 收藏页：进入听写/拼写练习 */
	showPracticeEntry?: boolean;
	practiceContentKind?: PracticeContentKind;
	practiceDisabled?: boolean;
	/** 收藏总数，写入练习页 URL 供分页拉词 */
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
								{t('englishLearning.favoritesDrawer.selectAllLoaded')}
							</Label>
						</div>
						<span className="text-textcolor/60 text-sm">
							{t('englishLearning.favoritesDrawer.selectedCount', {
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
							{t('englishLearning.favoritesDrawer.removing')}
						</>
					) : (
						t('englishLearning.favoritesDrawer.removeSelected')
					)}
				</Button>
				{showPracticeEntry ? (
					<EnglishPracticeEntry
						variant="button"
						showIcon={false}
						disabled={practiceDisabled}
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
				<Button
					type="button"
					size="sm"
					disabled={exportDisabled}
					className="flex w-24 shrink-0 items-center"
					onClick={() => void onExportDocx()}
				>
					{exportingDocx ? (
						<>
							<Spinner className="h-4 w-4" />
							{t('common.downloading')}
						</>
					) : (
						exportLabel
					)}
				</Button>
			</div>
		</footer>
	);
}
