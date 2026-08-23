/**
 * 经典句资源库：右侧语句列表（续读预取 + 向下滚动加载）
 */
import Loading from '@design/Loading';
import { Button, ScrollArea, Toast } from '@ui/index';
import { Star } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { useI18n } from '@/hooks';
import { useIncrementalClassicQuoteFavoriteStatus } from '@/hooks/useIncrementalClassicQuoteFavoriteStatus';
import { cn } from '@/lib/utils';
import {
	addEnglishClassicQuoteFavorite,
	classicQuoteFavoriteContentKey,
	type EnglishClassicQuotesLibraryItemRow,
	type EnglishClassicQuotesLibraryListItem,
	listEnglishClassicQuotesLibraryItems,
	removeEnglishClassicQuoteFavorite,
} from '@/service';
import {
	resolveElResumeOffset,
	setElResumeOffset,
} from '@/store/englishLearningResume';
import {
	englishPracticePoolKeys,
	setEnglishPracticePoolMeta,
} from '@/store/englishPracticePool';
import { playPreferred, stopAllPlayback } from '@/utils/speech';
import { ClassicQuoteCard } from '../../components/ClassicQuoteCard';
import { ListScrollCornerFab } from '../../components/ListScrollCornerFab';
import { EnglishPracticeEntry } from '../../components/practiceEntry';
import { useEnglishLearningList } from '../../hooks/useEnglishLearningList';
import {
	composeViewportScroll,
	useListScrollCornerFab,
} from '../../hooks/useListScrollCornerFab';
import {
	LibraryListLoadMoreRow,
	LibraryVirtuosoGrid,
} from '../components/LibraryVirtuosoGrid';

export type ClassicQuotesLibrarySectionProps = {
	libraryId: string | null;
	libraryMeta: EnglishClassicQuotesLibraryListItem | null;
	onResumeOffsetChange?: (libraryId: string, offset: number) => void;
};

export function ClassicQuotesLibrarySection({
	libraryId,
	libraryMeta,
	onResumeOffsetChange,
}: ClassicQuotesLibrarySectionProps) {
	const { t } = useI18n();
	const navigate = useNavigate();
	const [playingKey, setPlayingKey] = useState<string | null>(null);
	const [favoriteActionKey, setFavoriteActionKey] = useState<string | null>(
		null,
	);

	const fetchClassicPage = useCallback(
		async (id: string, limit: number, offset: number) => {
			const res = await listEnglishClassicQuotesLibraryItems(id, {
				limit,
				offset,
				silent: true,
			});
			if (!res.data) {
				throw new Error('empty library items response');
			}
			return {
				library: res.data.library,
				items: Array.isArray(res.data.items) ? res.data.items : [],
			};
		},
		[],
	);

	const scrollViewportRef = useRef<HTMLDivElement>(null);
	const [gridReady, setGridReady] = useState(false);

	useEffect(() => {
		setGridReady(false);
	}, [libraryId]);

	const handleGridReady = useCallback(() => {
		setGridReady(true);
	}, []);

	/** 浏览中只写本地；离开库时由页面 flush 到 DB */
	const handleResumeOffsetChange = useCallback(
		(id: string, offset: number) => {
			setElResumeOffset('classic', id, offset);
			onResumeOffsetChange?.(id, offset);
		},
		[onResumeOffsetChange],
	);

	const {
		items,
		patchItems,
		resolvedLibrary,
		loading,
		loadingMore,
		initialScrollItemIndex,
		onViewportScroll,
		onEndReached,
	} = useEnglishLearningList<
		EnglishClassicQuotesLibraryItemRow,
		EnglishClassicQuotesLibraryListItem
	>({
		libraryId,
		cacheNamespace: 'classic',
		initialResumeOffset: libraryId
			? resolveElResumeOffset(
					'classic',
					libraryId,
					libraryMeta?.itemsResumeOffset ?? 0,
				)
			: 0,
		onResumeOffsetChange: handleResumeOffsetChange,
		resumeModuleKey: 'library-classic',
		viewportRef: scrollViewportRef,
		fetchPage: fetchClassicPage,
	});

	const {
		isClassicQuoteFavorited,
		resolveClassicQuoteFavoriteId,
		setClassicQuoteFavoriteId,
		clearClassicQuoteFavorite,
	} = useIncrementalClassicQuoteFavoriteStatus(items, { libraryId });

	useEffect(() => {
		if (!libraryId) return;
		const meta = libraryMeta ?? resolvedLibrary;
		const n = meta?.quoteCount ?? items.length;
		const title = (libraryMeta ?? resolvedLibrary)?.title?.trim();
		if (n > 0 || title) {
			setEnglishPracticePoolMeta(
				englishPracticePoolKeys.library(libraryId, 'classic'),
				{
					total: n > 0 ? n : undefined,
					title,
				},
			);
		}
	}, [libraryId, libraryMeta, resolvedLibrary, items.length]);

	useEffect(() => {
		stopAllPlayback();
		setPlayingKey(null);
	}, [libraryId]);

	const toggleQuoteAudio = useCallback(
		async (text: string, key: string) => {
			if (playingKey === key) {
				stopAllPlayback();
				setPlayingKey(null);
				return;
			}
			stopAllPlayback();
			setPlayingKey(key);
			try {
				await playPreferred(text, { cloudSingleUtterance: true });
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

	const toggleClassicQuoteFavorite = useCallback(
		async (item: EnglishClassicQuotesLibraryItemRow) => {
			const ck = classicQuoteFavoriteContentKey(item.english);
			if (!ck) return;
			setFavoriteActionKey(ck);
			try {
				if (isClassicQuoteFavorited(item.english, item.favoriteId)) {
					const favoriteId = resolveClassicQuoteFavoriteId(
						item.english,
						item.favoriteId,
					);
					if (!favoriteId) {
						clearClassicQuoteFavorite(ck);
						patchItems((list) =>
							list.map((row) =>
								classicQuoteFavoriteContentKey(row.english) === ck
									? { ...row, favoriteId: null }
									: row,
							),
						);
						return;
					}
					await removeEnglishClassicQuoteFavorite(favoriteId);
					clearClassicQuoteFavorite(ck);
					patchItems((list) =>
						list.map((row) =>
							classicQuoteFavoriteContentKey(row.english) === ck
								? { ...row, favoriteId: null }
								: row,
						),
					);
				} else {
					const res = await addEnglishClassicQuoteFavorite(item);
					const newId = res.data?.id;
					if (newId) {
						setClassicQuoteFavoriteId(ck, newId);
						patchItems((list) =>
							list.map((row) =>
								classicQuoteFavoriteContentKey(row.english) === ck
									? { ...row, favoriteId: newId }
									: row,
							),
						);
					}
				}
			} catch {
				// 错误提示由 http 客户端统一处理
			} finally {
				setFavoriteActionKey(null);
			}
		},
		[
			isClassicQuoteFavorited,
			resolveClassicQuoteFavoriteId,
			setClassicQuoteFavoriteId,
			clearClassicQuoteFavorite,
			patchItems,
		],
	);

	const { mode, onScrollCornerFab, onScrollCornerFabClick } =
		useListScrollCornerFab(
			scrollViewportRef,
			items.length,
			Boolean(libraryId) && items.length > 0,
		);

	if (!libraryId) {
		return (
			<div className="text-textcolor/60 flex h-full min-h-0 flex-col items-center justify-center px-6 text-center text-sm">
				{t('englishLearning.library.selectLibraryClassic')}
			</div>
		);
	}

	const meta = libraryMeta ?? resolvedLibrary;
	const title = meta?.title?.trim() || '—';
	const total = meta?.quoteCount ?? items.length;
	const showInitialLoading = loading && items.length === 0;
	const awaitingGrid = items.length > 0 && !gridReady;
	const showEmpty = !loading && items.length === 0;

	return (
		<div className="flex h-full min-h-0 flex-col @container">
			<div className="flex h-12 shrink-0 items-center justify-between gap-3 overflow-hidden px-4">
				<div className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden">
					<span
						className="text-textcolor min-w-0 truncate text-base font-semibold"
						title={title}
					>
						{title}
					</span>
					<span className="text-textcolor/50 shrink-0 whitespace-nowrap text-sm">
						{t('englishLearning.library.quotesHeading', { count: total })} /{' '}
						{t('common.loaded', {
							count: items.length,
							type: t('common.type-2'),
						})}
					</span>
				</div>
				<div className="flex shrink-0 flex-nowrap items-center gap-3">
					<EnglishPracticeEntry
						variant="text"
						disabled={total <= 0}
						practice={{
							contentKind: 'classic',
							source: 'library',
							libraryId,
							sourceTitle: meta?.title?.trim() || undefined,
							poolTotal: total > 0 ? total : undefined,
						}}
					/>
					<button
						type="button"
						className="flex items-center gap-1 text-teal-500 hover:text-teal-400 cursor-pointer text-sm"
						onClick={() => {
							navigate('/english-learning/favorites?kind=classic');
						}}
					>
						<Star className="size-4.5" />
						{t('route.englishLearning.favorites.title')}
					</button>
				</div>
			</div>
			{showInitialLoading ? (
				<div className="text-textcolor/60 flex min-h-0 flex-1 items-center justify-center px-4 pb-4 text-center text-sm">
					<Loading text={t('englishLearning.library.quotesLoading')} />
				</div>
			) : (
				<div className="relative min-h-0 flex-1">
					{awaitingGrid ? (
						<div className="bg-theme-background absolute inset-0 z-10 flex items-center justify-center px-4 pb-4">
							<Loading text={t('englishLearning.library.quotesLoading')} />
						</div>
					) : null}
					<ScrollArea
						ref={scrollViewportRef}
						className="relative min-h-0 h-full px-4 pb-4"
						viewportClassName="[overflow-anchor:none] [&>div]:block! [&>div]:min-h-0! [&>div]:h-auto! [&>div]:w-full! [&>div]:min-w-0!"
						onScroll={composeViewportScroll(
							onViewportScroll,
							onScrollCornerFab,
						)}
					>
						{showEmpty ? (
							<div className="text-textcolor/60 py-12 text-center text-sm">
								{t('englishLearning.classic.empty')}
							</div>
						) : (
							<div className="relative w-full">
								<LibraryVirtuosoGrid
									key={libraryId}
									items={items}
									viewportRef={scrollViewportRef}
									columnMode="classic"
									initialScrollItemIndex={initialScrollItemIndex}
									getItemKey={(item) => {
										const contentKey = classicQuoteFavoriteContentKey(
											item.english,
										);
										return `${item.id}-${contentKey || item.english.slice(0, 48)}`;
									}}
									onEndReached={onEndReached}
									onReady={handleGridReady}
									itemContent={(item) => {
										const contentKey = classicQuoteFavoriteContentKey(
											item.english,
										);
										const key = `${item.id}-${contentKey || item.english.slice(0, 48)}`;
										const playing = playingKey === key;
										const isFavorited = isClassicQuoteFavorited(
											item.english,
											item.favoriteId,
										);
										const favBusy = favoriteActionKey === contentKey;
										return (
											<div data-library-item-id={item.id} className="h-full">
												<ClassicQuoteCard
													variant="library"
													data={{
														english: item.english,
														translationZh: item.translationZh,
														source: item.source,
														noteZh: item.noteZh,
													}}
													playing={playing}
													onTogglePlay={() =>
														void toggleQuoteAudio(item.english, key)
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
															disabled={favBusy}
															aria-busy={favBusy}
															onClick={() => {
																if (favBusy) return;
																void toggleClassicQuoteFavorite(item);
															}}
															className={cn(
																'h-7 w-7 shrink-0 cursor-pointer rounded-md border p-0 transition-colors',
																favBusy && 'opacity-60',
																isFavorited
																	? 'border-amber-400/45 bg-amber-400/12 text-amber-600'
																	: 'border-theme/10 text-textcolor/55 hover:border-theme/20 hover:bg-theme/10 hover:text-amber-600',
															)}
															aria-pressed={isFavorited}
															aria-label={
																isFavorited
																	? t('englishLearning.classic.unfavoriteQuote')
																	: t('englishLearning.classic.favoriteQuote')
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
											</div>
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
		</div>
	);
}
