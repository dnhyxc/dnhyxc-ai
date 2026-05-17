/**
 * 资源库页：左侧已导入单词库列表（滚动分页）
 */
import Confirm from '@design/Confirm';
import Loading from '@design/Loading';
import { Button, ScrollArea, Toast } from '@ui/index';
import { Loader2, Trash2 } from 'lucide-react';
import {
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
} from '@/constant';
import { useI18n } from '@/hooks';
import { cn } from '@/lib/utils';
import {
	deleteEnglishClassicQuotesLibrary,
	deleteEnglishVocabularyLibrary,
	type EnglishClassicQuotesLibraryListItem,
	type EnglishVocabularyLibraryListItem,
	listEnglishClassicQuotesLibraries,
	listEnglishVocabularyLibraries,
} from '@/service';

export type EnglishLibraryListItem =
	| EnglishVocabularyLibraryListItem
	| EnglishClassicQuotesLibraryListItem;

function getLibraryItemCount(
	lib: EnglishLibraryListItem,
	kind: 'vocab' | 'classic',
): number {
	return kind === 'vocab'
		? (lib as EnglishVocabularyLibraryListItem).wordCount
		: (lib as EnglishClassicQuotesLibraryListItem).quoteCount;
}

export type VocabularyLibraryListPanelProps = {
	kind: 'vocab' | 'classic';
	selectedId: string | null;
	initialLibraryId?: string | null;
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

export function VocabularyLibraryListPanel({
	kind,
	selectedId,
	initialLibraryId,
	onSelect,
	onLibraryDeleted,
}: VocabularyLibraryListPanelProps) {
	const { t } = useI18n();
	const navigate = useNavigate();

	const [entries, setEntries] = useState<EnglishLibraryListItem[]>([]);
	const [loading, setLoading] = useState(false);
	const [loadingMore, setLoadingMore] = useState(false);
	const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
	const [deleteTarget, setDeleteTarget] =
		useState<EnglishLibraryListItem | null>(null);
	const [deleting, setDeleting] = useState(false);
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
			const list = Array.isArray(res.data) ? res.data : [];
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
			const chunk = Array.isArray(res.data) ? res.data : [];
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
			<div className="flex items-center justify-between px-4.5 pt-3.5">
				<div className="flex flex-col">
					<h2 className="text-textcolor text-base font-semibold">
						{kind === 'vocab'
							? t('englishLearning.library.vocab.title')
							: t('englishLearning.library.classic.title')}
					</h2>
					<p className="text-textcolor/50 mt-0.5 text-xs">
						{t('englishLearning.library.listHint')}
					</p>
				</div>
				<div className="flex items-center gap-1.5 mt-1">
					<Button
						variant="link"
						className="border border-theme/15 bg-theme/10 hover:border-theme/15 hover:bg-theme/15"
						onClick={() => {
							navigate(`/english-learning/import?kind=${kind}`);
						}}
					>
						{t('englishLearning.library.goImport')}
					</Button>
				</div>
			</div>
			<ScrollArea className="min-h-0 flex-1 py-4" onScroll={onViewportScroll}>
				{showInitialLoading ? (
					<div className="text-textcolor/60 flex min-h-full flex-1 items-center justify-center text-center text-sm">
						<Loading text={t('englishLearning.library.listLoading')} />
					</div>
				) : (
					<div className="flex flex-col gap-4 px-4">
						{entries.map((lib) => {
							const active = selectedId === lib.id;
							return (
								<div
									key={lib.id}
									className={cn(
										'group bg-theme/5 border border-theme/10 flex w-full items-stretch gap-1 overflow-hidden rounded-md transition-colors',
										active
											? 'border-theme/15 bg-theme/15'
											: 'hover:border-theme/12 hover:bg-theme/12',
									)}
								>
									<button
										type="button"
										onClick={() => onSelect(lib)}
										className="flex min-w-0 flex-1 cursor-pointer flex-col gap-1.5 px-3 py-2 text-left"
									>
										<div className="text-textcolor line-clamp-2 text-sm font-medium leading-snug">
											{lib.title || '—'}
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
									<Button
										type="button"
										variant="ghost"
										size="sm"
										disabled={deleting}
										onClick={() => requestDeleteLibrary(lib)}
										className={cn(
											'group-hover:flex hidden mt-1 mr-1 h-7 w-7 shrink-0 rounded-md p-0 transition-colors',
											'text-textcolor/55 hover:border hover:border-destructive/10 hover:bg-destructive/10 hover:text-destructive',
										)}
										aria-label={
											kind === 'vocab'
												? t('englishLearning.library.deleteAction')
												: t('englishLearning.library.deleteActionClassic')
										}
									>
										<Trash2 className="size-3.5" />
									</Button>
								</div>
							);
						})}
						{loadingMore ? (
							<div className="text-textcolor/50 flex items-center justify-center gap-1.5 py-2 text-xs">
								<Loader2 className="size-3.5 animate-spin" aria-hidden />
								{t('common.loadingMore')}
							</div>
						) : null}
						{showEmpty ? (
							<div className="text-textcolor/60 flex flex-col items-center gap-3 py-8 text-center text-sm">
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
}
