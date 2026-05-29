/**
 * 资源库页：右侧经典语句列表（滚动分页加载）
 */
import Loading from '@design/Loading';
import { Button, ScrollArea, Spinner, Toast } from '@ui/index';
import { Star } from 'lucide-react';
import {
	useCallback,
	useEffect,
	useLayoutEffect,
	useRef,
	useState,
} from 'react';
import { useNavigate } from 'react-router';
import { useI18n, useIncrementalClassicQuoteFavoriteStatus } from '@/hooks';
import { cn } from '@/lib/utils';
import type { EnglishClassicQuoteItem } from '@/service';
import {
	addEnglishClassicQuoteFavorite,
	classicQuoteFavoriteContentKey,
	type EnglishClassicQuotesLibraryItemRow,
	type EnglishClassicQuotesLibraryListItem,
	listEnglishClassicQuotesLibraryItems,
	removeEnglishClassicQuoteFavorite,
} from '@/service';
import {
	englishPracticePoolKeys,
	setEnglishPracticePoolMeta,
} from '@/store/englishPracticePool';
import {
	playEnglishPreferred,
	stopAllEnglishPlayback,
} from '@/utils/englishTts';
import { ClassicQuoteCard } from '../components/ClassicQuoteCard';
import { EnglishPracticeEntry } from '../components/practiceEntry';
import { useLibraryWordsList } from './useLibraryWordsList';

export type ClassicQuotesLibraryWordsPanelProps = {
	libraryId: string | null;
	libraryMeta: EnglishClassicQuotesLibraryListItem | null;
};

export function ClassicQuotesLibraryWordsPanel({
	libraryId,
	libraryMeta,
}: ClassicQuotesLibraryWordsPanelProps) {
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

	const {
		items,
		resolvedLibrary,
		loading,
		loadingMore,
		initialScrollTop,
		onViewportScroll,
	} = useLibraryWordsList<
		EnglishClassicQuotesLibraryItemRow,
		EnglishClassicQuotesLibraryListItem
	>({
		libraryId,
		cacheNamespace: 'classic',
		fetchPage: fetchClassicPage,
	});

	useLayoutEffect(() => {
		const el = scrollViewportRef.current;
		if (!el || initialScrollTop <= 0) return;
		el.scrollTop = initialScrollTop;
	}, [libraryId, initialScrollTop]);

	const {
		favoritedContentKeys,
		getClassicQuoteFavoriteId,
		setClassicQuoteFavoriteId,
		clearClassicQuoteFavorite,
	} = useIncrementalClassicQuoteFavoriteStatus(items);

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
		stopAllEnglishPlayback();
		setPlayingKey(null);
	}, [libraryId]);

	const toggleQuoteAudio = useCallback(
		async (text: string, key: string) => {
			if (playingKey === key) {
				stopAllEnglishPlayback();
				setPlayingKey(null);
				return;
			}
			stopAllEnglishPlayback();
			setPlayingKey(key);
			try {
				await playEnglishPreferred(text);
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
		async (item: EnglishClassicQuoteItem, currentlyFavorited: boolean) => {
			const ck = classicQuoteFavoriteContentKey(item.english);
			if (!ck) return;
			setFavoriteActionKey(ck);
			try {
				if (currentlyFavorited) {
					const favoriteId = getClassicQuoteFavoriteId(ck);
					if (!favoriteId) return;
					await removeEnglishClassicQuoteFavorite(favoriteId);
					clearClassicQuoteFavorite(ck);
				} else {
					const res = await addEnglishClassicQuoteFavorite(item);
					const favoriteId = res.data?.id;
					if (favoriteId) setClassicQuoteFavoriteId(ck, favoriteId);
				}
			} catch {
				// 错误提示由 http 客户端统一处理
			} finally {
				setFavoriteActionKey(null);
			}
		},
		[
			getClassicQuoteFavoriteId,
			setClassicQuoteFavoriteId,
			clearClassicQuoteFavorite,
		],
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
	const showEmpty = !loading && items.length === 0;

	return (
		<div className="flex h-full min-h-0 flex-col @container">
			<div className="h-12 flex px-4.5 py-1 items-center justify-between gap-1 text-textcolor line-clamp-2 text-base">
				<div className="flex items-center gap-2">
					{title}
					<div className="text-textcolor/50 mt-0.5 text-sm">
						{t('englishLearning.library.quotesHeading', { count: total })} /{' '}
						{t('common.loaded', {
							count: items.length,
							type: t('common.type-2'),
						})}
					</div>
				</div>
				<div className="flex shrink-0 items-center gap-3">
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
			<ScrollArea
				ref={scrollViewportRef}
				className="min-h-0 flex-1 px-4 pb-4"
				onScroll={onViewportScroll}
			>
				{showInitialLoading ? (
					<div className="text-textcolor/60 flex min-h-full flex-1 items-center justify-center text-center text-sm">
						<Loading text={t('englishLearning.library.quotesLoading')} />
					</div>
				) : (
					<>
						{showEmpty ? (
							<div className="text-textcolor/60 py-12 text-center text-sm">
								{t('englishLearning.classic.empty')}
							</div>
						) : null}
						{items.length > 0 ? (
							<div className="grid grid-cols-1 gap-4 @min-[28rem]:grid-cols-2">
								{items.map((item) => {
									const contentKey = classicQuoteFavoriteContentKey(
										item.english,
									);
									const key = `${item.id}-${contentKey || item.english.slice(0, 48)}`;
									const playing = playingKey === key;
									const isFavorited =
										contentKey.length > 0 &&
										favoritedContentKeys.has(contentKey);
									const favBusy = favoriteActionKey === contentKey;
									return (
										<ClassicQuoteCard
											key={key}
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
													disabled={favBusy || !contentKey}
													onClick={() =>
														void toggleClassicQuoteFavorite(item, isFavorited)
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
									);
								})}
							</div>
						) : null}
						{loadingMore ? (
							<div className="col-span-full text-textcolor/50 flex items-center justify-center gap-1.5 py-4 text-xs">
								<Spinner className="size-3.5 text-textcolor/50" aria-hidden />
								{t('common.loadingMore')}
							</div>
						) : null}
					</>
				)}
			</ScrollArea>
		</div>
	);
}
