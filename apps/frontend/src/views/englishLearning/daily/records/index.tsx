/**
 * 记词记录：续读预取 + Virtuoso 虚拟滚动（与单词收藏列表一致）
 */
import Loading from '@design/Loading';
import { Button, ScrollArea, Toast } from '@ui/index';
import { Star } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useI18n } from '@/hooks';
import { useIncrementalVocabFavoriteStatus } from '@/hooks/useIncrementalVocabFavoriteStatus';
import { cn } from '@/lib/utils';
import {
	addEnglishVocabularyFavorite,
	type EnglishDailyMemorizeRecordEntry,
	listEnglishDailyMemorizeRecords,
	normalizeEnglishVocabWordKey,
	removeEnglishVocabularyFavorite,
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
import { playPreferred, stopAllPlayback } from '@/utils/speech';
import { EnglishLearningPanelHeader } from '../../components/EnglishLearningPanelHeader';
import { ListScrollCornerFab } from '../../components/ListScrollCornerFab';
import { EnglishPracticeEntry } from '../../components/practiceEntry';
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

const LIST_SCOPE = 'vocab-daily-memorize' as const;
const LIST_RESUME_ID = elFixedListResumeId(LIST_SCOPE);

export default function EnglishLearningDailyRecordsPage() {
	const { t } = useI18n();
	const scrollViewportRef = useRef<HTMLDivElement>(null);
	const [gridReady, setGridReady] = useState(false);
	const [playingKey, setPlayingKey] = useState<string | null>(null);
	const [favoriteActionKey, setFavoriteActionKey] = useState<string | null>(
		null,
	);

	const handleResumeOffsetChange = useCallback(
		(_id: string, offset: number) => {
			setElFixedListResume(LIST_SCOPE, offset);
		},
		[],
	);

	const fetchRecordsPage = useCallback(
		async (_id: string, limit: number, offset: number) => {
			const res = await listEnglishDailyMemorizeRecords({
				limit,
				offset,
				silent: true,
			});
			if (!res.data) {
				throw new Error('empty daily memorize records response');
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
	} = useEnglishLearningList<EnglishDailyMemorizeRecordEntry, null>({
		libraryId: LIST_RESUME_ID,
		cacheNamespace: 'vocab-daily-memorize',
		initialResumeOffset: resolveElFixedListResume(LIST_SCOPE),
		resolveInitialResume: () => resolveElFixedListInitialResume(LIST_SCOPE),
		refetchOnEnter: true,
		onResumeOffsetChange: handleResumeOffsetChange,
		viewportRef: scrollViewportRef,
		fetchPage: fetchRecordsPage,
	});

	const {
		favoritedWordKeys,
		getVocabularyFavoriteId,
		setVocabularyFavoriteId,
		clearVocabularyFavorite,
	} = useIncrementalVocabFavoriteStatus(entries, { libraryId: LIST_RESUME_ID });

	const showInitialLoading = loading && entries.length === 0;
	const awaitingGrid = entries.length > 0 && !gridReady;
	const showEmpty = !loading && entries.length === 0;
	const { mode, onScrollCornerFab, onScrollCornerFabClick } =
		useListScrollCornerFab(
			scrollViewportRef,
			entries.length,
			entries.length > 0,
		);

	useEffect(() => {
		setGridReady(false);
	}, []);

	useEffect(() => {
		const flush = () => {
			flushElFixedListResume(LIST_SCOPE, { keepalive: true });
		};
		const onPageHide = () => flush();
		const onVisibility = () => {
			if (document.visibilityState === 'hidden') flush();
		};
		window.addEventListener('pagehide', onPageHide);
		document.addEventListener('visibilitychange', onVisibility);
		return () => {
			window.removeEventListener('pagehide', onPageHide);
			document.removeEventListener('visibilitychange', onVisibility);
			flush();
		};
	}, []);

	useEffect(() => {
		stopAllPlayback();
		setPlayingKey(null);
	}, []);

	useEffect(() => {
		if (totalCount <= 0) return;
		setEnglishPracticePoolMeta(englishPracticePoolKeys.dailyMemorize(), {
			total: totalCount,
			title: t('englishLearning.practice.sourceDailyMemorize'),
		});
	}, [totalCount, t]);

	const handleGridReady = useCallback(() => {
		setGridReady(true);
	}, []);

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

	const toggleVocabularyFavorite = useCallback(
		async (
			item: EnglishDailyMemorizeRecordEntry,
			currentlyFavorited: boolean,
		) => {
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

	return (
		<div className="flex min-h-0 h-full w-full flex-col">
			<div className="box-border flex h-full min-h-0 w-full min-w-0 flex-col p-5.5 pt-0">
				<div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-md bg-theme-background">
					<EnglishLearningPanelHeader
						titleClassName="flex min-w-0 flex-1 items-center gap-2 overflow-hidden"
						title={
							<>
								<span
									className="min-w-0 truncate"
									title={t('englishLearning.daily.recordsTitle')}
								>
									{t('englishLearning.daily.recordsTitle')}
								</span>
								<span className="text-textcolor/50 shrink-0 whitespace-nowrap text-sm font-normal">
									{t('englishLearning.library.listCount', {
										count: totalCount,
										type: t('common.type-1'),
									})}{' '}
									/{' '}
									{t('common.loaded', {
										count: entries.length,
										type: t('common.type-1'),
									})}
								</span>
							</>
						}
						trailing={
							<EnglishPracticeEntry
								variant="text"
								disabled={totalCount <= 0}
								practice={{
									source: 'dailyMemorize',
									sourceTitle: t(
										'englishLearning.practice.sourceDailyMemorize',
									),
									poolTotal: totalCount > 0 ? totalCount : undefined,
								}}
							/>
						}
					/>
					<section className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
						{showInitialLoading ? (
							<div className="text-textcolor/60 flex min-h-0 flex-1 items-center justify-center px-4 text-center text-sm">
								<Loading text={t('englishLearning.daily.recordsLoading')} />
							</div>
						) : (
							<div className="relative min-h-0 flex-1">
								{awaitingGrid ? (
									<div className="bg-theme-background absolute inset-0 z-10 flex items-center justify-center px-4">
										<Loading text={t('englishLearning.daily.recordsLoading')} />
									</div>
								) : null}
								<ScrollArea
									ref={scrollViewportRef}
									className="relative min-h-0 h-full px-4 pb-4"
									viewportClassName="h-full [overflow-anchor:none] [&>div]:block! [&>div]:min-h-0! [&>div]:h-auto! [&>div]:w-full! [&>div]:min-w-0!"
									onScroll={composeViewportScroll(
										onViewportScroll,
										onScrollCornerFab,
									)}
								>
									{showEmpty ? (
										<div className="text-textcolor/60 py-12 text-center text-sm">
											{t('englishLearning.daily.recordsEmpty')}
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
												itemContent={(item) => {
													const playKey = `daily-rec-${item.id}`;
													const playing = playingKey === playKey;
													const wordKey = normalizeEnglishVocabWordKey(
														item.word,
													);
													const isFavorited = favoritedWordKeys.has(wordKey);
													const favBusy = favoriteActionKey === wordKey;
													return (
														<VocabularyWordCard
															key={item.id}
															variant="library"
															data={item}
															playing={playing}
															onTogglePlay={() =>
																void onTogglePlayWord(item.word, playKey)
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
																	disabled={favBusy}
																	onClick={() =>
																		void toggleVocabularyFavorite(
																			item,
																			isFavorited,
																		)
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
																			? t(
																					'englishLearning.vocab.unfavoriteWord',
																				)
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
												}}
											/>
											{loadingMore ? (
												<LibraryListLoadMoreRow
													label={t('common.loadingMore')}
												/>
											) : null}
										</div>
									)}
								</ScrollArea>
								<ListScrollCornerFab
									mode={mode}
									onClick={onScrollCornerFabClick}
								/>
							</div>
						)}
					</section>
				</div>
			</div>
		</div>
	);
}
