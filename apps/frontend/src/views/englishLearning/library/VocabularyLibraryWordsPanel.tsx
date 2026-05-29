/**
 * 资源库页：右侧单词列表（滚动分页加载）
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
import {
	englishPracticePoolKeys,
	setEnglishPracticePoolMeta,
} from '@/store/englishPracticePool';
import {
	playEnglishPreferred,
	stopAllEnglishPlayback,
} from '@/utils/englishTts';
import { EnglishPracticeEntry } from '../shared/practiceEntry';
import { VocabularyWordCard } from '../shared/VocabularyWordCard';
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

	const scrollViewportRef = useRef<HTMLDivElement>(null);

	const {
		items,
		resolvedLibrary,
		loading,
		loadingMore,
		initialScrollTop,
		onViewportScroll,
	} = useLibraryWordsList<
		EnglishVocabularyLibraryItemRow,
		EnglishVocabularyLibraryListItem
	>({
		libraryId,
		cacheNamespace: 'vocab',
		fetchPage: fetchVocabPage,
	});

	useLayoutEffect(() => {
		const el = scrollViewportRef.current;
		if (!el || initialScrollTop <= 0) return;
		el.scrollTop = initialScrollTop;
	}, [libraryId, initialScrollTop]);

	useEffect(() => {
		if (!libraryId) return;
		const meta = libraryMeta ?? resolvedLibrary;
		const n = meta?.wordCount ?? items.length;
		const title = (libraryMeta ?? resolvedLibrary)?.title?.trim();
		if (n > 0 || title) {
			setEnglishPracticePoolMeta(
				englishPracticePoolKeys.library(libraryId, 'vocab'),
				{
					total: n > 0 ? n : undefined,
					title,
				},
			);
		}
	}, [libraryId, libraryMeta, resolvedLibrary, items.length]);

	const {
		favoritedWordKeys,
		getVocabularyFavoriteId,
		setVocabularyFavoriteId,
		clearVocabularyFavorite,
	} = useIncrementalVocabFavoriteStatus(items);

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
				await playEnglishPreferred(word, { preferLocal: true });
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
				<div className="flex shrink-0 items-center gap-3">
					<EnglishPracticeEntry
						variant="text"
						disabled={total <= 0}
						practice={{
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
							navigate('/english-learning/favorites');
						}}
					>
						<Star className="size-4.5" />
						{t('englishLearning.practice.favorites')}
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
										<VocabularyWordCard
											key={key}
											variant="library"
											data={item}
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
