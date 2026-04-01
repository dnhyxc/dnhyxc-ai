import Confirm from '@design/Confirm';
import { Drawer } from '@design/Drawer';
import { ScrollArea } from '@ui/index';
import { Toast } from '@ui/sonner';
import { Trash2 } from 'lucide-react';
import { observer } from 'mobx-react';
import { useCallback, useEffect, useState } from 'react';
import { deleteKnowledge } from '@/service';
import useStore from '@/store';
import type { KnowledgeListItem, KnowledgeRecord } from '@/types';
import { isTauriRuntime } from '@/utils';
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
	/** 本地文件删除成功后清空编辑区等 */
	onAfterLocalDelete?: () => void;
	/** 数据库记录删除成功后回调（用于当前正在编辑的条目被删时清空编辑器） */
	onDeletedRecord?: (id: string) => void;
}

function formatTime(iso?: string): string {
	if (!iso) return '';
	try {
		const d = new Date(iso);
		if (Number.isNaN(d.getTime())) return iso;
		return d.toLocaleString();
	} catch {
		return iso;
	}
}

const KnowledgeList: React.FC<IProps> = observer(
	({
		open,
		onOpenChange,
		onPick,
		currentTitle = '',
		onAfterLocalDelete,
		onDeletedRecord,
	}) => {
		const { knowledgeStore } = useStore();

		const [deleteLocalOpen, setDeleteLocalOpen] = useState(false);
		const [deleteLocalPath, setDeleteLocalPath] = useState('');
		const [selectKnowledge, setSelectKnowledge] =
			useState<KnowledgeListItem | null>(null);

		useEffect(() => {
			if (open) {
				void knowledgeStore.refreshList();
			}
		}, [open, knowledgeStore]);

		const handleRowClick = async (item: KnowledgeListItem) => {
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
		};

		/** 列表行删除：调用后端 DELETE 删除数据库记录，再更新本地列表 */
		const handleDeleteApi = async (item: KnowledgeListItem) => {
			const res = await deleteKnowledge(item.id);
			if (!res.success) {
				Toast({
					type: 'error',
					title: '删除失败',
					message: res.message || '请稍后重试',
				});
				return;
			}
			knowledgeStore.removeFromLocalList(item.id);
			onDeletedRecord?.(item.id);
		};

		const onDeleteLocalByTitle = useCallback(
			async (knowledge: KnowledgeListItem) => {
				if (!isTauriRuntime()) {
					return Toast({
						type: 'warning',
						title: '删除本地文件仅在桌面端可用',
					});
				}
				try {
					const target = await invokeResolveKnowledgeMarkdownTarget({
						title: knowledge.title ?? '',
						content: '',
						filePath: TAURI_KNOWLEDGE_DIR,
					});
					if (!target.exists) {
						return Toast({
							type: 'warning',
							title: '未找到对应文件',
							message: '当前标题在指定目录下没有已保存的 Markdown 文件',
						});
					}
					setDeleteLocalPath(target.path);
					setDeleteLocalOpen(true);
				} catch (e) {
					Toast({
						type: 'error',
						title: formatTauriInvokeError(e),
					});
				}
			},
			[currentTitle],
		);

		const onConfirmDeleteLocal = useCallback(async () => {
			try {
				if (selectKnowledge) {
					await handleDeleteApi(selectKnowledge);
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
					onAfterLocalDelete?.();
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
		}, [currentTitle, onAfterLocalDelete, selectKnowledge]);

		const onDelete = async (
			e: React.MouseEvent,
			knowledge: Omit<KnowledgeRecord, 'content'>,
		) => {
			e.stopPropagation();
			setSelectKnowledge(knowledge);
			await onDeleteLocalByTitle(knowledge);
		};

		const deleteLocalFileName =
			deleteLocalPath.split(/[/\\]/).filter(Boolean).pop() ?? deleteLocalPath;

		return (
			<>
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
							{knowledgeStore.loading && knowledgeStore.list.length === 0 ? (
								<div className="text-sm text-textcolor/60 py-6 text-center">
									加载中…
								</div>
							) : null}
							{knowledgeStore.list.map((knowledge) => (
								<div
									key={knowledge.id}
									role="button"
									tabIndex={0}
									onClick={() => void handleRowClick(knowledge)}
									onKeyDown={(e) => {
										if (e.key === 'Enter' || e.key === ' ') {
											e.preventDefault();
											void handleRowClick(knowledge);
										}
									}}
									className="w-full cursor-pointer overflow-hidden flex flex-col gap-1 hover:bg-theme/10 p-2 rounded-md group"
								>
									<div className="flex items-start justify-between gap-2">
										<div className="flow-root flex-1 min-w-0 font-medium">
											{knowledge.title?.trim() || '未命名'}
										</div>
										<button
											type="button"
											aria-label="从知识库删除"
											className="cursor-pointer shrink-0 p-1 rounded-md text-textcolor/50 hover:text-destructive hover:bg-destructive/10 opacity-70 group-hover:opacity-100"
											onClick={(e) => onDelete(e, knowledge)}
										>
											<Trash2 size={16} />
										</button>
									</div>
									<div className="text-xs text-textcolor/50">
										更新 {formatTime(knowledge.updatedAt)}
									</div>
								</div>
							))}
							{knowledgeStore.loadingMore ? (
								<div className="text-xs text-textcolor/50 py-2 text-center">
									加载更多…
								</div>
							) : null}
							{!knowledgeStore.loading &&
							knowledgeStore.list.length === 0 &&
							!knowledgeStore.loadingMore ? (
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
