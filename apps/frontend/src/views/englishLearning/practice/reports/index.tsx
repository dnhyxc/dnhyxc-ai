/**
 * 练习报告列表（单词 / 语句切换；多选 / 单删对齐错题集）
 */
import Confirm from '@design/Confirm';
import Loading from '@design/Loading';
import { Checkbox } from '@ui/checkbox';
import { Button, Toast } from '@ui/index';
import { Label } from '@ui/label';
import { Spinner } from '@ui/spinner';
import { Trash2 } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { useI18n } from '@/hooks';
import { cn } from '@/lib/utils';
import {
	type EnglishPracticeReportListEntry,
	listEnglishPracticeReports,
	removeEnglishPracticeReportsBatch,
} from '@/service';
import { formatDate } from '@/utils';
import {
	type MistakesKind,
	MistakesKindTabs,
} from '../../mistakes/components/MistakesKindTabs';
import { PracticePageShell } from '../components/shell';

const PAGE_SIZE = 20;

const LINK_CLASS =
	'flex shrink-0 cursor-pointer items-center gap-1.5 whitespace-nowrap text-sm font-medium text-teal-500 hover:text-teal-400 disabled:cursor-not-allowed disabled:opacity-50';

function parseKind(raw: string | null): MistakesKind {
	return raw === 'classic' ? 'classic' : 'vocab';
}

function reportsPagePath(kind: MistakesKind): string {
	return kind === 'classic'
		? '/english-learning/practice/reports?kind=classic'
		: '/english-learning/practice/reports?kind=vocab';
}

function formatReportMeta(
	entry: EnglishPracticeReportListEntry,
	pctLabel: string,
): string {
	const pct =
		entry.totalCount > 0
			? Math.round((entry.correctCount / entry.totalCount) * 100)
			: 0;
	return `${entry.correctCount}/${entry.totalCount} · ${pct}${pctLabel} · ${formatDate(entry.createdAt)}`;
}

export default function PracticeReportsListPage() {
	const { t } = useI18n();
	const navigate = useNavigate();
	const [searchParams] = useSearchParams();
	const kind = useMemo(
		() => parseKind(searchParams.get('kind')),
		[searchParams],
	);

	const [items, setItems] = useState<EnglishPracticeReportListEntry[]>([]);
	const [totalCount, setTotalCount] = useState(0);
	const [loading, setLoading] = useState(true);
	const [loadingMore, setLoadingMore] = useState(false);
	const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
	const [batchRemoving, setBatchRemoving] = useState(false);
	const [removeConfirmOpen, setRemoveConfirmOpen] = useState(false);
	const [singleRemoveConfirmOpen, setSingleRemoveConfirmOpen] = useState(false);
	const [singleRemoveTarget, setSingleRemoveTarget] =
		useState<EnglishPracticeReportListEntry | null>(null);

	const load = useCallback(
		async (offset: number, append: boolean) => {
			if (append) setLoadingMore(true);
			else setLoading(true);
			try {
				const res = await listEnglishPracticeReports({
					contentKind: kind,
					limit: PAGE_SIZE,
					offset,
					silent: true,
				});
				const next = res.data?.items ?? [];
				const total = res.data?.totalCount ?? 0;
				setTotalCount(total);
				setItems((prev) => (append ? [...prev, ...next] : next));
			} catch {
				Toast({
					type: 'warning',
					title: t('englishLearning.practice.reportsLoadFailed'),
				});
			} finally {
				setLoading(false);
				setLoadingMore(false);
			}
		},
		[kind, t],
	);

	useEffect(() => {
		setItems([]);
		setTotalCount(0);
		setSelectedIds(new Set());
		void load(0, false);
	}, [load]);

	const itemIdSet = useMemo(() => new Set(items.map((e) => e.id)), [items]);
	useEffect(() => {
		setSelectedIds((prev) => {
			if (prev.size === 0) return prev;
			const next = new Set<string>();
			for (const id of prev) {
				if (itemIdSet.has(id)) next.add(id);
			}
			return next.size === prev.size ? prev : next;
		});
	}, [itemIdSet]);

	const allLoadedSelected =
		items.length > 0 && items.every((e) => selectedIds.has(e.id));
	const someLoadedSelected = items.some((e) => selectedIds.has(e.id));
	const selectAllCheckboxState: boolean | 'indeterminate' = allLoadedSelected
		? true
		: someLoadedSelected
			? 'indeterminate'
			: false;
	const selectionDisabled = batchRemoving || loading;
	const removeDisabled =
		batchRemoving || selectedIds.size === 0 || items.length === 0;

	const toggleSelectAllLoaded = useCallback(
		(checked: boolean | 'indeterminate') => {
			if (checked === true) {
				setSelectedIds(new Set(items.map((e) => e.id)));
				return;
			}
			setSelectedIds(new Set());
		},
		[items],
	);

	const toggleRowSelected = useCallback((id: string, checked: boolean) => {
		setSelectedIds((prev) => {
			const next = new Set(prev);
			if (checked) next.add(id);
			else next.delete(id);
			return next;
		});
	}, []);

	const requestRemoveConfirm = useCallback(() => {
		if (selectedIds.size === 0) {
			Toast({
				type: 'info',
				title: t('englishLearning.practice.reportsRemoveNoneHint'),
			});
			return;
		}
		setSingleRemoveConfirmOpen(false);
		setSingleRemoveTarget(null);
		setRemoveConfirmOpen(true);
	}, [selectedIds, t]);

	const requestSingleRemove = useCallback(
		(entry: EnglishPracticeReportListEntry) => {
			setRemoveConfirmOpen(false);
			setSingleRemoveTarget(entry);
			setSingleRemoveConfirmOpen(true);
		},
		[],
	);

	const executeRemoveConfirm = useCallback(async () => {
		const ids = items.filter((e) => selectedIds.has(e.id)).map((e) => e.id);
		if (ids.length === 0) {
			setRemoveConfirmOpen(false);
			return;
		}
		setBatchRemoving(true);
		try {
			await removeEnglishPracticeReportsBatch(ids);
			setSelectedIds(new Set());
			setRemoveConfirmOpen(false);
			await load(0, false);
			Toast({
				type: 'success',
				title: t('englishLearning.practice.reportsRemoveBatchSuccess'),
			});
		} catch (e) {
			Toast({
				type: 'error',
				title:
					e instanceof Error
						? e.message
						: t('englishLearning.practice.reportsRemoveFail'),
			});
			setRemoveConfirmOpen(false);
		} finally {
			setBatchRemoving(false);
		}
	}, [items, load, selectedIds, t]);

	const executeSingleRemoveConfirm = useCallback(async () => {
		const target = singleRemoveTarget;
		if (!target) {
			setSingleRemoveConfirmOpen(false);
			return;
		}
		setBatchRemoving(true);
		try {
			await removeEnglishPracticeReportsBatch([target.id]);
			setSelectedIds((prev) => {
				const next = new Set(prev);
				next.delete(target.id);
				return next;
			});
			setSingleRemoveTarget(null);
			setSingleRemoveConfirmOpen(false);
			await load(0, false);
			Toast({
				type: 'success',
				title: t('englishLearning.practice.reportsRemoveSuccess'),
			});
		} catch (e) {
			Toast({
				type: 'error',
				title:
					e instanceof Error
						? e.message
						: t('englishLearning.practice.reportsRemoveFail'),
			});
			setSingleRemoveConfirmOpen(false);
		} finally {
			setBatchRemoving(false);
		}
	}, [load, singleRemoveTarget, t]);

	const onSelectKind = useCallback(
		(next: MistakesKind) => {
			navigate(reportsPagePath(next), { replace: true });
		},
		[navigate],
	);

	const title =
		kind === 'vocab'
			? t('englishLearning.practice.reportsVocabNav')
			: t('englishLearning.practice.reportsClassicNav');
	const hasMore = items.length < totalCount;
	const showSelection = !loading && items.length > 0;

	return (
		<>
			<Confirm
				open={removeConfirmOpen}
				onOpenChange={setRemoveConfirmOpen}
				title={t('englishLearning.practice.reportsRemoveBatchConfirmTitle')}
				description={t(
					'englishLearning.practice.reportsRemoveBatchConfirmDesc',
					{ count: selectedIds.size },
				)}
				descriptionClassName="text-left"
				confirmText={t('englishLearning.practice.reportsRemoveConfirmAction')}
				cancelText={t('common.cancel')}
				confirmVariant="destructive"
				closeOnConfirm={false}
				onConfirm={() => void executeRemoveConfirm()}
			/>
			<Confirm
				open={singleRemoveConfirmOpen}
				onOpenChange={(open) => {
					setSingleRemoveConfirmOpen(open);
					if (!open) setSingleRemoveTarget(null);
				}}
				title={t('englishLearning.practice.reportsRemoveConfirmTitle')}
				description={
					singleRemoveTarget
						? t('englishLearning.practice.reportsRemoveConfirmDesc', {
								title: singleRemoveTarget.title,
							})
						: '\u00a0'
				}
				descriptionClassName="text-left"
				confirmText={t('englishLearning.practice.reportsRemoveConfirmAction')}
				cancelText={t('common.cancel')}
				confirmVariant="destructive"
				closeOnConfirm={false}
				onConfirm={() => void executeSingleRemoveConfirm()}
			/>
			<PracticePageShell
				title={<span className="min-w-0 truncate">{title}</span>}
				contentLayout="fill"
				headerRight={
					<div className="flex min-w-0 flex-wrap items-center justify-end gap-3">
						{showSelection ? (
							<div className="flex shrink-0 items-center gap-2">
								<Checkbox
									id="practice-reports-select-all"
									checked={selectAllCheckboxState}
									disabled={selectionDisabled}
									onCheckedChange={(v) => toggleSelectAllLoaded(v)}
								/>
								<Label
									htmlFor="practice-reports-select-all"
									className="cursor-pointer text-sm font-medium whitespace-nowrap text-teal-500 hover:text-teal-400"
								>
									{t('englishLearning.practice.reportsSelectAll')}
								</Label>
							</div>
						) : null}
						{showSelection ? (
							<button
								type="button"
								disabled={removeDisabled}
								className={LINK_CLASS}
								onClick={requestRemoveConfirm}
							>
								{batchRemoving ? (
									<Spinner className="size-4 shrink-0 text-teal-500" />
								) : (
									<Trash2 className="size-4 shrink-0 opacity-90" aria-hidden />
								)}
								<span>
									{batchRemoving
										? t('englishLearning.practice.reportsRemoving')
										: t('englishLearning.practice.reportsRemoveSelected', {
												count: selectedIds.size,
											})}
								</span>
							</button>
						) : null}
						<MistakesKindTabs
							kind={kind}
							onSelectKind={onSelectKind}
							vocabLabel={t('englishLearning.practice.reportsVocabNav')}
							classicLabel={t('englishLearning.practice.reportsClassicNav')}
							ariaLabel={t('route.englishLearning.practice.reportsTitle')}
						/>
					</div>
				}
			>
				{loading && items.length === 0 ? (
					<div className="flex flex-1 items-center justify-center py-16">
						<Loading />
					</div>
				) : items.length === 0 ? (
					<p className="text-textcolor/55 py-16 text-center text-sm">
						{t('englishLearning.practice.reportsEmpty')}
					</p>
				) : (
					<div className="flex w-full flex-col gap-2">
						<div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,18rem),1fr))] gap-4">
							{items.map((entry) => {
								const checked = selectedIds.has(entry.id);
								const controlId = `practice-report-${entry.id}`;
								return (
									<div
										key={entry.id}
										className={cn(
											'border-theme/10 bg-theme/5 hover:border-teal-500/35 hover:bg-teal-500/10 flex min-w-0 items-start gap-2 rounded-md border px-3 py-3 transition-colors',
											checked && 'border-teal-500/40 bg-teal-500/10',
										)}
									>
										<Checkbox
											id={controlId}
											checked={checked}
											disabled={selectionDisabled}
											className="mt-1 shrink-0"
											aria-label={`${t('englishLearning.practice.reportsToggleRow')}: ${entry.title}`}
											onCheckedChange={(v) =>
												toggleRowSelected(entry.id, v === true)
											}
											onClick={(e) => e.stopPropagation()}
										/>
										<button
											type="button"
											className="flex min-w-0 flex-1 flex-col gap-1 text-left"
											onClick={() =>
												navigate(
													`/english-learning/practice/reports/${entry.id}?kind=${kind}&title=${encodeURIComponent(entry.title)}`,
												)
											}
										>
											<span className="text-textcolor truncate text-sm font-semibold sm:text-base">
												{entry.title}
											</span>
											<span className="text-textcolor/50 text-xs tabular-nums sm:text-sm">
												{formatReportMeta(
													entry,
													t('englishLearning.practice.reportsPctSuffix'),
												)}
											</span>
										</button>
										<Button
											type="button"
											variant="ghost"
											size="sm"
											disabled={selectionDisabled}
											onClick={() => requestSingleRemove(entry)}
											className={cn(
												'h-7 w-7 shrink-0 rounded-md border p-2 transition-colors',
												'border-theme/10 text-textcolor/60 hover:border-destructive/35 hover:bg-destructive/10 hover:text-destructive',
											)}
											aria-label={t(
												'englishLearning.practice.reportsRemoveAction',
											)}
										>
											<Trash2 className="size-3.5" />
										</Button>
									</div>
								);
							})}
						</div>
						{hasMore ? (
							<Button
								type="button"
								variant="ghost"
								disabled={loadingMore}
								className="border-theme/10 text-textcolor/70 mt-2 h-10 border"
								onClick={() => void load(items.length, true)}
							>
								{loadingMore
									? t('englishLearning.practice.reportsLoadingMore')
									: t('englishLearning.practice.reportsLoadMore')}
							</Button>
						) : null}
					</div>
				)}
			</PracticePageShell>
		</>
	);
}
