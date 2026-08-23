/**
 * 经典句收藏页：列表数据、朗读、选择与批量操作
 */
import Confirm from '@design/Confirm';
import Loading from '@design/Loading';
import { Button, ScrollArea, Toast } from '@ui/index';
import { Trash2 } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useI18n } from '@/hooks';
import { cn } from '@/lib/utils';
import {
	downloadEnglishClassicQuoteFavoritesDocx,
	type EnglishClassicQuoteFavoriteListEntry,
	listEnglishClassicQuoteFavorites,
	removeEnglishClassicQuoteFavoritesBatch,
} from '@/service';
import {
	elFixedListResumeId,
	flushElFixedListResume,
	resolveElFixedListInitialResume,
	resolveElFixedListResume,
	setElFixedListResume,
} from '@/store/englishLearningResume';
import {
	englishPracticePoolKeys,
	setEnglishPracticePoolMeta,
} from '@/store/englishPracticePool';
import { isTauriRuntime } from '@/utils';
import { playPreferred, stopAllPlayback } from '@/utils/speech';
import { ClassicQuoteCard } from '../../components/ClassicQuoteCard';
import { ListScrollCornerFab } from '../../components/ListScrollCornerFab';
import { useEnglishLearningList } from '../../hooks/useEnglishLearningList';
import {
	composeViewportScroll,
	useListScrollCornerFab,
} from '../../hooks/useListScrollCornerFab';
import {
	LibraryListLoadMoreRow,
	LibraryVirtuosoGrid,
} from '../../library/components/LibraryVirtuosoGrid';
import { FavoritesPanelFooter } from '../components/FavoritesPanelFooter';
import type { FavoritesListCounts } from '../vocabulary';

const LIST_SCOPE = 'classic-favorites' as const;
const LIST_RESUME_ID = elFixedListResumeId(LIST_SCOPE);

export type ClassicQuotesFavoritesSectionProps = {
	active: boolean;
	onCountsChange?: (counts: FavoritesListCounts) => void;
};

export function ClassicQuotesFavoritesSection({
	active,
	onCountsChange,
}: ClassicQuotesFavoritesSectionProps) {
	const { t } = useI18n();
	const scrollViewportRef = useRef<HTMLDivElement>(null);
	const [gridReady, setGridReady] = useState(false);

	const handleResumeOffsetChange = useCallback(
		(_id: string, offset: number) => {
			setElFixedListResume(LIST_SCOPE, offset);
		},
		[],
	);

	const fetchFavoritesPage = useCallback(
		async (_id: string, limit: number, offset: number) => {
			const res = await listEnglishClassicQuoteFavorites({
				limit,
				offset,
				silent: true,
			});
			if (!res.data) {
				throw new Error('empty favorites response');
			}
			return {
				items: Array.isArray(res.data.items) ? res.data.items : [],
				totalCount: res.data.totalCount,
			};
		},
		[],
	);

	const {
		items: entries,
		totalCount,
		loading,
		loadingMore,
		initialScrollItemIndex,
		onViewportScroll,
		onEndReached,
		reloadFromStart,
	} = useEnglishLearningList<EnglishClassicQuoteFavoriteListEntry, null>({
		libraryId: active ? LIST_RESUME_ID : null,
		cacheNamespace: 'classic-favorites',
		initialResumeOffset: resolveElFixedListResume(LIST_SCOPE),
		resolveInitialResume: () => resolveElFixedListInitialResume(LIST_SCOPE),
		refetchOnEnter: true,
		onResumeOffsetChange: handleResumeOffsetChange,
		viewportRef: scrollViewportRef,
		fetchPage: fetchFavoritesPage,
	});

	useEffect(() => {
		setGridReady(false);
	}, [active]);

	useEffect(() => {
		if (!active) return;
		return () => {
			flushElFixedListResume(LIST_SCOPE, { keepalive: true });
		};
	}, [active]);

	const handleGridReady = useCallback(() => {
		setGridReady(true);
	}, []);

	const [exportingDocx, setExportingDocx] = useState(false);
	const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
	const [batchRemoving, setBatchRemoving] = useState(false);
	const [removeConfirmOpen, setRemoveConfirmOpen] = useState(false);
	const [singleRemoveConfirmOpen, setSingleRemoveConfirmOpen] = useState(false);
	const [singleRemoveTarget, setSingleRemoveTarget] =
		useState<EnglishClassicQuoteFavoriteListEntry | null>(null);
	const [playingKey, setPlayingKey] = useState<string | null>(null);

	useEffect(() => {
		onCountsChange?.({
			loaded: entries.length,
			total: totalCount,
		});
	}, [entries.length, totalCount, onCountsChange]);

	useEffect(() => {
		if (totalCount > 0) {
			setEnglishPracticePoolMeta(englishPracticePoolKeys.favorites('classic'), {
				total: totalCount,
				title: t('englishLearning.practice.sourceClassicFavorites'),
			});
		}
	}, [totalCount, t]);

	const showInitialLoading = loading && entries.length === 0;
	const awaitingGrid = entries.length > 0 && !gridReady;
	const showEmpty = !loading && entries.length === 0;
	const { mode, onScrollCornerFab, onScrollCornerFabClick } =
		useListScrollCornerFab(
			scrollViewportRef,
			entries.length,
			entries.length > 0,
		);
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

	const onTogglePlayQuote = useCallback(
		async (english: string, key: string) => {
			if (playingKey === key) {
				stopAllPlayback();
				setPlayingKey(null);
				return;
			}
			stopAllPlayback();
			setPlayingKey(key);
			try {
				await playPreferred(english, { cloudSingleUtterance: true });
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
			await removeEnglishClassicQuoteFavoritesBatch(
				toRemove.map((it) => it.id),
			);
			await reloadFromStart(true);
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
	}, [entries, reloadFromStart, selectedIds, t]);

	const executeSingleRemoveConfirm = useCallback(async () => {
		const target = singleRemoveTarget;
		if (!target) {
			setSingleRemoveConfirmOpen(false);
			return;
		}
		setBatchRemoving(true);
		try {
			await removeEnglishClassicQuoteFavoritesBatch([target.id]);
			await reloadFromStart(true);
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
	}, [reloadFromStart, singleRemoveTarget, t]);

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
				{showInitialLoading ? (
					<div className="text-textcolor/60 flex min-h-0 flex-1 items-center justify-center px-4 text-center text-sm">
						<Loading text={t('englishLearning.classic.favoritesLoading')} />
					</div>
				) : (
					<div className="relative min-h-0 flex-1">
						{awaitingGrid ? (
							<div className="bg-theme-background absolute inset-0 z-10 flex items-center justify-center px-4">
								<Loading text={t('englishLearning.classic.favoritesLoading')} />
							</div>
						) : null}
						<ScrollArea
							ref={scrollViewportRef}
							className="relative min-h-0 h-full px-4"
							viewportClassName="h-full [overflow-anchor:none] [&>div]:block! [&>div]:min-h-0! [&>div]:h-auto! [&>div]:w-full! [&>div]:min-w-0!"
							onScroll={composeViewportScroll(
								onViewportScroll,
								onScrollCornerFab,
							)}
						>
							{showEmpty ? (
								<div className="text-textcolor/60 py-12 text-center text-sm">
									{t('englishLearning.classic.favoritesEmpty')}
								</div>
							) : (
								<div className="relative w-full">
									<LibraryVirtuosoGrid
										key={LIST_RESUME_ID}
										items={entries}
										viewportRef={scrollViewportRef}
										columnMode="classic"
										initialScrollItemIndex={initialScrollItemIndex}
										getItemKey={(row) => row.id}
										onEndReached={onEndReached}
										onReady={handleGridReady}
										itemContent={(row) => {
											const playKey = `fav-classic-${row.id}`;
											const playing = playingKey === playKey;
											return (
												<ClassicQuoteCard
													variant="selectable"
													forceNote
													data={{
														english: row.english,
														translationZh: row.translationZh,
														source: row.source,
														noteZh: row.noteZh,
													}}
													selection={{
														controlId: `classic-fav-${row.id}`,
														checked: selectedIds.has(row.id),
														disabled: selectionDisabled,
														onCheckedChange: (checked) =>
															toggleRowSelected(row.id, checked),
														ariaLabel: `${t('englishLearning.favoritesDrawer.toggleRow')}: ${row.english.slice(0, 120)}`,
													}}
													playing={playing}
													onTogglePlay={() =>
														void onTogglePlayQuote(row.english, playKey)
													}
													playLabels={{
														play: t('englishLearning.classic.playQuote'),
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
																'border-theme/12 text-textcolor/60 hover:border-destructive/35 hover:bg-destructive/10 hover:text-destructive',
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
										}}
									/>
									{loadingMore ? (
										<LibraryListLoadMoreRow label={t('common.loadingMore')} />
									) : null}
								</div>
							)}
						</ScrollArea>
						<ListScrollCornerFab mode={mode} onClick={onScrollCornerFabClick} />
					</div>
				)}
				<FavoritesPanelFooter
					selectAllId="classic-fav-select-all"
					showPracticeEntry
					practiceContentKind="classic"
					practiceDisabled={loading || totalCount === 0}
					practicePoolTotal={totalCount}
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
