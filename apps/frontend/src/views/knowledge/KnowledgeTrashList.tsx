import Confirm from '@design/Confirm';
import { Drawer } from '@design/Drawer';
import Loading from '@design/Loading';
import { Button, Checkbox, ScrollArea, Toast } from '@ui/index';
import { Trash2 } from 'lucide-react';
import { observer } from 'mobx-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import {
	deleteKnowledgeTrash,
	deleteKnowledgeTrashBatch,
	getKnowledgeTrashDetail,
} from '@/service';
import useStore from '@/store';
import type { KnowledgeTrashListItem } from '@/types';
import { formatDate } from '@/utils';

interface Props {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	/** 点击某条后回填编辑器（含回收站行 id，供助手会话与列表草稿区分） */
	onPick?: (record: {
		title: string | null;
		content: string;
		trashItemId: string;
	}) => void | Promise<void>;
}

function TrashRow(props: {
	item: KnowledgeTrashListItem;
	checked: boolean;
	/** 当前预览（回填到编辑器）的条目：选中态需与知识库列表一致 */
	selected: boolean;
	onToggleChecked: (id: string) => void;
	onActivate: (item: KnowledgeTrashListItem) => void | Promise<void>;
	onDeleteClick: (e: React.MouseEvent, item: KnowledgeTrashListItem) => void;
}) {
	const {
		item,
		checked,
		selected,
		onToggleChecked,
		onActivate,
		onDeleteClick,
	} = props;
	const onKeyDown = (e: React.KeyboardEvent) => {
		if (e.key === 'Enter') {
			e.preventDefault();
			void onActivate(item);
		}
		if (e.key === ' ') {
			e.preventDefault();
			onToggleChecked(item.id);
		}
	};
	return (
		<div
			role="button"
			tabIndex={0}
			aria-current={selected ? 'true' : undefined}
			onKeyDown={onKeyDown}
			onClick={() => void onActivate(item)}
			className={cn(
				'w-full cursor-pointer overflow-hidden flex flex-col gap-1 p-2 rounded-md group transition-colors',
				// 与知识库列表一致：当前预览项使用相同的选中底色
				selected
					? 'bg-theme/15'
					: checked
						? 'bg-theme/10'
						: 'hover:bg-theme/10',
			)}
		>
			<div className="flex items-start justify-between gap-2 min-w-0 w-full">
				<div className="flex min-w-0 flex-1 items-start gap-2">
					<Checkbox
						checked={checked}
						aria-label={checked ? '取消选择' : '选择'}
						className="mt-0.5 cursor-pointer"
						onClick={(e) => {
							e.stopPropagation();
						}}
						onCheckedChange={() => onToggleChecked(item.id)}
					/>
					<div className="flow-root -mt-0.5 flex-1 min-w-0 max-w-full font-medium wrap-anywhere">
						{item.title?.trim() || '未命名'}
					</div>
				</div>
				<button
					type="button"
					aria-label="从回收站彻底删除"
					className={cn(
						'cursor-pointer shrink-0 p-1 rounded-md text-textcolor/80 transition-opacity duration-150',
						'opacity-0 pointer-events-none',
						'hover:text-destructive hover:bg-destructive/10',
						'group-hover:opacity-100 group-hover:pointer-events-auto',
					)}
					onClick={(e) => onDeleteClick(e, item)}
				>
					<Trash2 size={16} className="-mt-0.5" />
				</button>
			</div>
			<div className="text-xs text-textcolor/50 space-y-0.5">
				删除 {formatDate(item.deletedAt?.toString() ?? '')}
			</div>
		</div>
	);
}

const KnowledgeTrashList: React.FC<Props> = observer(
	({ open, onOpenChange, onPick }) => {
		const { knowledgeStore } = useStore();
		const [selection, setSelection] = useState<Record<string, boolean>>({});
		const [deleting, setDeleting] = useState(false);
		const [loadingDetailId, setLoadingDetailId] = useState<string | null>(null);
		const [confirmOpen, setConfirmOpen] = useState(false);
		const [pendingDeleteIds, setPendingDeleteIds] = useState<string[]>([]);
		const [pendingDeleteLabel, setPendingDeleteLabel] = useState('');

		useEffect(() => {
			if (!open) return;
			void knowledgeStore.refreshTrashList();
			setSelection({});
		}, [open, knowledgeStore]);

		const { trashList, trashLoading, trashLoadingMore } = knowledgeStore;
		const selectedIds = useMemo(
			() => Object.keys(selection).filter((id) => selection[id]),
			[selection],
		);
		const allChecked =
			trashList.length > 0 && selectedIds.length === trashList.length;
		const someChecked =
			selectedIds.length > 0 && selectedIds.length < trashList.length;

		const toggleChecked = useCallback((id: string) => {
			setSelection((prev) => ({ ...prev, [id]: !prev[id] }));
		}, []);

		const toggleAll = useCallback(() => {
			setSelection((prev) => {
				if (allChecked) return {};
				const next: Record<string, boolean> = { ...prev };
				for (const x of trashList) next[x.id] = true;
				return next;
			});
		}, [allChecked, trashList]);

		const doDeleteSingle = useCallback(
			async (item: KnowledgeTrashListItem) => {
				setDeleting(true);
				try {
					const res = await deleteKnowledgeTrash(item.id);
					if (!res.success) {
						Toast({
							type: 'error',
							title: '删除失败',
							message: res.message || '请稍后重试',
						});
						return;
					}
					knowledgeStore.removeTrashFromLocalList([item.id]);
					setSelection((prev) => {
						const next = { ...prev };
						delete next[item.id];
						return next;
					});
					Toast({ type: 'success', title: '已从回收站删除' });
				} finally {
					setDeleting(false);
				}
			},
			[knowledgeStore],
		);

		const onDeleteClick = useCallback(
			(e: React.MouseEvent, item: KnowledgeTrashListItem) => {
				e.stopPropagation();
				setPendingDeleteIds([item.id]);
				setPendingDeleteLabel(item.title?.trim() || '未命名');
				setConfirmOpen(true);
			},
			[],
		);

		const onActivateRow = useCallback(
			async (item: KnowledgeTrashListItem) => {
				setLoadingDetailId(item.id);
				try {
					const res = await getKnowledgeTrashDetail(item.id);
					if (!res.success || !res.data) {
						Toast({
							type: 'error',
							title: '加载失败',
							message: res.message || '无法获取该条回收站详情',
						});
						return;
					}
					await onPick?.({
						title: res.data.title ?? null,
						content: res.data.content ?? '',
						trashItemId: item.id,
					});
					onOpenChange(false);
				} finally {
					setLoadingDetailId(null);
				}
			},
			[onOpenChange, onPick],
		);

		const onBatchDeleteClick = useCallback(() => {
			if (selectedIds.length === 0) return;
			setPendingDeleteIds(selectedIds);
			setPendingDeleteLabel(`已选 ${selectedIds.length} 条`);
			setConfirmOpen(true);
		}, [selectedIds]);

		const onConfirmDelete = useCallback(async () => {
			const ids = pendingDeleteIds;
			if (ids.length === 0) return;
			setDeleting(true);
			try {
				if (ids.length === 1) {
					const id = ids[0]!;
					const item = trashList.find((x) => x.id === id);
					if (item) {
						await doDeleteSingle(item);
					} else {
						const res = await deleteKnowledgeTrash(id);
						if (!res.success) {
							Toast({
								type: 'error',
								title: '删除失败',
								message: res.message || '请稍后重试',
							});
							return;
						}
						knowledgeStore.removeTrashFromLocalList([id]);
						setSelection((prev) => {
							const next = { ...prev };
							delete next[id];
							return next;
						});
						Toast({ type: 'success', title: '已从回收站删除' });
					}
				} else {
					const res = await deleteKnowledgeTrashBatch(ids);
					if (!res.success) {
						Toast({
							type: 'error',
							title: '批量删除失败',
							message: res.message || '请稍后重试',
						});
						return;
					}
					knowledgeStore.removeTrashFromLocalList(ids);
					setSelection({});
					Toast({
						type: 'success',
						title: '批量删除完成',
						message: `已删除 ${res.data?.affected ?? 0} 条`,
					});
				}
				// 删除后直接重拉列表，保证分页/total 与服务端一致（避免本地减 total 造成边界问题）
				void knowledgeStore.refreshTrashList();
				setConfirmOpen(false);
				setPendingDeleteIds([]);
				setPendingDeleteLabel('');
			} finally {
				setDeleting(false);
			}
		}, [doDeleteSingle, knowledgeStore, pendingDeleteIds, trashList]);

		const showInitialPlaceholder = trashLoading && trashList.length === 0;
		const showEmptyHint =
			!trashLoading && trashList.length === 0 && !trashLoadingMore;

		return (
			<>
				<Confirm
					open={confirmOpen}
					onOpenChange={(v) => {
						setConfirmOpen(v);
						if (!v) {
							setPendingDeleteIds([]);
							setPendingDeleteLabel('');
						}
					}}
					title={
						pendingDeleteIds.length > 1
							? '批量删除回收站文件？'
							: '删除回收站文件？'
					}
					description={
						<>
							该操作将从回收站中彻底删除，无法恢复。
							<div className="mt-2 font-medium text-base wrap-anywhere">
								{pendingDeleteIds.length > 1
									? `数量：${pendingDeleteIds.length}`
									: `文件名称：「${pendingDeleteLabel || '未命名'}」`}
							</div>
						</>
					}
					descriptionClassName="text-left"
					confirmText="删除"
					confirmVariant="destructive"
					cancelText="取消"
					closeOnConfirm={false}
					confirmOnEnter
					onConfirm={() => void onConfirmDelete()}
				/>

				<Drawer
					title="回收站"
					bodyClassName="pt-2 pb-4"
					open={open}
					onOpenChange={onOpenChange}
				>
					<div className="flex h-full min-h-0 flex-col">
						<div className="flex items-center justify-between gap-2 pl-0.5 pr-4">
							<div className="flex items-center gap-2 text-sm text-textcolor/70">
								<div
									role="button"
									tabIndex={0}
									className="cursor-pointer flex items-center gap-2 rounded-md px-2 py-1 hover:bg-theme/10"
									onClick={toggleAll}
									onKeyDown={(e) => {
										if (e.key === 'Enter' || e.key === ' ') {
											e.preventDefault();
											toggleAll();
										}
									}}
								>
									<Checkbox
										checked={
											allChecked ? true : someChecked ? 'indeterminate' : false
										}
										aria-label="全选"
										onClick={(e) => e.stopPropagation()}
										onCheckedChange={() => toggleAll()}
									/>
									<span
										className={
											allChecked ? 'text-textcolor' : 'text-textcolor/70'
										}
									>
										全选
									</span>
								</div>
								<span className="text-xs text-textcolor/50">
									已选 {selectedIds.length} / {trashList.length}
								</span>
							</div>
							<Button
								variant="link"
								className={cn(
									'lucide-stroke-draw-hover flex items-center gap-1 px-0 has-[>svg]:px-0',
									selectedIds.length === 0
										? 'opacity-50 pointer-events-none'
										: '',
								)}
								onClick={onBatchDeleteClick}
								disabled={deleting || selectedIds.length === 0}
								aria-busy={deleting}
							>
								<Trash2 className="mt-0.5" />
								<span className="mt-0.5">批量删除</span>
							</Button>
						</div>

						<ScrollArea
							className="flex min-h-0 flex-1 flex-col pr-1.5 box-border"
							onScroll={knowledgeStore.onTrashListViewportScroll}
						>
							<div className="flex min-h-0 w-full flex-1 flex-col gap-2">
								{showInitialPlaceholder ? (
									<div className="flex flex-1 flex-col items-center justify-center py-6 text-center text-sm text-textcolor/60">
										<Loading text="加载中…" />
									</div>
								) : null}
								{trashList.map((item) => (
									<TrashRow
										key={item.id}
										item={item}
										checked={Boolean(selection[item.id])}
										selected={
											knowledgeStore.knowledgeTrashPreviewId != null &&
											knowledgeStore.knowledgeTrashPreviewId === item.id
										}
										onToggleChecked={toggleChecked}
										onActivate={onActivateRow}
										onDeleteClick={onDeleteClick}
									/>
								))}
								{loadingDetailId ? (
									<div className="text-xs text-textcolor/50 py-1 text-center">
										正在加载…
									</div>
								) : null}
								{trashLoadingMore ? (
									<div className="text-xs text-textcolor/50 py-2 text-center">
										加载更多…
									</div>
								) : null}
								{showEmptyHint ? (
									<div className="text-sm text-textcolor/60 py-8 text-center">
										回收站暂无内容
									</div>
								) : null}
							</div>
						</ScrollArea>
					</div>
				</Drawer>
			</>
		);
	},
);

export default KnowledgeTrashList;
