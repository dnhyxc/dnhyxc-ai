/**
 * 单词错题集列表页主体
 */
import Confirm from '@design/Confirm';
import Loading from '@design/Loading';
import { Button, ScrollArea, Toast } from '@ui/index';
import { Trash2 } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useI18n } from '@/hooks';
import { cn } from '@/lib/utils';
import {
	type EnglishVocabularyMistakeListEntry,
	listEnglishVocabularyMistakes,
	removeEnglishVocabularyMistakesBatch,
} from '@/service';
import {
	elFixedListResumeId,
	flushElFixedListResume,
	resolveElFixedListInitialResume,
	resolveElFixedListResume,
	setElFixedListResume,
} from '@/store/englishLearningResume';
import { playPreferred, stopAllPlayback } from '@/utils/speech';
import { ListScrollCornerFab } from '../../components/ListScrollCornerFab';
import { VocabularyWordCard } from '../../components/VocabularyWordCard';
import { useEnglishLearningList } from '../../hooks/useEnglishLearningList';
import {
	composeViewportScroll,
	useListScrollCornerFab,
} from '../../hooks/useListScrollCornerFab';
import {
	LibraryListLoadMoreRow,
	LibraryVirtuosoGrid,
} from '../../library/components/LibraryVirtuosoGrid';
import { MistakesPanelFooter } from '../components/MistakesPanelFooter';

const LIST_SCOPE = 'vocab-mistakes' as const;
const LIST_RESUME_ID = elFixedListResumeId(LIST_SCOPE);

export type MistakesListCounts = {
	loaded: number;
	total: number;
};

export type VocabularyMistakesPanelProps = {
	active?: boolean;
	onCountsChange?: (counts: MistakesListCounts) => void;
};

export function VocabularyMistakesPanel({
	active = true,
	onCountsChange,
}: VocabularyMistakesPanelProps) {
	const { t } = useI18n();
	const scrollViewportRef = useRef<HTMLDivElement>(null);
	const [gridReady, setGridReady] = useState(false);

	const handleResumeOffsetChange = useCallback(
		(_id: string, offset: number) => {
			setElFixedListResume(LIST_SCOPE, offset);
		},
		[],
	);

	const fetchMistakesPage = useCallback(
		async (_id: string, limit: number, offset: number) => {
			const res = await listEnglishVocabularyMistakes({
				limit,
				offset,
				silent: true,
			});
			if (!res.data) {
				throw new Error('empty mistakes response');
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
	} = useEnglishLearningList<EnglishVocabularyMistakeListEntry, null>({
		libraryId: active ? LIST_RESUME_ID : null,
		cacheNamespace: 'vocab-mistakes',
		initialResumeOffset: resolveElFixedListResume(LIST_SCOPE),
		resolveInitialResume: () => resolveElFixedListInitialResume(LIST_SCOPE),
		refetchOnEnter: true,
		onResumeOffsetChange: handleResumeOffsetChange,
		resumeModuleKey: 'mistakes',
		viewportRef: scrollViewportRef,
		fetchPage: fetchMistakesPage,
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

	const [playingKey, setPlayingKey] = useState<string | null>(null);
	const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
	const [batchRemoving, setBatchRemoving] = useState(false);
	const [removeConfirmOpen, setRemoveConfirmOpen] = useState(false);
	const [singleRemoveConfirmOpen, setSingleRemoveConfirmOpen] = useState(false);
	const [singleRemoveTarget, setSingleRemoveTarget] =
		useState<EnglishVocabularyMistakeListEntry | null>(null);

	const showInitialLoading = loading && entries.length === 0;
	const awaitingGrid = entries.length > 0 && !gridReady;
	const showEmpty = !loading && entries.length === 0;
	const { mode, onScrollCornerFab, onScrollCornerFabClick } =
		useListScrollCornerFab(
			scrollViewportRef,
			entries.length,
			entries.length > 0,
		);
	const practiceDisabled = loading || totalCount === 0;

	useEffect(() => {
		onCountsChange?.({ loaded: entries.length, total: totalCount });
	}, [entries.length, totalCount, onCountsChange]);

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
				title: t('englishLearning.mistakes.removeNoneHint'),
			});
			return;
		}
		setSingleRemoveConfirmOpen(false);
		setSingleRemoveTarget(null);
		setRemoveConfirmOpen(true);
	}, [selectedIds, t]);

	const requestSingleRemove = useCallback(
		(entry: EnglishVocabularyMistakeListEntry) => {
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
			await removeEnglishVocabularyMistakesBatch(toRemove.map((it) => it.id));
			await reloadFromStart(true);
			setSelectedIds(new Set());
			setRemoveConfirmOpen(false);
			setSingleRemoveConfirmOpen(false);
			setSingleRemoveTarget(null);
			Toast({
				type: 'success',
				title: t('englishLearning.mistakes.removeBatchSuccess'),
			});
		} catch (e) {
			Toast({
				type: 'error',
				title:
					e instanceof Error
						? e.message
						: t('englishLearning.mistakes.removeFail'),
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
			await removeEnglishVocabularyMistakesBatch([target.id]);
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
				title: t('englishLearning.mistakes.removeSuccess'),
			});
		} catch (e) {
			Toast({
				type: 'error',
				title:
					e instanceof Error
						? e.message
						: t('englishLearning.mistakes.removeFail'),
			});
			setSingleRemoveConfirmOpen(false);
		} finally {
			setBatchRemoving(false);
		}
	}, [reloadFromStart, singleRemoveTarget, t]);

	const onTogglePlayWord = useCallback(
		async (word: string, key: string) => {
			if (playingKey === key) {
				stopAllPlayback();
				setPlayingKey(null);
				return;
			}
			stopAllPlayback();
			setPlayingKey(key);
			try {
				await playPreferred(word);
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

	const selectionDisabled = loading || batchRemoving;
	const removeDisabled =
		batchRemoving || selectedIds.size === 0 || entries.length === 0;

	return (
		<>
			<Confirm
				open={removeConfirmOpen}
				onOpenChange={setRemoveConfirmOpen}
				title={t('englishLearning.mistakes.removeBatchConfirmTitle')}
				description={t('englishLearning.mistakes.removeBatchConfirmDesc', {
					count: selectedEntries.length,
				})}
				descriptionClassName="text-left"
				confirmText={t('englishLearning.mistakes.removeConfirmAction')}
				cancelText={t('common.cancel')}
				confirmVariant="destructive"
				closeOnConfirm={false}
				onConfirm={() => void executeRemoveConfirm()}
			/>
			<Confirm
				open={singleRemoveConfirmOpen}
				onOpenChange={(open) => {
					setSingleRemoveConfirmOpen(open);
					if (!open) setSingleRemoveTarget(null);
				}}
				title={t('englishLearning.mistakes.removeConfirmTitle')}
				description={
					singleRemoveTarget
						? t('englishLearning.mistakes.removeConfirmDesc', {
								word: singleRemoveTarget.word,
							})
						: '\u00a0'
				}
				descriptionClassName="text-left"
				confirmText={t('englishLearning.mistakes.removeConfirmAction')}
				cancelText={t('common.cancel')}
				confirmVariant="destructive"
				closeOnConfirm={false}
				onConfirm={() => void executeSingleRemoveConfirm()}
			/>
			<div className="flex h-full min-h-0 flex-col">
				{showInitialLoading ? (
					<div className="text-textcolor/60 flex min-h-0 flex-1 items-center justify-center px-4 text-center text-sm">
						<Loading text={t('common.loading')} />
					</div>
				) : (
					<div className="relative min-h-0 flex-1">
						{awaitingGrid ? (
							<div className="bg-theme-background absolute inset-0 z-10 flex items-center justify-center px-4">
								<Loading text={t('common.loading')} />
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
									{t('englishLearning.mistakes.empty')}
								</div>
							) : (
								<div className="relative w-full">
									<LibraryVirtuosoGrid
										key={LIST_RESUME_ID}
										items={entries}
										viewportRef={scrollViewportRef}
										columnMode="vocab"
										initialScrollItemIndex={initialScrollItemIndex}
										getItemKey={(row) => row.id}
										onEndReached={onEndReached}
										onReady={handleGridReady}
										itemContent={(row) => {
											const playKey = `mistake-${row.id}`;
											const playing = playingKey === playKey;
											return (
												<VocabularyWordCard
													variant="selectable"
													data={row}
													selection={{
														controlId: `mistake-${row.id}`,
														checked: selectedIds.has(row.id),
														disabled: selectionDisabled,
														onCheckedChange: (checked) =>
															toggleRowSelected(row.id, checked),
														ariaLabel: `${t('englishLearning.mistakes.toggleRow')}: ${row.word}`,
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
																'englishLearning.mistakes.removeAction',
															)}
														>
															<Trash2 className="size-3.5" />
														</Button>
													}
													footer={
														row.lastUserInput?.trim() ? (
															<div className="text-rose-500/85 text-sm leading-snug">
																{t('englishLearning.mistakes.lastInput', {
																	answer: row.lastUserInput,
																})}
															</div>
														) : null
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
				<MistakesPanelFooter
					selectAllId="mistakes-select-all"
					showSelection={!showInitialLoading && entries.length > 0}
					selectAllCheckboxState={selectAllCheckboxState}
					selectionDisabled={selectionDisabled}
					onToggleSelectAll={toggleSelectAllLoaded}
					selectedCount={selectedIds.size}
					removeDisabled={removeDisabled}
					batchRemoving={batchRemoving}
					onRequestRemove={requestRemoveConfirm}
					showPracticeEntry
					practiceContentKind="vocab"
					practiceDisabled={practiceDisabled}
					practicePoolTotal={totalCount}
				/>
			</div>
		</>
	);
}
