/**
 * 英语学习：单词收藏记录抽屉（滚动分页列表）
 * 列表项布局与主区单词卡片一致（含朗读），无收藏按钮。
 */
import { Drawer } from '@design/Drawer';
import Loading from '@design/Loading';
import { Button, ScrollArea } from '@ui/index';
import { Square, Volume2 } from 'lucide-react';
import type { UIEventHandler } from 'react';
import { useI18n } from '@/hooks';
import { cn } from '@/lib/utils';
import type { EnglishVocabularyFavoriteListEntry } from '@/service';
import { displayIpaWrapped } from '@/utils';

export type VocabularyFavoritesDrawerProps = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	entries: EnglishVocabularyFavoriteListEntry[];
	loading: boolean;
	loadingMore: boolean;
	onViewportScroll: UIEventHandler<HTMLDivElement>;
	/** 与主区单词列表共用，保证互斥朗读与停止后 UI 一致 */
	playingKey: string | null;
	onTogglePlayWord: (word: string, key: string) => void | Promise<void>;
};

export function VocabularyFavoritesDrawer({
	open,
	onOpenChange,
	entries,
	loading,
	loadingMore,
	onViewportScroll,
	playingKey,
	onTogglePlayWord,
}: VocabularyFavoritesDrawerProps) {
	const { t } = useI18n();

	const showInitialLoading = loading && entries.length === 0;
	const showLoadMoreHint = loadingMore;
	const showEmpty = !loading && entries.length === 0 && !loadingMore;

	return (
		<Drawer
			title={t('englishLearning.vocab.favoritesTitle')}
			open={open}
			onOpenChange={onOpenChange}
			bodyClassName="pt-1.5 pb-2"
		>
			<div className="flex h-full min-h-0 flex-col">
				<ScrollArea
					className="box-border flex min-h-0 flex-1 flex-col pr-1.5"
					onScroll={onViewportScroll}
				>
					<div className="flex min-h-0 w-full flex-1 flex-col">
						{showInitialLoading ? (
							<div className="text-textcolor/60 flex flex-1 flex-col items-center justify-center py-6 text-center text-sm">
								<Loading text={t('englishLearning.vocab.favoritesLoading')} />
							</div>
						) : null}
						{entries.map((row) => {
							const playKey = `fav-vocab-${row.id}`;
							const playing = playingKey === playKey;
							return (
								<div
									key={row.id}
									className="hover:bg-theme/10 flex flex-col gap-1.5 rounded-md px-3 py-2.5 @min-[26rem]:p-3"
								>
									<div className="flex items-start justify-between gap-2">
										<div className="min-w-0 flex-1">
											<div className="truncate text-lg font-semibold text-textcolor @min-[26rem]:text-base">
												{row.word}
											</div>
											<div className="font-mono text-xs leading-snug text-teal-600/90 @min-[26rem]:text-xs dark:text-teal-400/90">
												{displayIpaWrapped(row.ipa)}
											</div>
										</div>
										<div className="flex shrink-0 items-center gap-1">
											<Button
												type="button"
												variant="ghost"
												size="sm"
												onClick={() => void onTogglePlayWord(row.word, playKey)}
												className={cn(
													'h-7 w-7 shrink-0 rounded-md border p-2 transition-colors @min-[26rem]:border-theme/15 @min-[26rem]:p-1.5',
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
										</div>
									</div>
									<div className="text-textcolor/95 text-sm leading-snug @min-[26rem]:text-sm">
										{row.translationZh}
									</div>
									<div className="text-textcolor/80 text-sm leading-relaxed italic @min-[26rem]:text-xs">
										{row.example}
									</div>
								</div>
							);
						})}
						{showLoadMoreHint ? (
							<div className="text-textcolor/50 py-2 text-center text-xs">
								{t('common.loadingMore')}
							</div>
						) : null}
						{showEmpty ? (
							<div className="text-textcolor/60 py-8 text-center text-sm">
								{t('englishLearning.vocab.favoritesEmpty')}
							</div>
						) : null}
					</div>
				</ScrollArea>
			</div>
		</Drawer>
	);
}
