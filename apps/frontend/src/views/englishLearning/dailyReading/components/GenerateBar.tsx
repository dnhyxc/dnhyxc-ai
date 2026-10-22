import {
	Button,
	Popover,
	PopoverAnchor,
	PopoverContent,
	PopoverTrigger,
	ScrollArea,
} from '@ui/index';
import { Spinner } from '@ui/spinner';
import { BookOpen, History, ScrollText, Trash2, X } from 'lucide-react';
import { observer } from 'mobx-react';
import { useNavigate } from 'react-router';
import { useI18n } from '@/hooks';
import { cn } from '@/lib/utils';
import type { DailyReadingGen, EnglishDailyReadingProfile } from '@/service';
import englishDailyReadingStore from '@/store/englishDailyReading';
import { PRACTICE_PRIMARY_ACTION_BTN_CLASS } from '../../practice/constants';
import { recordTitle } from '../utils/recordTitle';
import { StreamPane } from './StreamPane';

/** 底栏只订生成状态。进行中的历史行不扫全文。 */
export const GenerateBar = observer(function GenerateBar({
	saving,
	themes,
	profile,
	records,
	streamOpen,
	setStreamOpen,
	historyOpen,
	setHistoryOpen,
	selectedId,
	setSelectedId,
	setDeleteId,
}: {
	saving: boolean;
	themes: string[];
	profile: EnglishDailyReadingProfile;
	records: DailyReadingGen[];
	streamOpen: boolean;
	setStreamOpen: (open: boolean) => void;
	historyOpen: boolean;
	setHistoryOpen: (open: boolean) => void;
	selectedId: string | null;
	setSelectedId: (id: string | null) => void;
	setDeleteId: (id: string | null) => void;
}) {
	const { t } = useI18n();
	const navigate = useNavigate();
	const generating = englishDailyReadingStore.generating;
	const paused = englishDailyReadingStore.paused;
	const generateError = englishDailyReadingStore.error;
	const runId = englishDailyReadingStore.runId;
	const showStream =
		generating || (paused && englishDailyReadingStore.text.length > 0);
	const selected = records.find((row) => row.id === selectedId) ?? null;
	const historyView = Boolean(
		selected && (!generating || selected.id !== runId),
	);
	const streamShown = streamOpen && (historyView || showStream);
	const showHistory = records.length > 0 || generating;
	const bothIcons = showHistory && showStream;
	const iconClass = cn(
		'h-10 shrink-0 px-0 transition-colors',
		PRACTICE_PRIMARY_ACTION_BTN_CLASS,
		bothIcons ? 'w-auto min-w-0 flex-1' : 'w-10',
	);
	const liveRow =
		generating && runId
			? {
					id: runId,
					startedAt: englishDailyReadingStore.startedAt ?? Date.now(),
					live: true as const,
				}
			: null;
	const historyRows = [
		...(liveRow ? [liveRow] : []),
		...records
			.filter((row) => row.id !== liveRow?.id)
			.map((row) => ({
				id: row.id,
				text: row.text,
				startedAt: row.startedAt,
				status: row.status,
				live: false as const,
			})),
	];
	return (
		<Popover
			open={streamShown}
			onOpenChange={(open) => {
				setStreamOpen(open);
				if (open) setHistoryOpen(false);
			}}
		>
			<PopoverAnchor asChild>
				<div className="mx-auto flex w-full max-w-5xl flex-col gap-2">
					{generateError ? (
						<div className="flex items-center justify-between gap-2">
							<p
								className="min-w-0 flex-1 truncate text-sm text-rose-500"
								title={generateError}
							>
								{generateError}
							</p>
							<Button
								type="button"
								variant="ghost"
								size="icon-sm"
								className="size-7 -mr-2 shrink-0 bg-transparent p-0 text-textcolor/55 shadow-none hover:bg-transparent hover:text-rose-500"
								aria-label={t('englishLearning.dailyReading.dismissError')}
								onClick={() => englishDailyReadingStore.clearError()}
							>
								<X className="size-4" aria-hidden />
							</Button>
						</div>
					) : null}
					<div className="flex items-center gap-4">
						<Button
							type="button"
							disabled={saving && !generating}
							className={cn(
								'h-10 min-w-0 flex-1 text-base font-semibold transition-colors',
								PRACTICE_PRIMARY_ACTION_BTN_CLASS,
							)}
							onClick={() => {
								setSelectedId(null);
								setStreamOpen(false);
								if (generating) {
									englishDailyReadingStore.stopRun();
									return;
								}
								englishDailyReadingStore.startRun(themes, profile);
							}}
						>
							{generating ? <Spinner className="size-4 text-white" /> : null}
							{generating
								? t('englishLearning.dailyReading.stopGenerate')
								: t('englishLearning.dailyReading.generate')}
						</Button>
						{showHistory || showStream ? (
							<div
								className={cn(
									'flex shrink-0 gap-4',
									bothIcons && 'w-[calc((100%-7rem)/8)]',
								)}
							>
								{showHistory ? (
									<Popover
										open={historyOpen}
										onOpenChange={(open) => {
											setHistoryOpen(open);
											if (open) setStreamOpen(false);
										}}
									>
										<PopoverTrigger asChild>
											<Button
												type="button"
												size="icon"
												aria-expanded={historyOpen}
												aria-label={t('englishLearning.dailyReading.history')}
												className={iconClass}
												onPointerDown={() => {
													if (historyOpen) {
														setHistoryOpen(false);
														return;
													}
													setStreamOpen(false);
													setHistoryOpen(true);
												}}
												onClick={(event) => event.preventDefault()}
											>
												<History className="size-4" aria-hidden />
											</Button>
										</PopoverTrigger>
										<PopoverContent
											side="top"
											align="end"
											sideOffset={8}
											className="w-72 overflow-hidden p-0"
											style={{ animation: 'none' }}
											onCloseAutoFocus={(event) => event.preventDefault()}
										>
											<ScrollArea
												className="w-full"
												style={{
													height: Math.min(336, historyRows.length * 56),
												}}
											>
												{historyRows.map((row) => (
													<div
														key={row.id}
														className="group relative flex h-14 items-center hover:bg-teal-500/10"
													>
														<Button
															type="button"
															variant="ghost"
															className={cn(
																'h-14 min-w-0 flex-1 justify-start rounded-none bg-transparent px-3 hover:bg-transparent',
																row.live && 'pr-8',
															)}
															onClick={() => {
																setSelectedId(row.id);
																setStreamOpen(true);
																setHistoryOpen(false);
															}}
														>
															<span className="flex min-w-0 flex-1 flex-col items-start gap-1">
																<span
																	className={cn(
																		'w-full truncate text-left text-sm',
																		row.live
																			? ''
																			: row.status === 'done'
																				? 'group-hover:pr-14'
																				: 'group-hover:pr-8',
																	)}
																>
																	{row.live
																		? t(
																				'englishLearning.dailyReading.generatingManual',
																			)
																		: recordTitle(row.text, row.startedAt)}
																</span>
																<span className="w-full truncate text-left text-xs text-textcolor/45">
																	{new Date(row.startedAt).toLocaleString()}
																</span>
															</span>
														</Button>
														{row.live ? (
															<Spinner className="mr-2 size-4 shrink-0 text-textcolor/55" />
														) : (
															<div className="absolute top-2 right-2 flex items-center gap-0.5 opacity-0 pointer-events-none transition-opacity duration-150 group-hover:pointer-events-auto group-hover:opacity-100">
																{row.status === 'done' ? (
																	<Button
																		type="button"
																		variant="ghost"
																		size="sm"
																		className="h-7 w-7 shrink-0 rounded-md p-0 text-textcolor/65 transition-colors hover:border hover:border-teal-500/20 hover:bg-teal-500/10 hover:text-teal-500"
																		aria-label={t(
																			'englishLearning.dailyReading.openReading',
																		)}
																		onClick={(event) => {
																			event.stopPropagation();
																			navigate(
																				`/english-learning/daily-reading/${row.id}?origin=manual`,
																			);
																		}}
																	>
																		<BookOpen
																			className="size-3.5"
																			aria-hidden
																		/>
																	</Button>
																) : null}
																<Button
																	type="button"
																	variant="ghost"
																	size="sm"
																	className="h-7 w-7 shrink-0 rounded-md p-0 text-textcolor/65 transition-colors hover:border hover:border-destructive/10 hover:bg-destructive/10 hover:text-destructive"
																	aria-label={t(
																		'englishLearning.dailyReading.deleteHistory',
																	)}
																	onClick={(event) => {
																		event.stopPropagation();
																		setDeleteId(row.id);
																	}}
																>
																	<Trash2 className="size-3.5" aria-hidden />
																</Button>
															</div>
														)}
													</div>
												))}
											</ScrollArea>
										</PopoverContent>
									</Popover>
								) : null}
								{showStream ? (
									<PopoverTrigger asChild>
										<Button
											type="button"
											size="icon"
											aria-expanded={streamOpen && !historyView}
											aria-label={t('englishLearning.dailyReading.showStream')}
											className={iconClass}
											onPointerDown={() => {
												if (streamShown && !historyView) {
													setStreamOpen(false);
													return;
												}
												setHistoryOpen(false);
												setSelectedId(null);
												setStreamOpen(true);
											}}
											onClick={(event) => event.preventDefault()}
										>
											<ScrollText className="size-4" aria-hidden />
										</Button>
									</PopoverTrigger>
								) : null}
							</div>
						) : null}
					</div>
				</div>
			</PopoverAnchor>
			<PopoverContent
				side="top"
				align="start"
				sideOffset={8}
				className="w-(--radix-popover-trigger-width) overflow-hidden p-0"
				style={{ animation: 'none' }}
				onCloseAutoFocus={(event) => event.preventDefault()}
			>
				<StreamPane history={historyView && selected ? selected : null} />
			</PopoverContent>
		</Popover>
	);
});
