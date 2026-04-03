import Confirm from '@design/Confirm';
import { Drawer } from '@design/Drawer';
import { ScrollArea } from '@ui/index';
import { Toast } from '@ui/sonner';
import { Trash2 } from 'lucide-react';
import { observer } from 'mobx-react';
import { useCallback, useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { deleteKnowledge } from '@/service';
import useStore from '@/store';
import type { KnowledgeListItem, KnowledgeRecord } from '@/types';
import { formatDate, isTauriRuntime } from '@/utils';
import {
	formatTauriInvokeError,
	invokeDeleteKnowledgeMarkdown,
	invokeResolveKnowledgeMarkdownTarget,
} from '@/utils/knowledge-save';
import { TAURI_KNOWLEDGE_DIR } from './constants';

interface IProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	/** 选中一条并拉取详情后回调，用于回填编辑器 */
	onPick?: (record: KnowledgeRecord) => void | Promise<void>;
	/** 当前编辑区标题（Tauri 下用于「删除本地文件」） */
	currentTitle?: string;
	/** 本地文件删除成功；参数为被删条目的 id，由调用方决定是否清空编辑器 */
	onAfterLocalDelete?: (deletedKnowledgeId: string) => void;
	/** 数据库记录删除成功后回调（用于当前正在编辑的条目被删时清空编辑器） */
	onDeletedRecord?: (id: string) => void;
	/** 当前在编辑器中打开的条目 id，用于列表行高亮 */
	editingKnowledgeId?: string | null;
}

/** 单行：点击打开详情；垃圾桶仅触发删除流程（冒泡已阻止） */
function KnowledgeListRow(props: {
	item: KnowledgeListItem;
	selected: boolean;
	onActivate: (item: KnowledgeListItem) => void;
	onTrashClick: (e: React.MouseEvent, item: KnowledgeListItem) => void;
}) {
	const { item, selected, onActivate, onTrashClick } = props;

	const onKeyDown = (e: React.KeyboardEvent) => {
		if (e.key === 'Enter' || e.key === ' ') {
			e.preventDefault();
			void onActivate(item);
		}
	};

	return (
		<div
			role="button"
			tabIndex={0}
			aria-current={selected ? 'true' : undefined}
			onClick={() => void onActivate(item)}
			onKeyDown={onKeyDown}
			className={cn(
				'w-full cursor-pointer overflow-hidden flex flex-col gap-1 p-2 rounded-md group transition-colors',
				selected ? 'bg-theme/15' : 'hover:bg-theme/10',
			)}
		>
			<div className="flex items-start justify-between gap-2 min-w-0 w-full">
				<div className="flow-root flex-1 min-w-0 max-w-full font-medium wrap-anywhere">
					{item.title?.trim() || '未命名'}
				</div>
				<button
					type="button"
					aria-label="从知识库删除"
					className={cn(
						'cursor-pointer shrink-0 p-1 rounded-md text-textcolor/50 transition-opacity duration-150',
						'opacity-0 pointer-events-none',
						'hover:text-destructive hover:bg-destructive/10',
						/* 仅 hover 显示：勿用 focus-within，否则抽屉打开时焦点落在首行会导致第一个删除钮常显 */
						'group-hover:opacity-100 group-hover:pointer-events-auto',
					)}
					onClick={(e) => onTrashClick(e, item)}
				>
					<Trash2 size={16} />
				</button>
			</div>
			<div className="text-xs text-textcolor/50">
				更新 {formatDate(item.updatedAt?.toString() ?? '')}
			</div>
		</div>
	);
}

const KnowledgeList: React.FC<IProps> = observer(
	({
		open,
		onOpenChange,
		onPick,
		currentTitle: _currentTitle = '',
		onAfterLocalDelete,
		onDeletedRecord,
		editingKnowledgeId = null,
	}) => {
		const { knowledgeStore } = useStore();

		const [deleteLocalOpen, setDeleteLocalOpen] = useState(false);
		const [deleteLocalPath, setDeleteLocalPath] = useState('');
		/** 本地无文件或非 Tauri：仅删除数据库记录 */
		const [deleteRecordOnlyOpen, setDeleteRecordOnlyOpen] = useState(false);
		const [selectKnowledge, setSelectKnowledge] =
			useState<KnowledgeListItem | null>(null);

		useEffect(() => {
			if (open) {
				void knowledgeStore.refreshList();
			}
		}, [open, knowledgeStore]);

		const handleRowClick = useCallback(
			async (item: KnowledgeListItem) => {
				const detail = await knowledgeStore.fetchDetail(item.id);
				if (!detail) {
					Toast({
						type: 'error',
						title: '加载失败',
						message: '无法获取该条详情',
					});
					return;
				}
				await onPick?.(detail);
				onOpenChange(false);
			},
			[knowledgeStore, onPick, onOpenChange],
		);

		const handleDeleteApi = useCallback(
			async (item: KnowledgeListItem): Promise<boolean> => {
				const res = await deleteKnowledge(item.id);
				if (!res.success) {
					Toast({
						type: 'error',
						title: '删除失败',
						message: res.message || '请稍后重试',
					});
					return false;
				}
				knowledgeStore.removeFromLocalList(item.id);
				onDeletedRecord?.(item.id);
				return true;
			},
			[knowledgeStore, onDeletedRecord],
		);

		/**
		 * 桌面端：有本地 Markdown 则弹「删本地+库」；无本地则弹「仅删数据库」。
		 * 浏览器：仅弹「删数据库」。
		 */
		const openDeleteFlow = useCallback(async (knowledge: KnowledgeListItem) => {
			if (!isTauriRuntime()) {
				setDeleteRecordOnlyOpen(true);
				return;
			}
			try {
				const target = await invokeResolveKnowledgeMarkdownTarget({
					title: knowledge.title ?? '',
					content: '',
					filePath: TAURI_KNOWLEDGE_DIR,
				});
				if (!target.exists) {
					setDeleteRecordOnlyOpen(true);
					return;
				}
				setDeleteLocalPath(target.path);
				setDeleteLocalOpen(true);
			} catch (e) {
				Toast({
					type: 'error',
					title: formatTauriInvokeError(e),
				});
			}
		}, []);

		/** 确认删除：先删数据库记录（若有选中项），再删本地 Markdown */
		const onConfirmDeleteLocal = useCallback(async () => {
			try {
				if (selectKnowledge) {
					const dbOk = await handleDeleteApi(selectKnowledge);
					if (!dbOk) return;
				}
				const result = await invokeDeleteKnowledgeMarkdown({
					title: selectKnowledge?.title ?? '',
					filePath: TAURI_KNOWLEDGE_DIR,
				});
				if (result.success === 'success') {
					Toast({
						type: 'success',
						title: '文件已删除',
						message: result.filePath ? `${result.filePath}` : undefined,
					});
					setDeleteLocalOpen(false);
					setDeleteLocalPath('');
					onAfterLocalDelete?.(selectKnowledge?.id ?? '');
					setSelectKnowledge(null);
				} else {
					Toast({
						type: 'error',
						title: '删除失败',
						message: result.message,
					});
				}
			} catch (e) {
				Toast({
					type: 'error',
					title: formatTauriInvokeError(e),
				});
			}
		}, [handleDeleteApi, onAfterLocalDelete, selectKnowledge]);

		const onConfirmDeleteRecordOnly = useCallback(async () => {
			if (!selectKnowledge) return;
			const ok = await handleDeleteApi(selectKnowledge);
			if (ok) {
				setDeleteRecordOnlyOpen(false);
				setSelectKnowledge(null);
			}
		}, [handleDeleteApi, selectKnowledge]);

		const onTrashClick = useCallback(
			async (e: React.MouseEvent, knowledge: KnowledgeListItem) => {
				e.stopPropagation();
				setSelectKnowledge(knowledge);
				await openDeleteFlow(knowledge);
			},
			[openDeleteFlow],
		);

		const deleteLocalFileName =
			deleteLocalPath.split(/[/\\]/).filter(Boolean).pop() ?? deleteLocalPath;

		const { loading, loadingMore, list } = knowledgeStore;
		const showInitialPlaceholder = loading && list.length === 0;
		const showLoadMoreHint = loadingMore;
		const showEmptyHint = !loading && list.length === 0 && !loadingMore;

		const deleteRecordTitle = selectKnowledge?.title?.trim() || '未命名';

		return (
			<>
				<Confirm
					open={deleteRecordOnlyOpen}
					onOpenChange={(v) => {
						setDeleteRecordOnlyOpen(v);
						if (!v) setSelectKnowledge(null);
					}}
					title="删除知识库记录？"
					description={
						<>
							{isTauriRuntime()
								? '本地目录未找到对应文件，是否仅从数据库删除该条目？'
								: '是否从数据库删除该条目？'}
							<div className="mt-2 font-medium wrap-anywhere">
								文件名称：「{deleteRecordTitle}」
							</div>
						</>
					}
					descriptionClassName="text-left"
					confirmText="删除"
					confirmVariant="destructive"
					closeOnConfirm={false}
					onConfirm={onConfirmDeleteRecordOnly}
				/>

				<Confirm
					open={deleteLocalOpen}
					onOpenChange={(v) => {
						setDeleteLocalOpen(v);
						if (!v) setDeleteLocalPath('');
					}}
					title="删除本地文件？"
					description={
						<>
							确定要删除「{deleteLocalFileName}」吗？此操作不可撤销。
							<div className="mt-2 block break-all text-xs opacity-80">
								{deleteLocalPath}
							</div>
						</>
					}
					descriptionClassName="text-left"
					confirmText="删除"
					confirmVariant="destructive"
					closeOnConfirm={false}
					onConfirm={onConfirmDeleteLocal}
				/>

				<Drawer title="知识库" open={open} onOpenChange={onOpenChange}>
					<ScrollArea
						className="h-full overflow-y-auto pr-4 box-border"
						onScroll={knowledgeStore.onListViewportScroll}
					>
						<div className="flex flex-col gap-2">
							{showInitialPlaceholder ? (
								<div className="text-sm text-textcolor/60 py-6 text-center">
									加载中…
								</div>
							) : null}
							{list.map((knowledge) => (
								<KnowledgeListRow
									key={knowledge.id}
									item={knowledge}
									selected={
										editingKnowledgeId != null &&
										editingKnowledgeId === knowledge.id
									}
									onActivate={handleRowClick}
									onTrashClick={onTrashClick}
								/>
							))}
							{showLoadMoreHint ? (
								<div className="text-xs text-textcolor/50 py-2 text-center">
									加载更多…
								</div>
							) : null}
							{showEmptyHint ? (
								<div className="text-sm text-textcolor/60 py-8 text-center">
									暂无知识库条目
								</div>
							) : null}
						</div>
					</ScrollArea>
				</Drawer>
			</>
		);
	},
);

export default KnowledgeList;
