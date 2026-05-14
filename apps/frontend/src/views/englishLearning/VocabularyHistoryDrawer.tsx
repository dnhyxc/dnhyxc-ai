/**
 * 英语学习：单词拉取历史抽屉（滚动分页列表）
 */
import { Drawer } from '@design/Drawer';
import Loading from '@design/Loading';
import { ScrollArea } from '@ui/index';
import { Loader2 } from 'lucide-react';
import { type UIEventHandler } from 'react';
import { useI18n } from '@/hooks';
import { cn } from '@/lib/utils';
import type { EnglishVocabularyHistoryEntry } from '@/service';

export type VocabularyHistoryDrawerProps = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	entries: EnglishVocabularyHistoryEntry[];
	loading: boolean;
	loadingMore: boolean;
	loadedStreamId: string | null;
	loadingDetailId: string | null;
	onViewportScroll: UIEventHandler<HTMLDivElement>;
	onSelectEntry: (streamId: string) => void | Promise<void>;
};

function formatHistoryLineDate(iso: string): string {
	try {
		return new Date(iso).toLocaleString();
	} catch {
		return iso;
	}
}

export function VocabularyHistoryDrawer({
	open,
	onOpenChange,
	entries,
	loading,
	loadingMore,
	loadedStreamId,
	loadingDetailId,
	onViewportScroll,
	onSelectEntry,
}: VocabularyHistoryDrawerProps) {
	const { t } = useI18n();

	const showInitialLoading = loading && entries.length === 0;
	const showLoadMoreHint = loadingMore;
	const showEmpty = !loading && entries.length === 0 && !loadingMore;

	return (
		<Drawer
			title={`${t('englishLearning.vocab.historyTitle')}（${entries.length}）`}
			open={open}
			onOpenChange={onOpenChange}
			bodyClassName="pt-1.5 pb-2"
		>
			<div className="flex h-full min-h-0 flex-col">
				<ScrollArea
					className="box-border flex min-h-0 flex-1 flex-col pr-1.5"
					onScroll={onViewportScroll}
				>
					<div className="flex min-h-0 w-full flex-1 flex-col gap-2">
						{showInitialLoading ? (
							<div className="text-textcolor/60 flex flex-1 flex-col items-center justify-center py-6 text-center text-sm">
								<Loading text={t('englishLearning.vocab.historyLoading')} />
							</div>
						) : null}
						{entries.map((h) => {
							const active = loadedStreamId === h.streamId;
							const busy = loadingDetailId === h.streamId;
							return (
								<div key={h.streamId}>
									<button
										type="button"
										disabled={busy}
										onClick={() => void onSelectEntry(h.streamId)}
										className={cn(
											'flex w-full cursor-pointer flex-col gap-0.5 overflow-hidden rounded-md p-2 text-left transition-colors',
											active ? 'bg-theme/10' : 'hover:bg-theme/10',
										)}
									>
										<div className="text-textcolor line-clamp-2 w-full min-w-0 max-w-full text-sm font-medium wrap-anywhere leading-snug">
											{h.topic || '—'}
										</div>
										<div className="text-textcolor/50 flex w-full flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
											<span>
												{t('englishLearning.vocab.historyWords', {
													count: h.wordCount,
												})}
											</span>
											{(h.webSearchRoundCount ?? 0) > 0 ? (
												<span className="text-teal-600/85 dark:text-teal-400/85">
													{t('englishLearning.packHistory.webSearchRounds', {
														n: h.webSearchRoundCount ?? 0,
													})}
												</span>
											) : null}
											<span className="tabular-nums">
												{formatHistoryLineDate(h.updatedAt)}
											</span>
											{busy ? (
												<Loader2
													className="size-3 shrink-0 animate-spin"
													aria-hidden
												/>
											) : null}
										</div>
									</button>
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
								{t('englishLearning.vocab.historyEmpty')}
							</div>
						) : null}
					</div>
				</ScrollArea>
			</div>
		</Drawer>
	);
}
