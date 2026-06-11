/**
 * 单词收藏页：列表数据、朗读、选择与批量操作
 */
import Confirm from '@design/Confirm';
import Loading from '@design/Loading';
import { Button, ScrollArea, Toast } from '@ui/index';
import { Spinner } from '@ui/spinner';
import { Trash2 } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useI18n } from '@/hooks';
import { cn } from '@/lib/utils';
import {
	downloadEnglishVocabularyFavoritesDocx,
	type EnglishVocabularyFavoriteListEntry,
} from '@/service';
import {
	englishPracticePoolKeys,
	setEnglishPracticePoolMeta,
} from '@/store/englishPracticePool';
import { isTauriRuntime } from '@/utils';
import {
	playEnglishPreferred,
	stopAllEnglishPlayback,
} from '@/utils/englishTts';
import { VocabularyWordCard } from '../../components/VocabularyWordCard';
import { FavoritesPanelFooter } from '../components/FavoritesPanelFooter';
import { useVocabularyFavoritesList } from './useVocabularyFavoritesList';

export type FavoritesListCounts = {
	loaded: number;
	/** 服务端返回的收藏总数（首屏请求即可得） */
	total: number;
};

export type VocabularyFavoritesSectionProps = {
	active: boolean;
	onCountsChange?: (counts: FavoritesListCounts) => void;
};

export function VocabularyFavoritesSection({
	active,
	onCountsChange,
}: VocabularyFavoritesSectionProps) {
	const { t } = useI18n();
	const {
		entries,
		totalCount,
		loading,
		loadingMore,
		onViewportScroll,
		onBatchRemove,
	} = useVocabularyFavoritesList(active);

	const [exportingDocx, setExportingDocx] = useState(false);
	const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
	const [batchRemoving, setBatchRemoving] = useState(false);
	const [removeConfirmOpen, setRemoveConfirmOpen] = useState(false);
	const [singleRemoveConfirmOpen, setSingleRemoveConfirmOpen] = useState(false);
	const [singleRemoveTarget, setSingleRemoveTarget] =
		useState<EnglishVocabularyFavoriteListEntry | null>(null);
	const [playingKey, setPlayingKey] = useState<string | null>(null);

	useEffect(() => {
		onCountsChange?.({
			loaded: entries.length,
			total: totalCount,
		});
	}, [entries.length, totalCount, onCountsChange]);

	useEffect(() => {
		if (totalCount > 0) {
			setEnglishPracticePoolMeta(englishPracticePoolKeys.favorites('vocab'), {
				total: totalCount,
				title: t('englishLearning.practice.sourceFavorites'),
			});
		}
	}, [totalCount, t]);

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

	const onTogglePlayWord = useCallback(
		async (word: string, key: string) => {
			if (playingKey === key) {
				stopAllEnglishPlayback();
				setPlayingKey(null);
				return;
			}
			stopAllEnglishPlayback();
			setPlayingKey(key);
			try {
				await playEnglishPreferred(word);
			} catch {
				Toast({
					type: 'warning',
					title: t('englishLearning.tts.unsupported'),
				});
			} finally {
				setPlayingKey((k) => (k === key ? null : k));
			}
		},
		[playingKey, t],
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
			await onBatchRemove(toRemove);
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
	}, [entries, onBatchRemove, selectedIds, t]);

	const executeSingleRemoveConfirm = useCallback(async () => {
		const target = singleRemoveTarget;
		if (!target) {
			setSingleRemoveConfirmOpen(false);
			return;
		}
		setBatchRemoving(true);
		try {
			await onBatchRemove([target]);
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
	}, [onBatchRemove, singleRemoveTarget, t]);

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
									<VocabularyWordCard
										key={row.id}
										variant="selectable"
										data={row}
										selection={{
											controlId: `vocab-fav-${row.id}`,
											checked: selectedIds.has(row.id),
											disabled: selectionDisabled,
											onCheckedChange: (checked) =>
												toggleRowSelected(row.id, checked),
											ariaLabel: `${t('englishLearning.favoritesDrawer.toggleRow')}: ${row.word}`,
										}}
										playing={playing}
										onTogglePlay={() =>
											void onTogglePlayWord(row.word, playKey)
										}
										playLabels={{
											play: t('englishLearning.vocab.playWord'),
											stop: t('englishLearning.tts.stop'),
										}}
										trailingActions={
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
										}
									/>
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
					practiceContentKind="vocab"
					practiceDisabled={exportDisabled}
					practicePoolTotal={totalCount}
				/>
			</div>
		</>
	);
}
