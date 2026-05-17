/**
 * 单词收藏页区块：列表数据 + 朗读 + 面板 UI
 */
import { Toast } from '@ui/index';
import { useCallback, useEffect, useState } from 'react';
import { useI18n } from '@/hooks';
import {
	playEnglishPreferred,
	stopAllEnglishPlayback,
} from '@/utils/englishTts';
import { useVocabularyFavoritesList } from './useVocabularyFavoritesList';
import { VocabularyFavoritesPanel } from './VocabularyFavoritesPanel';

export type VocabularyFavoritesSectionProps = {
	active: boolean;
	onEntriesCountChange?: (count: number) => void;
};

export function VocabularyFavoritesSection({
	active,
	onEntriesCountChange,
}: VocabularyFavoritesSectionProps) {
	const { t } = useI18n();
	const { entries, loading, loadingMore, onViewportScroll, onBatchRemove } =
		useVocabularyFavoritesList(active);

	useEffect(() => {
		onEntriesCountChange?.(entries.length);
	}, [entries.length, onEntriesCountChange]);
	const [playingKey, setPlayingKey] = useState<string | null>(null);

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
				setPlayingKey((k) => (k === key ? null : k));
			}
		},
		[playingKey, t],
	);

	return (
		<VocabularyFavoritesPanel
			entries={entries}
			loading={loading}
			loadingMore={loadingMore}
			onViewportScroll={onViewportScroll}
			playingKey={playingKey}
			onTogglePlayWord={onTogglePlayWord}
			onBatchRemoveFavorites={onBatchRemove}
		/>
	);
}
