/**
 * 英语学习：经典句收藏记录页（滚动分页列表）
 * 列表项布局与主区语句卡片一致（含朗读），无收藏按钮；支持多选批量移除收藏。
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
	downloadEnglishClassicQuoteFavoritesDocx,
	type EnglishClassicQuoteFavoriteListEntry,
} from '@/service';
import { isTauriRuntime } from '@/utils';
import { FavoritesPanelFooter } from './FavoritesPanelFooter';

export type ClassicQuotesFavoritesPanelProps = {
	entries: EnglishClassicQuoteFavoriteListEntry[];
	loading: boolean;
	loadingMore: boolean;
	onViewportScroll: UIEventHandler<HTMLDivElement>;
	/** 与主区语句列表共用，保证互斥朗读与停止后 UI 一致 */
	playingKey: string | null;
	onTogglePlayQuote: (english: string, key: string) => void | Promise<void>;
	/** 批量取消收藏（由父组件调用接口并刷新列表） */
	onBatchRemoveFavorites: (
		selected: EnglishClassicQuoteFavoriteListEntry[],
	) => Promise<void>;
};

export function ClassicQuotesFavoritesPanel({
	entries,
	loading,
	loadingMore,
	onViewportScroll,
	playingKey,
	onTogglePlayQuote,
	onBatchRemoveFavorites,
}: ClassicQuotesFavoritesPanelProps) {
	const { t } = useI18n();
	const [exportingDocx, setExportingDocx] = useState(false);
	const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
	const [batchRemoving, setBatchRemoving] = useState(false);
	const [removeConfirmOpen, setRemoveConfirmOpen] = useState(false);
	const [singleRemoveConfirmOpen, setSingleRemoveConfirmOpen] = useState(false);
	const [singleRemoveTarget, setSingleRemoveTarget] =
		useState<EnglishClassicQuoteFavoriteListEntry | null>(null);

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
		(entry: EnglishClassicQuoteFavoriteListEntry) => {
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
				title: t('englishLearning.classic.exportDocxEmpty'),
			});
			return;
		}
		setExportingDocx(true);
		try {
			await downloadEnglishClassicQuoteFavoritesDocx();
			// Web：无内置 Toast；Tauri：`downloadBlob` 已提示（与 Mermaid 工具栏等一致）
			if (!isTauriRuntime()) {
				Toast({
					type: 'success',
					title: t('englishLearning.classic.exportDocxSuccess'),
				});
			}
		} catch (e) {
			Toast({
				type: 'error',
				title:
					e instanceof Error
						? e.message
						: t('englishLearning.classic.exportDocxFail'),
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
					singleRemoveTarget ? (
						<div className="space-y-2">
							<p>
								{t(
									'englishLearning.favoritesDrawer.removeOneConfirmDescClassicIntro',
								)}
							</p>
							<p className="wrap-anywhere text-textcolor py-1.5 text-sm font-medium leading-snug">
								{singleRemoveTarget.english}
							</p>
						</div>
					) : (
						'\u00a0'
					)
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
							<Loading text={t('englishLearning.classic.favoritesLoading')} />
						</div>
					) : (
						<div className="grid grid-cols-2 gap-4 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3">
							{entries.map((row) => {
								const playKey = `fav-classic-${row.id}`;
								const playing = playingKey === playKey;
								return (
									<div
										key={row.id}
										className="select-text bg-theme/5 border border-theme/10 flex min-w-0 flex-col gap-1.5 rounded-md px-3 py-2.5"
									>
										<div className="flex gap-2">
											<div className="flex shrink-0 items-start pt-1">
												<Checkbox
													id={`classic-fav-${row.id}`}
													className="cursor-pointer"
													checked={selectedIds.has(row.id)}
													disabled={selectionDisabled}
													onCheckedChange={(v) =>
														toggleRowSelected(row.id, v === true)
													}
													aria-label={`${t('englishLearning.favoritesDrawer.toggleRow')}: ${row.english.slice(0, 120)}`}
												/>
											</div>
											<div className="min-w-0 flex-1 flex flex-col">
												<div className="flex items-start justify-between gap-2">
													<div className="text-textcolor min-w-0 flex-1 text-base font-semibold leading-snug">
														<Label
															htmlFor={`classic-fav-${row.id}`}
															className="select-text cursor-pointer text-base font-semibold text-textcolor"
														>
															{row.english}
														</Label>
													</div>
													<div className="flex shrink-0 items-center gap-1 transition-opacity duration-200">
														<Button
															type="button"
															variant="ghost"
															size="sm"
															onClick={() =>
																void onTogglePlayQuote(row.english, playKey)
															}
															className={cn(
																'h-7 w-7 shrink-0 rounded-md border p-2 transition-colors @min-[26rem]:border-theme/15 @min-[26rem]:p-1.5',
																playing
																	? 'border-violet-500/40 bg-violet-500/15 text-violet-600 dark:text-violet-400'
																	: 'border-theme/12 text-textcolor/60 hover:border-theme/20 hover:bg-theme/10 hover:text-violet-600 dark:hover:text-violet-400',
															)}
															aria-label={
																playing
																	? t('englishLearning.tts.stop')
																	: t('englishLearning.classic.playQuote')
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
																'h-7 w-7 shrink-0 rounded-md border p-2 transition-colors @min-[26rem]:border-theme/15 @min-[26rem]:p-1.5',
																'border-theme/12 text-textcolor/60 hover:border-destructive/35 hover:bg-destructive/10 hover:text-destructive',
															)}
															aria-label={t(
																'englishLearning.favoritesDrawer.removeOneAction',
															)}
														>
															<Trash2 className="size-3.5" />
														</Button>
													</div>
												</div>
												<div className="text-textcolor/90 text-sm leading-snug mt-1">
													{row.translationZh}
												</div>
												<div className="text-textcolor/70 text-xs my-1">
													{t('englishLearning.classic.sourceLabel')}
													{row.source || '—'}
												</div>
												<div className="text-textcolor/70 text-xs leading-relaxed italic">
													{row.noteZh}
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
								<div className="col-span-full text-textcolor/60 py-12 text-center text-sm">
									{t('englishLearning.classic.favoritesEmpty')}
								</div>
							) : null}
						</div>
					)}
				</ScrollArea>
				<FavoritesPanelFooter
					selectAllId="classic-fav-select-all"
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
					exportLabel={t('englishLearning.classic.exportDocx')}
				/>
			</div>
		</>
	);
}
