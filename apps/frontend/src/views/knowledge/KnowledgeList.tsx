import { Drawer } from '@design/Drawer';
import { ScrollArea } from '@ui/index';
import { Toast } from '@ui/sonner';
import { Trash2 } from 'lucide-react';
import { observer } from 'mobx-react';
import { useEffect } from 'react';
import useStore from '@/store';
import type { KnowledgeListItem, KnowledgeRecord } from '@/types';

interface IProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	/** 选中一条并拉取详情后回调，用于回填编辑器 */
	onPick?: (record: KnowledgeRecord) => void | Promise<void>;
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
	({ open, onOpenChange, onPick }) => {
		const { knowledgeStore } = useStore();

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

		const handleDelete = async (
			e: React.MouseEvent,
			item: KnowledgeListItem,
		) => {
			e.stopPropagation();
			const name = item.title?.trim() || '未命名';
			if (!window.confirm(`确定删除「${name}」？此操作不可恢复。`)) {
				return;
			}
			const ok = await knowledgeStore.removeItem(item.id);
			if (ok) {
				Toast({ type: 'success', title: '已删除' });
			}
		};

		return (
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
										aria-label="删除"
										className="shrink-0 p-1 rounded-md text-textcolor/50 hover:text-destructive hover:bg-destructive/10 opacity-70 group-hover:opacity-100"
										onClick={(e) => void handleDelete(e, knowledge)}
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
		);
	},
);

export default KnowledgeList;
