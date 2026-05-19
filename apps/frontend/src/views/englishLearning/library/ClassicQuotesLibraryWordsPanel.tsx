/**
 * 资源库页：右侧经典语句列表（滚动分页加载）
 */
import Loading from '@design/Loading';
import { Button, ScrollArea, Spinner, Toast } from '@ui/index';
import { Square, Star, Volume2 } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
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
	playEnglishPreferred,
	stopAllEnglishPlayback,
} from '@/utils/englishTts';
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

	const { items, resolvedLibrary, loading, loadingMore, onViewportScroll } =
		useLibraryWordsList<
			EnglishClassicQuotesLibraryItemRow,
			EnglishClassicQuotesLibraryListItem
		>({
			libraryId,
			fetchPage: fetchClassicPage,
		});

	const { favoritedContentKeys, setFavoritedContentKeys } =
		useIncrementalClassicQuoteFavoriteStatus(items);

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
				<div
					className="flex items-center gap-1 text-teal-500 hover:text-teal-400 cursor-pointer text-sm"
					onClick={() => {
						navigate('/english-learning/favorites?kind=classic');
					}}
				>
					<Star className="size-4.5" />
					{t('route.englishLearning.favorites.title')}
				</div>
			</div>
			<ScrollArea
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
