/**
 * 语句错题集列表页主体
 */
import Confirm from '@design/Confirm';
import Loading from '@design/Loading';
import { Button, ScrollArea, Spinner, Toast } from '@ui/index';
import { Trash2 } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useI18n } from '@/hooks';
import { cn } from '@/lib/utils';
import type { EnglishClassicQuoteMistakeListEntry } from '@/service';
import {
	isEnglishTtsSupported,
	playEnglishPreferred,
	stopAllEnglishPlayback,
} from '@/utils/englishTts';
import { ClassicQuoteCard } from '../../shared/ClassicQuoteCard';
import { MistakesPanelFooter } from '../components/MistakesPanelFooter';
import { useClassicQuoteMistakesList } from './useClassicQuoteMistakesList';

export type MistakesListCounts = {
	loaded: number;
	total: number;
};

export type ClassicQuoteMistakesPanelProps = {
	active?: boolean;
	onCountsChange?: (counts: MistakesListCounts) => void;
};

export function ClassicQuoteMistakesPanel({
	active = true,
	onCountsChange,
}: ClassicQuoteMistakesPanelProps) {
	const { t } = useI18n();
	const {
		entries,
		totalCount,
		loading,
		loadingMore,
		onViewportScroll,
		onBatchRemove,
	} = useClassicQuoteMistakesList(active);

	const [playingKey, setPlayingKey] = useState<string | null>(null);
	const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
	const [batchRemoving, setBatchRemoving] = useState(false);
	const [removeConfirmOpen, setRemoveConfirmOpen] = useState(false);
	const [singleRemoveConfirmOpen, setSingleRemoveConfirmOpen] = useState(false);
	const [singleRemoveTarget, setSingleRemoveTarget] =
		useState<EnglishClassicQuoteMistakeListEntry | null>(null);

	const showInitialLoading = loading && entries.length === 0;
	const showEmpty = !loading && entries.length === 0 && !loadingMore;
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
		(entry: EnglishClassicQuoteMistakeListEntry) => {
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
	}, [onBatchRemove, singleRemoveTarget, t]);

	const toggleQuotePlay = useCallback(
		async (english: string, key: string) => {
			if (playingKey === key) {
				stopAllEnglishPlayback();
				setPlayingKey(null);
				return;
			}
			if (!isEnglishTtsSupported()) {
				Toast({
					type: 'warning',
					title: t('englishLearning.tts.unsupported'),
				});
				return;
			}
			stopAllEnglishPlayback();
			setPlayingKey(key);
			try {
				await playEnglishPreferred(english);
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

	useEffect(() => {
		return () => stopAllEnglishPlayback();
	}, []);

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
						? t('englishLearning.mistakes.classicRemoveConfirmDesc', {
								english: singleRemoveTarget.english,
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
				<ScrollArea
					className="@container min-h-0 flex-1 px-4"
					onScroll={onViewportScroll}
				>
					{showInitialLoading ? (
						<div className="text-textcolor/60 flex min-h-full flex-1 items-center justify-center text-center text-sm">
							<Loading text={t('common.loading')} />
						</div>
					) : (
						<div className="grid grid-cols-1 gap-4 @min-[28rem]:grid-cols-2">
							{entries.map((row) => {
								const playKey = `classic-mistake-${row.id}`;
								const playing = playingKey === playKey;
								return (
									<ClassicQuoteCard
										key={row.id}
										variant="selectable"
										data={{
											english: row.english,
											translationZh: row.translationZh,
											source: row.source,
											noteZh: row.noteZh,
										}}
										selection={{
											controlId: `classic-mistake-${row.id}`,
											checked: selectedIds.has(row.id),
											disabled: selectionDisabled,
											onCheckedChange: (checked) =>
												toggleRowSelected(row.id, checked),
											ariaLabel: `${t('englishLearning.mistakes.toggleRow')}: ${row.english.slice(0, 120)}`,
										}}
										playing={playing}
										onTogglePlay={() =>
											void toggleQuotePlay(row.english, playKey)
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
													'border-theme/10 text-textcolor/60 hover:border-destructive/35 hover:bg-destructive/10 hover:text-destructive',
												)}
												aria-label={t('englishLearning.mistakes.removeAction')}
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
							})}
							{loadingMore ? (
								<div className="col-span-full text-textcolor/50 flex items-center justify-center gap-1.5 py-4 text-xs">
									<Spinner className="size-3.5 text-textcolor/50" aria-hidden />
									{t('common.loadingMore')}
								</div>
							) : null}
							{showEmpty ? (
								<div className="text-textcolor/60 col-span-full py-12 text-center text-sm">
									{t('englishLearning.mistakes.classicEmpty')}
								</div>
							) : null}
						</div>
					)}
				</ScrollArea>
				<MistakesPanelFooter
					selectAllId="classic-mistakes-select-all"
					showSelection={!showInitialLoading && entries.length > 0}
					selectAllCheckboxState={selectAllCheckboxState}
					selectionDisabled={selectionDisabled}
					onToggleSelectAll={toggleSelectAllLoaded}
					selectedCount={selectedIds.size}
					removeDisabled={removeDisabled}
					batchRemoving={batchRemoving}
					onRequestRemove={requestRemoveConfirm}
					showPracticeEntry
					practiceContentKind="classic"
					practiceDisabled={practiceDisabled}
					practicePoolTotal={totalCount}
				/>
			</div>
		</>
	);
}
