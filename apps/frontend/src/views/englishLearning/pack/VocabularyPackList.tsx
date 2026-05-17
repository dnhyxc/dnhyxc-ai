/**
 * 单词包拉取结果列表（订阅 EnglishPackStore，跨路由实时更新）
 */
import { Button, Toast } from '@ui/index';
import { Square, Star, Volume2 } from 'lucide-react';
import { observer } from 'mobx-react';
import { useCallback, useState } from 'react';
import { useI18n, useIncrementalVocabFavoriteStatus } from '@/hooks';
import { cn } from '@/lib/utils';
import type { EnglishVocabularyItem } from '@/service';
import {
	addEnglishVocabularyFavorite,
	normalizeEnglishVocabWordKey,
	removeEnglishVocabularyFavorite,
} from '@/service';
import EnglishPackStore from '@/store/englishPack';
import { displayIpaWrapped } from '@/utils';
import {
	playEnglishPreferred,
	stopAllEnglishPlayback,
} from '@/utils/englishTts';
import { MasterWebSearchResultsBar } from '../shared/WebSearchResultsBar';

function VocabularyPackListInner() {
	const { t } = useI18n();
	const items = EnglishPackStore.vocabItems;
	const masterSearchOrganic = EnglishPackStore.vocabMasterSearchOrganic;
	const topic = EnglishPackStore.vocabTopic.trim();

	const [playingKey, setPlayingKey] = useState<string | null>(null);
	const { favoritedWordKeys, setFavoritedWordKeys } =
		useIncrementalVocabFavoriteStatus(items);
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
		[setFavoritedWordKeys],
	);

	if (items.length === 0) {
		return null;
	}

	return (
		<div className="min-w-0 space-y-4">
			<div className="flex flex-wrap items-center gap-2 text-textcolor/45 text-sm font-medium">
				<span>
					{t('englishLearning.vocab.listHeading')}
					<span className="mt-0.5">（{items.length}）</span>
				</span>
				{masterSearchOrganic.length > 0 ? (
					<MasterWebSearchResultsBar items={masterSearchOrganic} t={t} />
				) : null}
			</div>
			{topic ? (
				<p className="text-textcolor/50 text-xs leading-snug">
					{t('englishLearning.stream.topicLabel')}: {topic}
				</p>
			) : null}
			<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
				{items.map((item, i) => {
					const key = `${i}-${item.word}`;
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
											<span
												className="text-textcolor/55 shrink-0 text-xs font-medium tracking-wide"
												title={t('englishLearning.vocab.pos')}
											>
												{item.pos.endsWith('.') ? item.pos : `${item.pos}.`}
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
									>
										<Star
											className={cn('size-3.5', isFavorited && 'fill-current')}
											aria-hidden
										/>
									</Button>
								</div>
							</div>
							<div className="text-textcolor/95 text-sm leading-snug">
								{item.translationZh}
							</div>
							<div className="text-textcolor/80 text-sm leading-relaxed italic">
								{item.example}
							</div>
						</div>
					);
				})}
			</div>
		</div>
	);
}

export const VocabularyPackList = observer(VocabularyPackListInner);
