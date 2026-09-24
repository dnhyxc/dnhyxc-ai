/**
 * 英语学习：单词拉取历史抽屉（滚动分页列表）
 */
import { Drawer } from '@design/Drawer';
import Loading from '@design/Loading';
import { Button, ScrollArea, Spinner } from '@ui/index';
import { Loader2, Trash2 } from 'lucide-react';
import { observer } from 'mobx-react';
import type { MouseEvent, UIEventHandler } from 'react';
import { useI18n } from '@/hooks';
import { cn } from '@/lib/utils';
import type { EnglishVocabularyHistoryEntry } from '@/service';
import EnglishPackStore from '@/store/englishPack';
import { Entry } from '../../components/entry';

/** 与知识库列表一致：hover 时标题右侧预留 */
const ROW_HOVER_PR = [
	'',
	'group-hover:pr-8',
	'group-hover:pr-14',
	'group-hover:pr-22',
	'group-hover:pr-30',
] as const;

const ROW_ACTIONS_CLASS =
	'absolute top-2 right-2 flex items-center gap-0.5 opacity-0 pointer-events-none transition-opacity duration-150 group-hover:opacity-100 group-hover:pointer-events-auto has-[[data-state=delayed-open]]:opacity-100 has-[[data-state=delayed-open]]:pointer-events-auto has-[[data-state=instant-open]]:opacity-100 has-[[data-state=instant-open]]:pointer-events-auto';

export type VocabularyHistoryDrawerProps = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	entries: EnglishVocabularyHistoryEntry[];
	loading: boolean;
	loadingMore: boolean;
	loadedStreamId: string | null;
	loadingDetailId: string | null;
	deletingStreamId: string | null;
	onViewportScroll: UIEventHandler<HTMLDivElement>;
	onSelectEntry: (streamId: string) => void | Promise<void>;
	onDeleteEntry: (entry: EnglishVocabularyHistoryEntry) => void;
	/** 从 /english-learning 首页历史抽屉进入练习时，返回应回到首页 */
	practiceReturnTo?: 'home';
};

function formatHistoryLineDate(iso: string): string {
	try {
		return new Date(iso).toLocaleString();
	} catch {
		return iso;
	}
}

function VocabularyHistoryDrawerInner({
	open,
	onOpenChange,
	entries,
	loading,
	loadingMore,
	loadedStreamId,
	loadingDetailId,
	deletingStreamId,
	onViewportScroll,
	onSelectEntry,
	onDeleteEntry,
	practiceReturnTo,
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
							const deleting = deletingStreamId === h.streamId;
							const isStreaming =
								EnglishPackStore.vocabLoading &&
								EnglishPackStore.vocabActiveStreamId === h.streamId;
							const showEntry = h.wordCount > 0;
							const actionCount = (showEntry ? 1 : 0) + 1;
							const hoverPr =
								ROW_HOVER_PR[Math.min(actionCount, ROW_HOVER_PR.length - 1)];
							return (
								<div
									key={h.streamId}
									className={cn(
										'group relative flex min-w-0 flex-col gap-0.5 overflow-hidden rounded-md p-2',
										active ? 'bg-theme/10' : 'hover:bg-theme/10',
									)}
								>
									<button
										type="button"
										disabled={busy || deleting}
										onClick={() => void onSelectEntry(h.streamId)}
										className="flex min-w-0 w-full cursor-pointer flex-col gap-0.5 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-60"
									>
										<div
											className={cn(
												'mb-1 min-w-0 w-full pr-0',
												!isStreaming && hoverPr,
											)}
										>
											<span className="text-textcolor block min-w-0 truncate text-sm font-medium">
												{h.topic || '—'}
											</span>
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
											{busy || deleting ? (
												<Loader2
													className="size-3 shrink-0 animate-spin"
													aria-hidden
												/>
											) : null}
										</div>
									</button>
									{isStreaming ? (
										<div
											role="status"
											className="absolute top-2 right-2 flex h-7 w-7 shrink-0 items-center justify-center"
											aria-label={t('englishLearning.vocab.historyStreaming')}
										>
											<Spinner className="size-4 shrink-0 text-teal-600 dark:text-teal-400" />
										</div>
									) : (
										<div className={ROW_ACTIONS_CLASS}>
											{showEntry ? (
												<Entry
													variant="icon"
													disabled={busy || deleting}
													practice={{
														source: 'pack',
														streamId: h.streamId,
														sourceTitle: h.topic?.trim() || undefined,
														poolTotal:
															h.wordCount > 0 ? h.wordCount : undefined,
														returnTo:
															practiceReturnTo === 'home' ? 'home' : undefined,
														returnStreamId:
															practiceReturnTo === 'home'
																? undefined
																: (() => {
																		const backId = loadedStreamId?.trim();
																		return backId && backId !== h.streamId
																			? backId
																			: undefined;
																	})(),
													}}
													onBeforeNavigate={(
														e: MouseEvent<HTMLButtonElement>,
													) => {
														e.stopPropagation();
													}}
												/>
											) : null}
											<Button
												type="button"
												variant="ghost"
												size="sm"
												disabled={busy || deleting}
												className={cn(
													'h-7 w-7 shrink-0 rounded-md p-0 transition-colors',
													'text-textcolor/65 hover:border hover:border-destructive/10 hover:bg-destructive/10 hover:text-destructive',
												)}
												aria-label={t(
													'englishLearning.packHistory.deleteAction',
												)}
												onClick={(e) => {
													e.stopPropagation();
													onDeleteEntry(h);
												}}
											>
												<Trash2 className="size-3.5" aria-hidden />
											</Button>
										</div>
									)}
								</div>
							);
						})}
						{showLoadMoreHint ? (
							<div className="col-span-full text-textcolor/50 flex items-center justify-center gap-1.5 py-2 text-xs">
								<Spinner className="size-3.5 text-textcolor/50" aria-hidden />
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

export const VocabularyHistoryDrawer = observer(VocabularyHistoryDrawerInner);
