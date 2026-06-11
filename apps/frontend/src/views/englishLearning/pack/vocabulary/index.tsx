/**
 * 单词拉取结果区块：直播 Store + 历史分页列表
 */
import Loading from '@design/Loading';
import { Button, ScrollArea, Spinner, Toast } from '@ui/index';
import { Star } from 'lucide-react';
import { observer } from 'mobx-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useI18n, useIncrementalVocabFavoriteStatus } from '@/hooks';
import { cn } from '@/lib/utils';
import type { EnglishVocabularyItem } from '@/service';
import {
	addEnglishVocabularyFavorite,
	getEnglishVocabularyHistoryDetail,
	normalizeEnglishVocabWordKey,
	removeEnglishVocabularyFavorite,
} from '@/service';
import EnglishPackStore from '@/store/englishPack';
import {
	englishPracticePoolKeys,
	setEnglishPracticePoolMeta,
} from '@/store/englishPracticePool';
import type { SearchOrganicItem } from '@/types/chat';
import { mergeEnglishPackWebSearchOrganics } from '@/utils/englishPackWebSearchMerge';
import {
	playEnglishPreferred,
	stopAllEnglishPlayback,
} from '@/utils/englishTts';
import { VocabularyWordCard } from '../../components/VocabularyWordCard';
import { PackStreamProgress } from '../components/PackStreamProgress';
import { useVocabularyPackHistoryList } from '../hooks/useVocabularyPackHistoryList';
import type { PackStreamSectionSnapshot } from '../types';

export type VocabularyPackSectionProps = {
	historyStreamId: string | null;
	onSnapshotChange?: (snapshot: PackStreamSectionSnapshot) => void;
};

function VocabularyPackSectionInner({
	historyStreamId,
	onSnapshotChange,
}: VocabularyPackSectionProps) {
	const { t } = useI18n();
	const [historyItemCount, setHistoryItemCount] = useState<number | null>(null);
	const [historyHeader, setHistoryHeader] = useState<{
		topic: string;
		organic: SearchOrganicItem[];
	} | null>(null);

	const fetchHistoryMeta = useCallback(async (sid: string) => {
		const res = await getEnglishVocabularyHistoryDetail(sid);
		const d = res.data;
		if (!d) {
			setHistoryItemCount(0);
			setHistoryHeader({ topic: '', organic: [] });
			return;
		}
		setHistoryHeader({
			topic: d.topic?.trim() ?? '',
			organic: mergeEnglishPackWebSearchOrganics(d.webSearchRounds),
		});
		setHistoryItemCount(d.itemCount ?? 0);
	}, []);

	useEffect(() => {
		const sid = historyStreamId;
		if (!sid) {
			setHistoryItemCount(null);
			setHistoryHeader(null);
			return;
		}
		let cancelled = false;
		EnglishPackStore.vocabEnterHistoryView(sid);
		void (async () => {
			try {
				await fetchHistoryMeta(sid);
			} catch {
				if (!cancelled) {
					setHistoryItemCount(0);
					setHistoryHeader({ topic: '', organic: [] });
				}
			}
		})();
		return () => {
			cancelled = true;
		};
	}, [historyStreamId, fetchHistoryMeta]);

	const loading = EnglishPackStore.vocabLoading;
	const prevLoadingRef = useRef(loading);

	useEffect(() => {
		const wasLoading = prevLoadingRef.current;
		prevLoadingRef.current = loading;
		const sid = historyStreamId;
		if (!sid || !wasLoading || loading) return;
		let cancelled = false;
		void (async () => {
			try {
				await fetchHistoryMeta(sid);
			} catch {
				if (!cancelled) {
					setHistoryItemCount(0);
					setHistoryHeader({ topic: '', organic: [] });
				}
			}
		})();
		return () => {
			cancelled = true;
		};
	}, [historyStreamId, fetchHistoryMeta, loading]);

	const liveItemCount = EnglishPackStore.vocabItems.length;
	const isHistoryView = Boolean(historyStreamId);
	const isLiveStreamView =
		EnglishPackStore.isVocabLiveStreamView(historyStreamId);
	const useHistoryPagination =
		isHistoryView && (!isLiveStreamView || (liveItemCount === 0 && !loading));
	const history = useVocabularyPackHistoryList(
		useHistoryPagination ? historyStreamId : null,
	);

	const itemCount = useHistoryPagination
		? (historyItemCount ?? history.itemCount ?? 0)
		: liveItemCount;
	const loadedCount = useHistoryPagination
		? history.items.length
		: liveItemCount;
	const historyMetaPending = useHistoryPagination && historyItemCount === null;
	const historyListLoading =
		useHistoryPagination && history.loading && history.items.length === 0;
	const showPageLoading =
		useHistoryPagination && (historyMetaPending || historyListLoading);

	const showEmpty =
		!showPageLoading &&
		!loading &&
		!(useHistoryPagination && history.loading) &&
		itemCount === 0 &&
		(!useHistoryPagination || historyItemCount === 0);

	const liveTopic = EnglishPackStore.vocabTopic.trim();
	const liveOrganic = EnglishPackStore.vocabMasterSearchOrganic;
	const historyTopic = historyHeader?.topic ?? '';
	const historyOrganic = historyHeader?.organic ?? [];
	const sameActiveSession = Boolean(
		historyStreamId && EnglishPackStore.vocabActiveStreamId === historyStreamId,
	);
	const preferStoreHeader =
		isLiveStreamView ||
		!isHistoryView ||
		(sameActiveSession && (liveOrganic.length > 0 || liveTopic.length > 0));
	const topic = preferStoreHeader ? liveTopic : historyTopic;
	const masterSearchOrganic = preferStoreHeader ? liveOrganic : historyOrganic;
	const practiceSourceTitle = topic.trim() || undefined;

	useEffect(() => {
		if (itemCount <= 0) return;
		if (isHistoryView && historyStreamId) {
			setEnglishPracticePoolMeta(
				englishPracticePoolKeys.pack(historyStreamId, 'vocab'),
				{
					total: itemCount,
					title: practiceSourceTitle,
				},
			);
		} else if (!isHistoryView) {
			setEnglishPracticePoolMeta(englishPracticePoolKeys.live('vocab'), {
				total: itemCount,
				title: practiceSourceTitle,
			});
		}
	}, [itemCount, isHistoryView, historyStreamId, practiceSourceTitle]);

	const practiceParams = useMemo(() => {
		if (loadedCount <= 0) return null;
		if (isHistoryView && historyStreamId) {
			return {
				contentKind: 'vocab' as const,
				source: 'pack' as const,
				streamId: historyStreamId,
				sourceTitle: practiceSourceTitle,
				poolTotal: itemCount > 0 ? itemCount : undefined,
			};
		}
		return {
			contentKind: 'vocab' as const,
			source: 'live' as const,
			sourceTitle: practiceSourceTitle,
			poolTotal: itemCount > 0 ? itemCount : undefined,
		};
	}, [
		historyStreamId,
		isHistoryView,
		itemCount,
		loadedCount,
		practiceSourceTitle,
	]);

	const snapshot = useMemo<PackStreamSectionSnapshot>(
		() => ({
			loaded: loadedCount,
			total: itemCount,
			topic,
			masterSearchOrganic,
			practiceParams,
			showPageLoading,
			historyLoadingText: t('englishLearning.vocab.historyLoading'),
			showEmpty,
			emptyHint: t('englishLearning.stream.vocab.empty'),
			onHistoryViewportScroll: useHistoryPagination
				? history.onViewportScroll
				: undefined,
		}),
		[
			history.onViewportScroll,
			itemCount,
			loadedCount,
			masterSearchOrganic,
			practiceParams,
			showEmpty,
			showPageLoading,
			t,
			topic,
			useHistoryPagination,
		],
	);

	useEffect(() => {
		onSnapshotChange?.(snapshot);
	}, [onSnapshotChange, snapshot]);

	const listItems =
		useHistoryPagination && history.active
			? history.items
			: EnglishPackStore.vocabItems;
	const isHistoryMode = useHistoryPagination && history.active;

	const [playingKey, setPlayingKey] = useState<string | null>(null);
	const {
		favoritedWordKeys,
		getVocabularyFavoriteId,
		setVocabularyFavoriteId,
		clearVocabularyFavorite,
	} = useIncrementalVocabFavoriteStatus(listItems);
	const [favoriteActionKey, setFavoriteActionKey] = useState<string | null>(
		null,
	);

	const toggleWordAudio = useCallback(
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

	const toggleVocabularyFavorite = useCallback(
		async (item: EnglishVocabularyItem, currentlyFavorited: boolean) => {
			const wk = normalizeEnglishVocabWordKey(item.word);
			if (!wk) return;
			setFavoriteActionKey(wk);
			try {
				if (currentlyFavorited) {
					const favoriteId = getVocabularyFavoriteId(wk);
					if (!favoriteId) return;
					await removeEnglishVocabularyFavorite(favoriteId);
					clearVocabularyFavorite(wk);
				} else {
					const res = await addEnglishVocabularyFavorite(item);
					const favoriteId = res.data?.id;
					if (favoriteId) setVocabularyFavoriteId(wk, favoriteId);
				}
			} catch {
				// 错误提示由 http 客户端统一处理
			} finally {
				setFavoriteActionKey(null);
			}
		},
		[getVocabularyFavoriteId, setVocabularyFavoriteId, clearVocabularyFavorite],
	);

	if (showPageLoading) {
		return (
			<div className="text-textcolor/60 flex min-h-0 flex-1 items-center justify-center px-4 text-center text-sm">
				<Loading text={snapshot.historyLoadingText} />
			</div>
		);
	}

	return (
		<ScrollArea
			className="min-h-0 flex-1 pb-4"
			onScroll={snapshot.onHistoryViewportScroll}
		>
			<div className="space-y-5 px-4">
				{isLiveStreamView || !isHistoryView ? (
					<PackStreamProgress kind="vocab" />
				) : null}

				{listItems.length > 0 ? (
					<div className="min-w-0 space-y-4">
						<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
							{listItems.map((item, i) => {
								const key = isHistoryMode
									? `history-${i}-${item.word}`
									: `${i}-${item.word}`;
								const playing = playingKey === key;
								const wordKey = normalizeEnglishVocabWordKey(item.word);
								const isFavorited = favoritedWordKeys.has(wordKey);
								const favBusy = favoriteActionKey === wordKey;
								const posDisplay = item.pos?.trim()
									? item.pos.endsWith('.')
										? item.pos
										: `${item.pos}.`
									: null;
								return (
									<VocabularyWordCard
										key={key}
										variant="library"
										className="mb-0"
										forceExample
										data={{ ...item, pos: posDisplay }}
										playing={playing}
										onTogglePlay={() => void toggleWordAudio(item.word, key)}
										playLabels={{
											play: t('englishLearning.vocab.playWord'),
											stop: t('englishLearning.tts.stop'),
										}}
										trailingActions={
											<Button
												type="button"
												variant="ghost"
												size="sm"
												disabled={favBusy}
												onClick={() =>
													void toggleVocabularyFavorite(item, isFavorited)
												}
												className={cn(
													'h-7 w-7 shrink-0 rounded-md border p-0 transition-colors',
													isFavorited
														? 'border-amber-400/45 bg-amber-400/12 text-amber-600'
														: 'border-theme/10 text-textcolor/55 hover:border-theme/20 hover:bg-theme/10 hover:text-amber-600',
												)}
												aria-pressed={isFavorited}
												aria-label={
													isFavorited
														? t('englishLearning.vocab.unfavoriteWord')
														: t('englishLearning.vocab.favoriteWord')
												}
											>
												<Star
													className={cn(
														'size-3.5',
														isFavorited && 'fill-current',
													)}
													aria-hidden
												/>
											</Button>
										}
									/>
								);
							})}
						</div>
						{isHistoryMode && history.loadingMore ? (
							<div className="text-textcolor/50 flex items-center justify-center gap-1.5 py-2 text-xs">
								<Spinner className="size-3.5 text-textcolor/50" aria-hidden />
								{t('common.loadingMore')}
							</div>
						) : null}
					</div>
				) : null}

				{showEmpty ? (
					<div className="text-textcolor/45 rounded-md border border-dashed border-theme/15 bg-theme/5 px-4 py-10 text-center text-sm leading-relaxed">
						{snapshot.emptyHint}
					</div>
				) : null}
			</div>
		</ScrollArea>
	);
}

export const VocabularyPackSection = observer(VocabularyPackSectionInner);
