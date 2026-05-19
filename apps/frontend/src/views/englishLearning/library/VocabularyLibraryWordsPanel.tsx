/**
 * 资源库页：右侧单词列表（滚动分页加载）
 */
import Loading from '@design/Loading';
import { Button, ScrollArea, Spinner, Toast } from '@ui/index';
import { Square, Star, Volume2 } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { useI18n, useIncrementalVocabFavoriteStatus } from '@/hooks';
import { cn } from '@/lib/utils';
import type { EnglishVocabularyItem } from '@/service';
import {
	addEnglishVocabularyFavorite,
	type EnglishVocabularyLibraryItemRow,
	type EnglishVocabularyLibraryListItem,
	listEnglishVocabularyLibraryItems,
	normalizeEnglishVocabWordKey,
	removeEnglishVocabularyFavorite,
} from '@/service';
import { displayIpaWrapped } from '@/utils';
import {
	playEnglishPreferred,
	stopAllEnglishPlayback,
} from '@/utils/englishTts';
import { useLibraryWordsList } from './useLibraryWordsList';

export type VocabularyLibraryWordsPanelProps = {
	libraryId: string | null;
	libraryMeta: EnglishVocabularyLibraryListItem | null;
};

export function VocabularyLibraryWordsPanel({
	libraryId,
	libraryMeta,
}: VocabularyLibraryWordsPanelProps) {
	const { t } = useI18n();
	const navigate = useNavigate();
	const [playingKey, setPlayingKey] = useState<string | null>(null);
	const [favoriteActionKey, setFavoriteActionKey] = useState<string | null>(
		null,
	);

	const fetchVocabPage = useCallback(
		async (id: string, limit: number, offset: number) => {
			const res = await listEnglishVocabularyLibraryItems(id, {
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
			EnglishVocabularyLibraryItemRow,
			EnglishVocabularyLibraryListItem
		>({
			libraryId,
			fetchPage: fetchVocabPage,
		});

	const { favoritedWordKeys, setFavoritedWordKeys } =
		useIncrementalVocabFavoriteStatus(items);

	useEffect(() => {
		stopAllEnglishPlayback();
		setPlayingKey(null);
	}, [libraryId]);

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
					await removeEnglishVocabularyFavorite(item.word);
					setFavoritedWordKeys((prev) => {
						const next = new Set(prev);
						next.delete(wk);
						return next;
					});
				} else {
					await addEnglishVocabularyFavorite(item);
					setFavoritedWordKeys((prev) => {
						const next = new Set(prev);
						next.add(wk);
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
				{t('englishLearning.library.selectLibrary')}
			</div>
		);
	}

	const meta = libraryMeta ?? resolvedLibrary;
	const title = meta?.title?.trim() || '—';
	const total = meta?.wordCount ?? items.length;
	const showInitialLoading = loading && items.length === 0;
	const showEmpty = !loading && items.length === 0;

	return (
		<div className="flex h-full min-h-0 flex-col @container">
			<div className="h-12 flex px-4.5 py-1 items-center justify-between gap-1 text-textcolor line-clamp-2 text-base">
				<div className="flex items-center gap-2">
					{title}
					<div className="text-textcolor/50 mt-0.5 text-sm">
						{t('englishLearning.library.wordsHeading', { count: total })} /{' '}
						{t('common.loaded', {
							count: items.length,
							type: t('common.type-1'),
						})}
					</div>
				</div>
				<div
					className="flex items-center gap-1 text-teal-500 hover:text-teal-400 cursor-pointer text-sm"
					onClick={() => {
						navigate('/english-learning/favorites');
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
						<Loading text={t('englishLearning.library.wordsLoading')} />
					</div>
				) : (
					<>
						{showEmpty ? (
							<div className="text-textcolor/60 py-12 text-center text-sm">
								{t('englishLearning.vocab.empty')}
							</div>
						) : null}
						{items.length > 0 ? (
							<div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,16rem),1fr))] gap-4">
								{items.map((item) => {
									const key = `${item.id}-${item.word}`;
									const playing = playingKey === key;
									const wordKey = normalizeEnglishVocabWordKey(item.word);
									const isFavorited = favoritedWordKeys.has(wordKey);
									const favBusy = favoriteActionKey === wordKey;
									return (
										<div
											key={key}
											className="select-text bg-theme/5 border border-theme/10 flex flex-col gap-1.5 rounded-md px-3 py-2.5"
										>
											<div className="flex items-start justify-between gap-2">
												<div className="min-w-0 flex-1">
													<div className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5">
														<div className="truncate text-lg font-semibold text-textcolor">
															{item.word}
														</div>
														{item.pos?.trim() ? (
															<span className="text-textcolor/55 shrink-0 text-xs font-medium">
																{item.pos}
															</span>
														) : null}
													</div>
													<div className="font-mono text-xs leading-snug text-teal-600/90 dark:text-teal-400/90">
														{displayIpaWrapped(item.ipa)}
													</div>
												</div>
												<div className="flex shrink-0 items-center gap-1">
													<Button
														type="button"
														variant="ghost"
														size="sm"
														onClick={() => void toggleWordAudio(item.word, key)}
														className={cn(
															'h-7 w-7 shrink-0 rounded-md border p-2 transition-colors',
															playing
																? 'border-teal-500/40 bg-teal-500/15 text-teal-600 dark:text-teal-400'
																: 'border-theme/10 text-textcolor/60 hover:border-theme/20 hover:bg-theme/10 hover:text-teal-600 dark:hover:text-teal-400',
														)}
														aria-label={
															playing
																? t('englishLearning.tts.stop')
																: t('englishLearning.vocab.playWord')
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
														title={
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
												</div>
											</div>
											<div className="text-textcolor/95 text-sm leading-snug">
												{item.translationZh}
											</div>
											{item.example?.trim() ? (
												<div className="text-textcolor/80 text-sm leading-relaxed italic">
													{item.example}
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
