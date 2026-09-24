/**
 * 资源库：左侧库列表（单词 / 经典句，滚动分页）
 */
import Confirm from '@design/Confirm';
import Loading from '@design/Loading';
import { Button, ScrollArea, Spinner, Toast } from '@ui/index';
import { SquareArrowRight, SquarePen, Trash2 } from 'lucide-react';
import { observer } from 'mobx-react';
import {
	type MouseEvent,
	type UIEventHandler,
	useCallback,
	useEffect,
	useRef,
	useState,
} from 'react';
import { useNavigate } from 'react-router';
import {
	SCROLL_LOAD_THRESHOLD_PX,
	VOCAB_LIBRARY_LIST_PAGE_SIZE,
} from '@/constants';
import { useI18n, useIsSuperAdmin } from '@/hooks';
import { cn } from '@/lib/utils';
import {
	deleteEnglishClassicQuotesLibrary,
	deleteEnglishVocabularyLibrary,
	type EnglishClassicQuotesLibraryListItem,
	type EnglishVocabularyLibraryListItem,
	listEnglishClassicQuotesLibraries,
	listEnglishVocabularyLibraries,
	unwrapEnglishLibraryListPage,
} from '@/service';
import {
	hydrateElResumeOffset,
	resolveElResumeOffset,
} from '@/store/englishLearningResume';
import { Annotate, Export } from '../../components/classic';
import { Entry } from '../../components/entry';
import type { EnglishLibraryListItem, LibraryKind } from '../types';
import { getLibraryItemCount } from '../types';
import { LibraryEditDialog } from './LibraryEditDialog';

/** 与知识库列表一致：hover 时标题右侧预留（索引 = 可见操作按钮数） */
const ROW_HOVER_PR = [
	'',
	'group-hover:pr-8',
	'group-hover:pr-14',
	'group-hover:pr-22',
	'group-hover:pr-30',
	'group-hover:pr-38',
] as const;

const ROW_ACTIONS_CLASS =
	'absolute top-2 right-2 flex items-center gap-0.5 opacity-0 pointer-events-none transition-opacity duration-150 group-hover:opacity-100 group-hover:pointer-events-auto has-[[data-state=delayed-open]]:opacity-100 has-[[data-state=delayed-open]]:pointer-events-auto has-[[data-state=instant-open]]:opacity-100 has-[[data-state=instant-open]]:pointer-events-auto';

export type LibraryListPanelProps = {
	kind: LibraryKind;
	selectedId: string | null;
	initialLibraryId?: string | null;
	/** 用于把续读 offset 写回左侧列表项，避免再点同一库时读到旧值 */
	selectedLibrary?: EnglishLibraryListItem | null;
	onSelect: (library: EnglishLibraryListItem) => void;
	/** 当前选中的库被删除且列表已空时，由父级清空 URL 与右侧栏 */
	onLibraryDeleted?: (deletedId: string) => void;
};

function formatLibraryDate(iso: string): string {
	try {
		return new Date(iso).toLocaleString();
	} catch {
		return iso;
	}
}

/** API 列表项：灌入 store（不覆盖会话更新）并用 store 覆盖展示字段 */
function withResumeFromStore(
	kind: LibraryKind,
	list: EnglishLibraryListItem[],
): EnglishLibraryListItem[] {
	return list.map((item) => {
		hydrateElResumeOffset(kind, item.id, item.itemsResumeOffset ?? 0);
		return {
			...item,
			itemsResumeOffset: resolveElResumeOffset(
				kind,
				item.id,
				item.itemsResumeOffset ?? 0,
			),
		};
	});
}

export const LibraryListPanel = observer(function LibraryListPanel({
	kind,
	selectedId,
	initialLibraryId,
	selectedLibrary,
	onSelect,
	onLibraryDeleted,
}: LibraryListPanelProps) {
	const { t } = useI18n();
	const navigate = useNavigate();
	const isSuperAdmin = useIsSuperAdmin();

	const [entries, setEntries] = useState<EnglishLibraryListItem[]>([]);
	const [loading, setLoading] = useState(false);
	const [loadingMore, setLoadingMore] = useState(false);
	const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
	const [deleteTarget, setDeleteTarget] =
		useState<EnglishLibraryListItem | null>(null);
	const [deleting, setDeleting] = useState(false);
	const [visibilityOpen, setVisibilityOpen] = useState(false);
	const [visibilityTarget, setVisibilityTarget] =
		useState<EnglishLibraryListItem | null>(null);
	const offsetRef = useRef(0);
	const hasMoreRef = useRef(true);
	const fetchingMoreRef = useRef(false);
	const autoSelectedRef = useRef(false);
	const bootLibraryIdRef = useRef(initialLibraryId);
	const onSelectRef = useRef(onSelect);
	onSelectRef.current = onSelect;

	useEffect(() => {
		bootLibraryIdRef.current = initialLibraryId;
		autoSelectedRef.current = false;
	}, [kind, initialLibraryId]);

	// 右侧续读写回后同步到列表项
	useEffect(() => {
		if (!selectedLibrary) return;
		const offset = selectedLibrary.itemsResumeOffset ?? 0;
		setEntries((prev) => {
			const idx = prev.findIndex((e) => e.id === selectedLibrary.id);
			if (idx < 0) return prev;
			const cur = prev[idx];
			if ((cur.itemsResumeOffset ?? 0) === offset) return prev;
			const next = prev.slice();
			next[idx] = { ...cur, itemsResumeOffset: offset };
			return next;
		});
	}, [selectedLibrary]);

	const fetchFirstPage = useCallback(async () => {
		fetchingMoreRef.current = false;
		setLoading(true);
		setLoadingMore(false);
		offsetRef.current = 0;
		hasMoreRef.current = true;
		setEntries([]);
		try {
			const res =
				kind === 'vocab'
					? await listEnglishVocabularyLibraries({
							limit: VOCAB_LIBRARY_LIST_PAGE_SIZE,
							offset: 0,
						})
					: await listEnglishClassicQuotesLibraries({
							limit: VOCAB_LIBRARY_LIST_PAGE_SIZE,
							offset: 0,
						});
			const list = withResumeFromStore(
				kind,
				unwrapEnglishLibraryListPage(res.data),
			);
			setEntries(list);
			offsetRef.current = list.length;
			hasMoreRef.current = list.length >= VOCAB_LIBRARY_LIST_PAGE_SIZE;
			if (list.length > 0 && !autoSelectedRef.current) {
				autoSelectedRef.current = true;
				const preferred = bootLibraryIdRef.current
					? list.find((l) => l.id === bootLibraryIdRef.current)
					: undefined;
				onSelectRef.current(preferred ?? list[0]);
			}
		} catch {
			setEntries([]);
			hasMoreRef.current = false;
		} finally {
			setLoading(false);
		}
	}, [kind]);

	const fetchMore = useCallback(async () => {
		if (!hasMoreRef.current || fetchingMoreRef.current || loading) {
			return;
		}
		fetchingMoreRef.current = true;
		setLoadingMore(true);
		const offset = offsetRef.current;
		try {
			const res =
				kind === 'vocab'
					? await listEnglishVocabularyLibraries({
							limit: VOCAB_LIBRARY_LIST_PAGE_SIZE,
							offset,
						})
					: await listEnglishClassicQuotesLibraries({
							limit: VOCAB_LIBRARY_LIST_PAGE_SIZE,
							offset,
						});
			const chunk = withResumeFromStore(
				kind,
				unwrapEnglishLibraryListPage(res.data),
			);
			if (chunk.length === 0) {
				hasMoreRef.current = false;
				return;
			}
			setEntries((prev) => [...prev, ...chunk]);
			offsetRef.current += chunk.length;
			hasMoreRef.current = chunk.length >= VOCAB_LIBRARY_LIST_PAGE_SIZE;
		} catch {
			hasMoreRef.current = false;
		} finally {
			fetchingMoreRef.current = false;
			setLoadingMore(false);
		}
	}, [kind, loading]);

	useEffect(() => {
		void fetchFirstPage();
	}, [kind, fetchFirstPage]);

	const onViewportScroll = useCallback<UIEventHandler<HTMLDivElement>>(
		(e) => {
			const el = e.currentTarget;
			const rest = el.scrollHeight - el.scrollTop - el.clientHeight;
			if (rest < SCROLL_LOAD_THRESHOLD_PX) {
				void fetchMore();
			}
		},
		[fetchMore],
	);

	const requestDeleteLibrary = useCallback((lib: EnglishLibraryListItem) => {
		setDeleteTarget(lib);
		setDeleteConfirmOpen(true);
	}, []);

	const requestEditLibrary = useCallback((lib: EnglishLibraryListItem) => {
		setVisibilityTarget(lib);
		setVisibilityOpen(true);
	}, []);

	const handleVisibilitySaved = useCallback(
		(updated: EnglishLibraryListItem) => {
			setEntries((prev) =>
				prev.map((entry) => (entry.id === updated.id ? updated : entry)),
			);
			if (selectedId === updated.id) {
				onSelectRef.current(updated);
			}
		},
		[selectedId],
	);

	const executeDeleteLibrary = useCallback(async () => {
		const target = deleteTarget;
		if (!target) {
			setDeleteConfirmOpen(false);
			return;
		}
		setDeleting(true);
		try {
			if (kind === 'vocab') {
				await deleteEnglishVocabularyLibrary(target.id);
			} else {
				await deleteEnglishClassicQuotesLibrary(target.id);
			}
			const wasSelected = selectedId === target.id;
			setEntries((prev) => {
				const next = prev.filter((e) => e.id !== target.id);
				if (wasSelected) {
					if (next.length > 0) {
						onSelectRef.current(next[0]);
					} else {
						onLibraryDeleted?.(target.id);
					}
				}
				return next;
			});
			setDeleteConfirmOpen(false);
			setDeleteTarget(null);
			Toast({
				type: 'success',
				title:
					kind === 'vocab'
						? t('englishLearning.library.deleteSuccess')
						: t('englishLearning.library.deleteSuccessClassic'),
			});
		} catch {
			// 错误由 http 层 Toast
			setDeleteConfirmOpen(false);
		} finally {
			setDeleting(false);
		}
	}, [deleteTarget, kind, onLibraryDeleted, selectedId, t]);

	const showInitialLoading = loading && entries.length === 0;
	const showEmpty = !loading && entries.length === 0 && !loadingMore;

	return (
		<div className="flex h-full min-h-0 flex-col">
			<LibraryEditDialog
				open={visibilityOpen}
				onOpenChange={(open) => {
					setVisibilityOpen(open);
					if (!open) setVisibilityTarget(null);
				}}
				kind={kind}
				library={visibilityTarget}
				onSaved={handleVisibilitySaved}
			/>
			<Confirm
				open={deleteConfirmOpen}
				onOpenChange={(open) => {
					setDeleteConfirmOpen(open);
					if (!open) setDeleteTarget(null);
				}}
				title={
					kind === 'vocab'
						? t('englishLearning.library.deleteConfirmTitle')
						: t('englishLearning.library.deleteConfirmTitleClassic')
				}
				description={
					deleteTarget
						? kind === 'vocab'
							? t('englishLearning.library.deleteConfirmDesc', {
									title: deleteTarget.title || '—',
									count: getLibraryItemCount(deleteTarget, kind),
								})
							: t('englishLearning.library.deleteConfirmDescClassic', {
									title: deleteTarget.title || '—',
									count: getLibraryItemCount(deleteTarget, kind),
								})
						: '\u00a0'
				}
				descriptionClassName="text-left"
				confirmText={t('englishLearning.library.deleteConfirmAction')}
				cancelText={t('common.cancel')}
				confirmVariant="destructive"
				closeOnConfirm={false}
				onConfirm={() => void executeDeleteLibrary()}
			/>
			<div className="h-12 flex items-center justify-between px-4 py-1">
				<div className="flex items-center gap-2">
					{kind === 'vocab'
						? t('englishLearning.library.vocab.title')
						: t('englishLearning.library.classic.title')}
					<div className="text-textcolor/50 mt-0.5 text-sm">
						{t('englishLearning.library.listCount', {
							count: entries.length,
							type: kind === 'vocab' ? t('common.type-1') : t('common.type-2'),
						})}
					</div>
				</div>
				<div
					className="flex items-center gap-1 text-teal-500 hover:text-teal-400 cursor-pointer text-sm"
					onClick={() => {
						navigate(`/english-learning/import?kind=${kind}`);
					}}
				>
					<SquareArrowRight className="size-4.5" />
					{t('englishLearning.library.goImport')}
				</div>
			</div>
			<ScrollArea className="min-h-0 flex-1 py-4" onScroll={onViewportScroll}>
				{showInitialLoading ? (
					<div className="text-textcolor/60 flex min-h-full flex-1 items-center justify-center text-center text-sm">
						<Loading text={t('englishLearning.library.listLoading')} />
					</div>
				) : (
					<div className="@container grid grid-cols-[repeat(auto-fill,minmax(min(100%,11rem),1fr))] gap-4 px-4">
						{entries.map((lib) => {
							const active = selectedId === lib.id;
							const vocabLib =
								kind === 'vocab'
									? (lib as EnglishVocabularyLibraryListItem)
									: null;
							const classicLib =
								kind === 'classic'
									? (lib as EnglishClassicQuotesLibraryListItem)
									: null;
							const itemCount = getLibraryItemCount(lib, kind);
							const showEntry = itemCount > 0;
							const canDelete = lib.isOwned !== false;
							const showEdit = lib.isPublic
								? isSuperAdmin
								: lib.isOwned !== false;
							// classic：标注 + 练习；vocab：仅练习
							const practiceActions = showEntry
								? kind === 'classic'
									? 2
									: 1
								: 0;
							const actionCount =
								practiceActions +
								(kind === 'classic' ? 1 : 0) +
								(showEdit ? 1 : 0) +
								(canDelete ? 1 : 0);
							const hoverPr =
								ROW_HOVER_PR[Math.min(actionCount, ROW_HOVER_PR.length - 1)];
							return (
								<div
									key={lib.id}
									className={cn(
										'group relative bg-theme/5 border border-theme/5 flex min-w-0 flex-col gap-1 overflow-hidden rounded-md p-2 transition-colors',
										active
											? 'border-theme/10 bg-theme/15'
											: 'hover:border-theme/12 hover:bg-theme/12',
									)}
								>
									<button
										type="button"
										onClick={() => onSelect(lib)}
										className="flex min-w-0 w-full cursor-pointer flex-col gap-1.5 text-left"
									>
										{/* 非 hover 标题占满；操作区 absolute 不占位 */}
										<div
											className={cn(
												'flex min-w-0 w-full items-center gap-1.5 pr-0',
												hoverPr,
											)}
										>
											{lib.isPublic ? (
												<span className="shrink-0 rounded bg-teal-500/15 px-1.5 py-1 text-xs font-medium leading-none text-teal-500">
													{t('englishLearning.library.publicBadge')}
												</span>
											) : null}
											<span className="text-textcolor min-w-0 truncate text-sm font-medium">
												{lib.title || '—'}
											</span>
										</div>
										<div className="text-textcolor/50 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm">
											<span>
												{kind === 'vocab'
													? t('englishLearning.vocab.historyWords', {
															count: getLibraryItemCount(lib, kind),
														})
													: t('englishLearning.classic.historyQuotes', {
															count: getLibraryItemCount(lib, kind),
														})}
											</span>
											<span className="tabular-nums">
												{formatLibraryDate(lib.createdAt)}
											</span>
										</div>
									</button>
									{actionCount > 0 ? (
										<div className={ROW_ACTIONS_CLASS}>
											{showEntry && vocabLib ? (
												<Entry
													variant="icon"
													practice={{
														source: 'library',
														libraryId: vocabLib.id,
														sourceTitle: vocabLib.title?.trim() || undefined,
														poolTotal:
															vocabLib.wordCount != null &&
															vocabLib.wordCount > 0
																? vocabLib.wordCount
																: undefined,
													}}
													className="text-textcolor/65 hover:border hover:border-teal-500/15 hover:bg-teal-500/10 hover:text-teal-500"
													onBeforeNavigate={(
														e: MouseEvent<HTMLButtonElement>,
													) => {
														e.stopPropagation();
													}}
												/>
											) : null}
											{showEntry && classicLib ? (
												<>
													<Annotate
														source="library"
														libraryId={classicLib.id}
														title={classicLib.title?.trim() || undefined}
														quoteCount={
															classicLib.quoteCount != null &&
															classicLib.quoteCount > 0
																? classicLib.quoteCount
																: undefined
														}
														onBeforeClick={(e) => {
															e.stopPropagation();
														}}
													/>
													<Entry
														variant="icon"
														practice={{
															contentKind: 'classic',
															source: 'library',
															libraryId: classicLib.id,
															sourceTitle:
																classicLib.title?.trim() || undefined,
															poolTotal:
																classicLib.quoteCount != null &&
																classicLib.quoteCount > 0
																	? classicLib.quoteCount
																	: undefined,
														}}
														className="text-textcolor/65 hover:border hover:border-teal-500/15 hover:bg-teal-500/10 hover:text-teal-500"
														onBeforeNavigate={(
															e: MouseEvent<HTMLButtonElement>,
														) => {
															e.stopPropagation();
														}}
													/>
												</>
											) : null}
											{kind === 'classic' && classicLib ? (
												<Export
													source="library"
													libraryId={classicLib.id}
													title={classicLib.title?.trim() || undefined}
													quoteCount={
														classicLib.quoteCount != null &&
														classicLib.quoteCount > 0
															? classicLib.quoteCount
															: undefined
													}
													onBeforeClick={(e) => {
														e.stopPropagation();
													}}
												/>
											) : null}
											{showEdit ? (
												<Button
													variant="ghost"
													size="sm"
													onClick={(e) => {
														e.stopPropagation();
														requestEditLibrary(lib);
													}}
													className={cn(
														'h-7 w-7 shrink-0 rounded-md p-0 transition-colors',
														'text-textcolor/65 hover:border hover:border-blue-500/15 hover:bg-blue-500/10 hover:text-blue-500',
													)}
													aria-label={
														kind === 'vocab'
															? t('englishLearning.library.editAction')
															: t('englishLearning.library.editActionClassic')
													}
												>
													<SquarePen className="size-3.5 mt-0.5" />
												</Button>
											) : null}
											{canDelete ? (
												<Button
													variant="ghost"
													size="sm"
													disabled={deleting}
													onClick={(e) => {
														e.stopPropagation();
														requestDeleteLibrary(lib);
													}}
													className={cn(
														'h-7 w-7 shrink-0 rounded-md p-0 transition-colors',
														'text-textcolor/65 hover:border hover:border-destructive/10 hover:bg-destructive/10 hover:text-destructive',
													)}
													aria-label={
														kind === 'vocab'
															? t('englishLearning.library.deleteAction')
															: t('englishLearning.library.deleteActionClassic')
													}
												>
													<Trash2 className="size-3.5" />
												</Button>
											) : null}
										</div>
									) : null}
								</div>
							);
						})}
						{loadingMore ? (
							<div className="col-span-full text-textcolor/50 flex items-center justify-center gap-1.5 py-2 text-xs">
								<Spinner className="size-3.5 text-textcolor/50" aria-hidden />
								{t('common.loadingMore')}
							</div>
						) : null}
						{showEmpty ? (
							<div className="text-textcolor/60 col-span-full flex flex-col items-center gap-3 py-8 text-center text-sm">
								<p>
									{kind === 'vocab'
										? t('englishLearning.library.listEmpty')
										: t('englishLearning.library.listEmptyClassic')}
								</p>
								<Button
									type="button"
									size="sm"
									variant="outline"
									onClick={() =>
										navigate(`/english-learning/import?kind=${kind}`)
									}
								>
									{t('englishLearning.library.goImport')}
								</Button>
							</div>
						) : null}
					</div>
				)}
			</ScrollArea>
		</div>
	);
});
