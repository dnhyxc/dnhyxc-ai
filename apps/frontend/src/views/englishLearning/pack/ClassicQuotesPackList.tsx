/**
 * 经典句拉取结果列表：直播订阅 EnglishPackStore；历史模式按 streamId 分页 API
 */
import { Button, Toast } from '@ui/index';
import { Square, Star, Volume2 } from 'lucide-react';
import { observer } from 'mobx-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useI18n } from '@/hooks';
import { cn } from '@/lib/utils';
import type { EnglishClassicQuoteItem } from '@/service';
import {
	addEnglishClassicQuoteFavorite,
	classicQuoteFavoriteContentKey,
	fetchEnglishClassicQuoteFavoriteStatus,
	removeEnglishClassicQuoteFavorite,
} from '@/service';
import EnglishPackStore from '@/store/englishPack';
import {
	playEnglishPreferred,
	stopAllEnglishPlayback,
} from '@/utils/englishTts';
import { MasterWebSearchResultsBar } from '../shared/WebSearchResultsBar';
import type { useClassicQuotesPackHistoryList } from './useClassicQuotesPackHistoryList';

export type ClassicQuotesPackListProps = {
	history?: ReturnType<typeof useClassicQuotesPackHistoryList> | null;
};

function ClassicQuotesPackListInner({ history }: ClassicQuotesPackListProps) {
	const { t } = useI18n();
	const isHistoryMode = Boolean(history?.active);
	const liveItems = EnglishPackStore.classicItems;
	const masterSearchOrganic = EnglishPackStore.classicMasterSearchOrganic;
	const topic = EnglishPackStore.classicTopic.trim();

	const items = isHistoryMode && history ? history.items : liveItems;
	const displayTotal =
		isHistoryMode && history ? history.itemCount : items.length;

	const [playingKey, setPlayingKey] = useState<string | null>(null);
	const [favoritedContentKeys, setFavoritedContentKeys] = useState<Set<string>>(
		() => new Set(),
	);
	const [favoriteActionKey, setFavoriteActionKey] = useState<string | null>(
		null,
	);

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
				if (!cancelled) {
					setFavoritedContentKeys(new Set());
				}
			}
		})();
		return () => {
			cancelled = true;
		};
	}, [itemsEnglishSig, items.length]);

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

	if (items.length === 0) {
		return null;
	}

	return (
		<div className="min-w-0 space-y-4">
			<div className="flex flex-wrap items-center gap-2 text-textcolor/45 text-sm font-medium">
				<span>
					{t('englishLearning.classic.listHeading')}
					<span className="mt-0.5">（{displayTotal}）</span>
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
			<div className="select-text grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
				{items.map((item, i) => {
					const contentKey = classicQuoteFavoriteContentKey(item.english);
					const key = isHistoryMode
						? `history-${i}-${contentKey || item.english.slice(0, 48)}`
						: `${i}-${contentKey || item.english.slice(0, 48)}`;
					const playing = playingKey === key;
					const isFavorited =
						contentKey.length > 0 && favoritedContentKeys.has(contentKey);
					const favBusy = favoriteActionKey === contentKey;
					return (
						<div
							key={key}
							className="bg-theme/5 border border-theme/10 flex flex-col gap-1.5 rounded-md px-3 py-2.5"
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
										onClick={() => void toggleQuoteAudio(item.english, key)}
										className={cn(
											'h-7 w-7 shrink-0 rounded-md border p-2 transition-colors',
											playing
												? 'border-violet-500/40 bg-violet-500/15 text-violet-600 dark:text-violet-400'
												: 'border-theme/12 text-textcolor/60 hover:border-theme/20 hover:bg-theme/10 hover:text-violet-600 dark:hover:text-violet-400',
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
												? 'border-amber-400/45 bg-amber-400/12 text-amber-600 dark:text-amber-400'
												: 'border-theme/12 text-textcolor/55 hover:border-theme/20 hover:bg-theme/10 hover:text-amber-600',
										)}
										aria-pressed={isFavorited}
										aria-label={
											isFavorited
												? t('englishLearning.classic.unfavoriteQuote')
												: t('englishLearning.classic.favoriteQuote')
										}
									>
										<Star
											className={cn('size-3.5', isFavorited && 'fill-current')}
											aria-hidden
										/>
									</Button>
								</div>
							</div>
							<div className="text-textcolor/90 text-sm leading-snug">
								{item.translationZh}
							</div>
							<div className="text-textcolor/70 text-xs">
								{t('englishLearning.classic.sourceLabel')}
								{item.source || '—'}
							</div>
							<div className="text-textcolor/70 text-xs leading-relaxed italic">
								{item.noteZh}
							</div>
						</div>
					);
				})}
			</div>
			{isHistoryMode && history?.loadingMore ? (
				<p className="text-textcolor/45 py-3 text-center text-sm">
					{t('common.loadingMore')}
				</p>
			) : null}
		</div>
	);
}

export const ClassicQuotesPackList = observer(ClassicQuotesPackListInner);
