/**
 * 英语学习：单词收藏记录页（滚动分页列表）
 */
import Confirm from '@design/Confirm';
import Loading from '@design/Loading';
import { Checkbox } from '@ui/checkbox';
import { Button, ScrollArea, Toast } from '@ui/index';
import { Label } from '@ui/label';
import { Spinner } from '@ui/spinner';
import { Square, Trash2, Volume2 } from 'lucide-react';
import type { UIEventHandler } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useI18n } from '@/hooks';
import { cn } from '@/lib/utils';
import {
	downloadEnglishVocabularyFavoritesDocx,
	type EnglishVocabularyFavoriteListEntry,
} from '@/service';
import { displayIpaWrapped, isTauriRuntime } from '@/utils';
import { SegmentationLine } from '../shared/SegmentationLine';
import { FavoritesPanelFooter } from './FavoritesPanelFooter';

export type VocabularyFavoritesPanelProps = {
	entries: EnglishVocabularyFavoriteListEntry[];
	loading: boolean;
	loadingMore: boolean;
	onViewportScroll: UIEventHandler<HTMLDivElement>;
	playingKey: string | null;
	onTogglePlayWord: (word: string, key: string) => void | Promise<void>;
	onBatchRemoveFavorites: (
		selected: EnglishVocabularyFavoriteListEntry[],
	) => Promise<void>;
	/** 服务端收藏总数 */
	totalCount: number;
};

export function VocabularyFavoritesPanel({
	entries,
	loading,
	loadingMore,
	onViewportScroll,
	playingKey,
	onTogglePlayWord,
	onBatchRemoveFavorites,
	totalCount,
}: VocabularyFavoritesPanelProps) {
	const { t } = useI18n();
	const [exportingDocx, setExportingDocx] = useState(false);
	const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
	const [batchRemoving, setBatchRemoving] = useState(false);
	const [removeConfirmOpen, setRemoveConfirmOpen] = useState(false);
	const [singleRemoveConfirmOpen, setSingleRemoveConfirmOpen] = useState(false);
	const [singleRemoveTarget, setSingleRemoveTarget] =
		useState<EnglishVocabularyFavoriteListEntry | null>(null);

	const showInitialLoading = loading && entries.length === 0;
	const showLoadMoreHint = loadingMore;
	const showEmpty = !loading && entries.length === 0 && !loadingMore;
	const exportDisabled =
		exportingDocx || loading || (!loading && entries.length === 0);

	const entryIdSet = useMemo(
		() => new Set(entries.map((e) => e.id)),
		[entries],
	);
	const allLoadedSelected =
		entries.length > 0 && entries.every((e) => selectedIds.has(e.id));
	const someLoadedSelected = entries.some((e) => selectedIds.has(e.id));
	const selectAllCheckboxState: boolean | 'indeterminate' = allLoadedSelected
		? true
		: someLoadedSelected
			? 'indeterminate'
			: false;

	useEffect(() => {
		setSelectedIds((prev) => {
			if (prev.size === 0) return prev;
			const next = new Set<string>();
			for (const id of prev) {
				if (entryIdSet.has(id)) next.add(id);
			}
			if (next.size === prev.size) return prev;
			return next;
		});
	}, [entryIdSet]);

	const toggleSelectAllLoaded = useCallback(
		(checked: boolean | 'indeterminate') => {
			if (checked === true) {
				setSelectedIds(new Set(entries.map((e) => e.id)));
			} else {
				setSelectedIds(new Set());
			}
		},
		[entries],
	);

	const toggleRowSelected = useCallback((id: string, checked: boolean) => {
		setSelectedIds((prev) => {
			const next = new Set(prev);
			if (checked) next.add(id);
			else next.delete(id);
			return next;
		});
	}, []);

	const selectedEntries = useMemo(
		() => entries.filter((e) => selectedIds.has(e.id)),
		[entries, selectedIds],
	);

	const requestRemoveConfirm = useCallback(() => {
		if (selectedIds.size === 0) {
			Toast({
				type: 'info',
				title: t('englishLearning.favoritesDrawer.removeNoneHint'),
			});
			return;
		}
		setSingleRemoveConfirmOpen(false);
		setSingleRemoveTarget(null);
		setRemoveConfirmOpen(true);
	}, [selectedIds, t]);

	const requestSingleRemove = useCallback(
		(entry: EnglishVocabularyFavoriteListEntry) => {
			setRemoveConfirmOpen(false);
			setSingleRemoveTarget(entry);
			setSingleRemoveConfirmOpen(true);
		},
		[],
	);

	const executeRemoveConfirm = useCallback(async () => {
		const toRemove = entries.filter((e) => selectedIds.has(e.id));
		if (toRemove.length === 0) {
			setRemoveConfirmOpen(false);
			return;
		}
		setBatchRemoving(true);
		try {
			await onBatchRemoveFavorites(toRemove);
			setSelectedIds(new Set());
			setRemoveConfirmOpen(false);
			setSingleRemoveConfirmOpen(false);
			setSingleRemoveTarget(null);
			Toast({
				type: 'success',
				title: t('englishLearning.favoritesDrawer.removeSuccess'),
			});
		} catch (e) {
			Toast({
				type: 'error',
				title:
					e instanceof Error
						? e.message
						: t('englishLearning.favoritesDrawer.removeFail'),
			});
			setRemoveConfirmOpen(false);
		} finally {
			setBatchRemoving(false);
		}
	}, [entries, onBatchRemoveFavorites, selectedIds, t]);

	const executeSingleRemoveConfirm = useCallback(async () => {
		const target = singleRemoveTarget;
		if (!target) {
			setSingleRemoveConfirmOpen(false);
			return;
		}
		setBatchRemoving(true);
		try {
			await onBatchRemoveFavorites([target]);
			setSelectedIds((prev) => {
				const next = new Set(prev);
				next.delete(target.id);
				return next;
			});
			setSingleRemoveTarget(null);
			setSingleRemoveConfirmOpen(false);
			Toast({
				type: 'success',
				title: t('englishLearning.favoritesDrawer.removeOneSuccess'),
			});
		} catch (e) {
			Toast({
				type: 'error',
				title:
					e instanceof Error
						? e.message
						: t('englishLearning.favoritesDrawer.removeFail'),
			});
			setSingleRemoveConfirmOpen(false);
		} finally {
			setBatchRemoving(false);
		}
	}, [onBatchRemoveFavorites, singleRemoveTarget, t]);

	const handleExportDocx = async () => {
		if (entries.length === 0 && !loading) {
			Toast({
				type: 'info',
				title: t('englishLearning.vocab.exportDocxEmpty'),
			});
			return;
		}
		setExportingDocx(true);
		try {
			await downloadEnglishVocabularyFavoritesDocx();
			if (!isTauriRuntime()) {
				Toast({
					type: 'success',
					title: t('englishLearning.vocab.exportDocxSuccess'),
				});
			}
		} catch (e) {
			Toast({
				type: 'error',
				title:
					e instanceof Error
						? e.message
						: t('englishLearning.vocab.exportDocxFail'),
			});
		} finally {
			setExportingDocx(false);
		}
	};

	const selectionDisabled = loading || batchRemoving;
	const removeDisabled =
		batchRemoving || selectedIds.size === 0 || entries.length === 0;

	return (
		<>
			<Confirm
				open={removeConfirmOpen}
				onOpenChange={setRemoveConfirmOpen}
				title={t('englishLearning.favoritesDrawer.removeConfirmTitle')}
				description={t('englishLearning.favoritesDrawer.removeConfirmDesc', {
					count: selectedEntries.length,
				})}
				descriptionClassName="text-left"
				confirmText={t('englishLearning.favoritesDrawer.removeConfirmAction')}
				cancelText={t('common.cancel')}
				confirmVariant="destructive"
				closeOnConfirm={false}
				onConfirm={() => void executeRemoveConfirm()}
			/>
			<Confirm
				open={singleRemoveConfirmOpen}
				onOpenChange={(v) => {
					setSingleRemoveConfirmOpen(v);
					if (!v) setSingleRemoveTarget(null);
				}}
				title={t('englishLearning.favoritesDrawer.removeOneConfirmTitle')}
				description={
					singleRemoveTarget
						? t('englishLearning.favoritesDrawer.removeOneConfirmDescVocab', {
								word: singleRemoveTarget.word,
							})
						: '\u00a0'
				}
				descriptionClassName="text-left"
				confirmText={t('englishLearning.favoritesDrawer.removeConfirmAction')}
				cancelText={t('common.cancel')}
				confirmVariant="destructive"
				closeOnConfirm={false}
				onConfirm={() => void executeSingleRemoveConfirm()}
			/>
			<div className="flex h-full min-h-0 flex-col">
				<ScrollArea
					className="@container min-h-0 flex-1 px-4"
					onScroll={onViewportScroll}
				>
					{showInitialLoading ? (
						<div className="text-textcolor/60 flex min-h-full flex-1 items-center justify-center text-center text-sm">
							<Loading text={t('englishLearning.vocab.favoritesLoading')} />
						</div>
					) : (
						<div className="grid grid-cols-2 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
							{entries.map((row) => {
								const playKey = `fav-vocab-${row.id}`;
								const playing = playingKey === playKey;
								return (
									<div
										key={row.id}
										className="select-text bg-theme/5 border border-theme/5 flex min-w-0 flex-col gap-1.5 rounded-md px-3 py-2.5"
									>
										<div className="flex gap-2">
											<div className="flex shrink-0 items-start pt-1">
												<Checkbox
													id={`vocab-fav-${row.id}`}
													className="cursor-pointer"
													checked={selectedIds.has(row.id)}
													disabled={selectionDisabled}
													onCheckedChange={(v) =>
														toggleRowSelected(row.id, v === true)
													}
													aria-label={`${t('englishLearning.favoritesDrawer.toggleRow')}: ${row.word}`}
												/>
											</div>
											<div className="min-w-0 flex-1 flex flex-col">
												<div className="flex items-start justify-between gap-2">
													<div className="min-w-0 flex-1">
														<Label
															htmlFor={`vocab-fav-${row.id}`}
															className="select-text flex min-w-0 cursor-pointer flex-wrap items-baseline gap-x-2 gap-y-0.5"
														>
															<span className="truncate text-base font-semibold text-textcolor">
																{row.word}
															</span>
															{row.pos?.trim() ? (
																<span className="text-textcolor/50 shrink-0 text-xs font-medium tracking-wide">
																	{row.pos}
																</span>
															) : null}
														</Label>
														<div className="mt-1 font-mono text-xs leading-snug text-teal-600/90 dark:text-teal-400/90">
															{displayIpaWrapped(row.ipa)}
														</div>
														<SegmentationLine
															segmentation={row.segmentation}
															className="text-textcolor/55 mt-0.5 text-xs leading-snug"
														/>
													</div>
													<div className="flex shrink-0 items-center gap-1">
														<Button
															type="button"
															variant="ghost"
															size="sm"
															onClick={() =>
																void onTogglePlayWord(row.word, playKey)
															}
															className={cn(
																'h-7 w-7 shrink-0 rounded-md border p-2 transition-colors',
																playing
																	? 'border-teal-500/40 bg-teal-500/15 text-teal-600 dark:text-teal-400'
																	: 'border-theme/10 text-textcolor/60 hover:border-theme/20 hover:bg-theme/10 hover:text-teal-600 dark:hover:text-teal-400',
															)}
															aria-label={
																playing
																	? t('englishLearning.tts.stop')
																	: t('englishLearning.vocab.playWord')
															}
														>
															{playing ? (
																<Square className="size-3.5 fill-current" />
															) : (
																<Volume2 className="size-3.5" />
															)}
														</Button>
														<Button
															type="button"
															variant="ghost"
															size="sm"
															disabled={selectionDisabled}
															onClick={() => requestSingleRemove(row)}
															className={cn(
																'h-7 w-7 shrink-0 rounded-md border p-2 transition-colors',
																'border-theme/10 text-textcolor/60 hover:border-destructive/35 hover:bg-destructive/10 hover:text-destructive',
															)}
															aria-label={t(
																'englishLearning.favoritesDrawer.removeOneAction',
															)}
														>
															<Trash2 className="size-3.5" />
														</Button>
													</div>
												</div>
												<div className="text-textcolor/95 mt-1 text-sm leading-snug">
													{row.translationZh}
												</div>
												<div className="text-textcolor/80 mt-0.5 text-sm leading-relaxed italic">
													{row.example}
												</div>
											</div>
										</div>
									</div>
								);
							})}
							{showLoadMoreHint ? (
								<div className="col-span-full text-textcolor/50 flex items-center justify-center gap-1.5 py-2 text-xs">
									<Spinner className="size-3.5 text-textcolor/50" aria-hidden />
									{t('common.loadingMore')}
								</div>
							) : null}
							{showEmpty ? (
								<div className="text-textcolor/60 col-span-full py-12 text-center text-sm">
									{t('englishLearning.vocab.favoritesEmpty')}
								</div>
							) : null}
						</div>
					)}
				</ScrollArea>
				<FavoritesPanelFooter
					selectAllId="vocab-fav-select-all"
					showSelection={!showInitialLoading && entries.length > 0}
					selectAllCheckboxState={selectAllCheckboxState}
					selectionDisabled={selectionDisabled}
					onToggleSelectAll={toggleSelectAllLoaded}
					selectedCount={selectedIds.size}
					removeDisabled={removeDisabled}
					batchRemoving={batchRemoving}
					onRequestRemove={requestRemoveConfirm}
					exportDisabled={exportDisabled}
					exportingDocx={exportingDocx}
					onExportDocx={handleExportDocx}
					exportLabel={t('englishLearning.vocab.exportDocx')}
					showPracticeEntry
					practiceDisabled={exportDisabled}
					practicePoolTotal={totalCount}
				/>
			</div>
		</>
	);
}
