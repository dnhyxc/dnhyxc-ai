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

export type FavoritesListCounts = {
	loaded: number;
	/** 服务端返回的收藏总数（首屏请求即可得） */
	total: number;
};

export type VocabularyFavoritesSectionProps = {
	active: boolean;
	onCountsChange?: (counts: FavoritesListCounts) => void;
};

export function VocabularyFavoritesSection({
	active,
	onCountsChange,
}: VocabularyFavoritesSectionProps) {
	const { t } = useI18n();
	const {
		entries,
		totalCount,
		loading,
		loadingMore,
		onViewportScroll,
		onBatchRemove,
	} = useVocabularyFavoritesList(active);

	useEffect(() => {
		onCountsChange?.({
			loaded: entries.length,
			total: totalCount,
		});
	}, [entries.length, totalCount, onCountsChange]);
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
