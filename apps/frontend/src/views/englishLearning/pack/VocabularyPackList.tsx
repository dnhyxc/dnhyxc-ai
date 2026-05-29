/**
 * 单词包拉取结果列表：直播订阅 EnglishPackStore；历史模式走分页 hook
 */
import { Button, Spinner, Toast } from '@ui/index';
import { Star } from 'lucide-react';
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
import {
	playEnglishPreferred,
	stopAllEnglishPlayback,
} from '@/utils/englishTts';
import { VocabularyWordCard } from '../components/VocabularyWordCard';
import type { useVocabularyPackHistoryList } from './useVocabularyPackHistoryList';

export type VocabularyPackListProps = {
	/** 历史明细分页（由结果页 hook 注入，避免重复请求） */
	history?: ReturnType<typeof useVocabularyPackHistoryList> | null;
};

function VocabularyPackListInner({ history }: VocabularyPackListProps) {
	const { t } = useI18n();
	const isHistoryMode = Boolean(history?.active);
	const liveItems = EnglishPackStore.vocabItems;

	const items = isHistoryMode && history ? history.items : liveItems;

	const [playingKey, setPlayingKey] = useState<string | null>(null);
	const {
		favoritedWordKeys,
		getVocabularyFavoriteId,
		setVocabularyFavoriteId,
		clearVocabularyFavorite,
	} = useIncrementalVocabFavoriteStatus(items);
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

	if (items.length === 0) {
		return null;
	}

	return (
		<div className="min-w-0 space-y-4">
			<div className="min-w-0">
				<div className="mb-0 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
					{items.map((item, i) => {
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
											className={cn('size-3.5', isFavorited && 'fill-current')}
											aria-hidden
										/>
									</Button>
								}
							/>
						);
					})}
				</div>
				{isHistoryMode && history?.loadingMore ? (
					<div className="col-span-full text-textcolor/50 flex items-center justify-center gap-1.5 py-2 text-xs">
						<Spinner className="size-3.5 text-textcolor/50" aria-hidden />
						{t('common.loadingMore')}
					</div>
				) : null}
			</div>
		</div>
	);
}

export const VocabularyPackList = observer(VocabularyPackListInner);
