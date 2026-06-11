/**
 * 记词记录：词汇库随机练过的单词（分页 + 滚动加载）
 */
import Loading from '@design/Loading';
import { Button, ScrollArea, Spinner, Toast } from '@ui/index';
import { Star } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { useI18n, useIncrementalVocabFavoriteStatus } from '@/hooks';
import { cn } from '@/lib/utils';
import type { EnglishVocabularyItem } from '@/service';
import {
	addEnglishVocabularyFavorite,
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
import { EnglishLearningPanelHeader } from '../../components/EnglishLearningPanelHeader';
import { EnglishPracticeEntry } from '../../components/practiceEntry';
import { VocabularyWordCard } from '../../components/VocabularyWordCard';
import { useDailyMemorizeRecordsList } from '../hooks/useDailyMemorizeRecordsList';

export default function EnglishLearningDailyRecordsPage() {
	const { t } = useI18n();
	const { entries, totalCount, loading, loadingMore, onViewportScroll } =
		useDailyMemorizeRecordsList(true);
	const [playingKey, setPlayingKey] = useState<string | null>(null);
	const [favoriteActionKey, setFavoriteActionKey] = useState<string | null>(
		null,
	);

	const {
		favoritedWordKeys,
		getVocabularyFavoriteId,
		setVocabularyFavoriteId,
		clearVocabularyFavorite,
	} = useIncrementalVocabFavoriteStatus(entries);

	const showInitialLoading = loading && entries.length === 0;
	const showEmpty = !loading && entries.length === 0 && !loadingMore;

	useEffect(() => {
		stopAllEnglishPlayback();
		setPlayingKey(null);
	}, []);

	useEffect(() => {
		if (totalCount <= 0) return;
		setEnglishPracticePoolMeta(englishPracticePoolKeys.dailyMemorize(), {
			total: totalCount,
			title: t('englishLearning.practice.sourceDailyMemorize'),
		});
	}, [totalCount, t]);

	const onTogglePlayWord = useCallback(
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
				setPlayingKey(null);
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
						<ScrollArea
							className="min-h-0 flex-1 px-4.5 pb-4"
							onScroll={onViewportScroll}
						>
							{showInitialLoading ? (
								<div className="text-textcolor/60 flex min-h-full flex-1 items-center justify-center py-12 text-center text-sm">
									<Loading text={t('englishLearning.daily.recordsLoading')} />
								</div>
							) : (
								<>
									{showEmpty ? (
										<div className="text-textcolor/60 py-12 text-center text-sm">
											{t('englishLearning.daily.recordsEmpty')}
										</div>
									) : null}
									{entries.length > 0 ? (
										<div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,16rem),1fr))] gap-4">
											{entries.map((item) => {
												const key = item.id;
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
														onTogglePlay={() =>
															void onTogglePlayWord(item.word, key)
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
										<div className="text-textcolor/50 flex items-center justify-center gap-1.5 py-4 text-xs">
											<Spinner
												className="size-3.5 text-textcolor/50"
												aria-hidden
											/>
											{t('common.loadingMore')}
										</div>
									) : null}
								</>
							)}
						</ScrollArea>
					</section>
				</div>
			</div>
		</div>
	);
}
