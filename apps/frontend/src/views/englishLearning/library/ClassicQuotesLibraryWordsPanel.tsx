/**
 * 资源库页：右侧经典语句列表（滚动分页加载）
 */
import Loading from '@design/Loading';
import { Button, ScrollArea, Toast } from '@ui/index';
import { Loader2, Square, Star, Volume2 } from 'lucide-react';
import {
	type UIEventHandler,
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
} from 'react';
import { useNavigate } from 'react-router';
import {
	SCROLL_LOAD_THRESHOLD_PX,
	VOCAB_LIBRARY_ITEMS_PAGE_SIZE,
} from '@/constant';
import { useI18n } from '@/hooks';
import { cn } from '@/lib/utils';
import type { EnglishClassicQuoteItem } from '@/service';
import {
	addEnglishClassicQuoteFavorite,
	classicQuoteFavoriteContentKey,
	type EnglishClassicQuotesLibraryItemRow,
	type EnglishClassicQuotesLibraryListItem,
	fetchEnglishClassicQuoteFavoriteStatus,
	listEnglishClassicQuotesLibraryItems,
	removeEnglishClassicQuoteFavorite,
} from '@/service';
import {
	playEnglishPreferred,
	stopAllEnglishPlayback,
} from '@/utils/englishTts';

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
	const [items, setItems] = useState<EnglishClassicQuotesLibraryItemRow[]>([]);
	const [resolvedLibrary, setResolvedLibrary] =
		useState<EnglishClassicQuotesLibraryListItem | null>(null);
	const [loading, setLoading] = useState(false);
	const [loadingMore, setLoadingMore] = useState(false);
	const [playingKey, setPlayingKey] = useState<string | null>(null);
	const [favoritedContentKeys, setFavoritedContentKeys] = useState<Set<string>>(
		() => new Set(),
	);
	const [favoriteActionKey, setFavoriteActionKey] = useState<string | null>(
		null,
	);
	const offsetRef = useRef(0);
	const hasMoreRef = useRef(true);
	const fetchingMoreRef = useRef(false);
	const libraryIdRef = useRef<string | null>(null);

	const itemsEnglishSig = useMemo(
		() => items.map((it) => it.english).join('\u0001'),
		[items],
	);

	useEffect(() => {
		if (items.length === 0) {
			setFavoritedContentKeys(new Set());
			return;
		}
		let cancelled = false;
		void (async () => {
			try {
				const res = await fetchEnglishClassicQuoteFavoriteStatus(
					items.map((i) => i.english),
				);
				if (cancelled) return;
				const keys = res.data?.favoritedContentKeys;
				setFavoritedContentKeys(new Set(Array.isArray(keys) ? keys : []));
			} catch {
				if (!cancelled) setFavoritedContentKeys(new Set());
			}
		})();
		return () => {
			cancelled = true;
		};
	}, [itemsEnglishSig]);

	const fetchFirstPage = useCallback(async (id: string) => {
		fetchingMoreRef.current = false;
		setLoading(true);
		setLoadingMore(false);
		offsetRef.current = 0;
		hasMoreRef.current = true;
		setItems([]);
		setResolvedLibrary(null);
		try {
			const res = await listEnglishClassicQuotesLibraryItems(id, {
				limit: VOCAB_LIBRARY_ITEMS_PAGE_SIZE,
				offset: 0,
			});
			if (res.data?.library) {
				setResolvedLibrary(res.data.library);
			}
			const list = Array.isArray(res.data?.items) ? res.data.items : [];
			setItems(list);
			offsetRef.current = list.length;
			hasMoreRef.current = list.length >= VOCAB_LIBRARY_ITEMS_PAGE_SIZE;
		} catch {
			setItems([]);
			hasMoreRef.current = false;
		} finally {
			setLoading(false);
		}
	}, []);

	const fetchMore = useCallback(async () => {
		const id = libraryIdRef.current;
		if (!id || !hasMoreRef.current || fetchingMoreRef.current || loading) {
			return;
		}
		fetchingMoreRef.current = true;
		setLoadingMore(true);
		const offset = offsetRef.current;
		try {
			const res = await listEnglishClassicQuotesLibraryItems(id, {
				limit: VOCAB_LIBRARY_ITEMS_PAGE_SIZE,
				offset,
			});
			const chunk = Array.isArray(res.data?.items) ? res.data.items : [];
			if (chunk.length === 0) {
				hasMoreRef.current = false;
				return;
			}
			setItems((prev) => [...prev, ...chunk]);
			offsetRef.current += chunk.length;
			hasMoreRef.current = chunk.length >= VOCAB_LIBRARY_ITEMS_PAGE_SIZE;
		} catch {
			hasMoreRef.current = false;
		} finally {
			fetchingMoreRef.current = false;
			setLoadingMore(false);
		}
	}, [loading]);

	useEffect(() => {
		stopAllEnglishPlayback();
		setPlayingKey(null);
		libraryIdRef.current = libraryId;
		if (!libraryId) {
			setItems([]);
			return;
		}
		void fetchFirstPage(libraryId);
	}, [libraryId, fetchFirstPage]);

	const onViewportScroll = useCallback<UIEventHandler<HTMLDivElement>>(
		(e) => {
			const el = e.currentTarget;
			const rest = el.scrollHeight - el.scrollTop - el.clientHeight;
			if (rest < SCROLL_LOAD_THRESHOLD_PX) {
				void fetchMore();
			}
		},
		[fetchMore],
	);

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
					await removeEnglishClassicQuoteFavorite(item.english);
					setFavoritedContentKeys((prev) => {
						const next = new Set(prev);
						next.delete(ck);
						return next;
					});
				} else {
					await addEnglishClassicQuoteFavorite(item);
					setFavoritedContentKeys((prev) => {
						const next = new Set(prev);
						next.add(ck);
						return next;
					});
				}
			} catch {
				// 错误提示由 http 客户端统一处理
			} finally {
				setFavoriteActionKey(null);
			}
		},
		[],
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
			<div className="flex items-center justify-between px-4.5 pt-3.5">
				<div>
					<h2 className="text-textcolor line-clamp-2 text-base font-semibold">
						{title}
					</h2>
					<p className="text-textcolor/50 mt-0.5 text-xs">
						{t('englishLearning.library.quotesHeading', { count: total })}
					</p>
				</div>
				<div className="flex items-center gap-1.5 mt-1">
					<Button
						variant="link"
						className="border border-theme/15 bg-theme/10 hover:border-theme/15 hover:bg-theme/15"
						onClick={() => {
							navigate('/english-learning/favorites?kind=classic');
						}}
					>
						{t('route.englishLearning.favorites.title')}
					</Button>
				</div>
			</div>
			<ScrollArea className="min-h-0 flex-1 p-4" onScroll={onViewportScroll}>
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
										<div
											key={key}
											className="select-text bg-theme/5 border border-theme/10 flex flex-col gap-1.5 rounded-md px-3 py-2.5"
										>
											<div className="flex items-start justify-between gap-2">
												<div className="text-textcolor min-w-0 flex-1 text-base font-medium leading-snug">
													{item.english}
												</div>
												<div className="flex shrink-0 items-center gap-1">
													<Button
														type="button"
														variant="ghost"
														size="sm"
														onClick={() =>
															void toggleQuoteAudio(item.english, key)
														}
														className={cn(
															'h-7 w-7 shrink-0 rounded-md border p-2 transition-colors',
															playing
																? 'border-violet-500/40 bg-violet-500/15 text-violet-600 dark:text-violet-400'
																: 'border-theme/10 text-textcolor/60 hover:border-theme/20 hover:bg-theme/10 hover:text-violet-600 dark:hover:text-violet-400',
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
												</div>
											</div>
											<div className="text-textcolor/95 text-sm leading-snug">
												{item.translationZh}
											</div>
											<div className="text-textcolor/70 text-xs">
												{t('englishLearning.classic.sourceLabel')}
												{item.source || '—'}
											</div>
											{item.noteZh?.trim() ? (
												<div className="text-textcolor/70 text-xs leading-relaxed italic">
													{item.noteZh}
												</div>
											) : null}
										</div>
									);
								})}
							</div>
						) : null}
						{loadingMore ? (
							<div className="text-textcolor/50 flex items-center justify-center gap-1.5 py-4 text-xs">
								<Loader2 className="size-3.5 animate-spin" aria-hidden />
								{t('common.loadingMore')}
							</div>
						) : null}
					</>
				)}
			</ScrollArea>
		</div>
	);
}
