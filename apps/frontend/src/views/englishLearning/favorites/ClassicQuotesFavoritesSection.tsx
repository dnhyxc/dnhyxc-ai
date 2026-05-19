/**
 * 经典句收藏页区块：列表数据 + 朗读 + 面板 UI
 */
import { Toast } from '@ui/index';
import { useCallback, useEffect, useState } from 'react';
import { useI18n } from '@/hooks';
import {
	playEnglishPreferred,
	stopAllEnglishPlayback,
} from '@/utils/englishTts';
import { ClassicQuotesFavoritesPanel } from './ClassicQuotesFavoritesPanel';
import { useClassicQuoteFavoritesList } from './useClassicQuoteFavoritesList';

import type { FavoritesListCounts } from './VocabularyFavoritesSection';

export type ClassicQuotesFavoritesSectionProps = {
	active: boolean;
	onCountsChange?: (counts: FavoritesListCounts) => void;
};

export function ClassicQuotesFavoritesSection({
	active,
	onCountsChange,
}: ClassicQuotesFavoritesSectionProps) {
	const { t } = useI18n();
	const {
		entries,
		totalCount,
		loading,
		loadingMore,
		onViewportScroll,
		onBatchRemove,
	} = useClassicQuoteFavoritesList(active);

	useEffect(() => {
		onCountsChange?.({
			loaded: entries.length,
			total: totalCount,
		});
	}, [entries.length, totalCount, onCountsChange]);
	const [playingKey, setPlayingKey] = useState<string | null>(null);

	const onTogglePlayQuote = useCallback(
		async (english: string, key: string) => {
			if (playingKey === key) {
				stopAllEnglishPlayback();
				setPlayingKey(null);
				return;
			}
			stopAllEnglishPlayback();
			setPlayingKey(key);
			try {
				await playEnglishPreferred(english);
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
		<ClassicQuotesFavoritesPanel
			entries={entries}
			loading={loading}
			loadingMore={loadingMore}
			onViewportScroll={onViewportScroll}
			playingKey={playingKey}
			onTogglePlayQuote={onTogglePlayQuote}
			onBatchRemoveFavorites={onBatchRemove}
		/>
	);
}
