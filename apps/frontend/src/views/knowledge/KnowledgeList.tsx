import Confirm from '@design/Confirm';
import { Drawer } from '@design/Drawer';
import { Button } from '@ui/button';
import { ScrollArea } from '@ui/index';
import { Toast } from '@ui/sonner';
import { Switch } from '@ui/switch';
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
	invokeListKnowledgeMarkdownFiles,
	invokeReadKnowledgeMarkdownFile,
	invokeResolveKnowledgeMarkdownTarget,
} from '@/utils/knowledge-save';
import { KNOWLEDGE_LOCAL_MD_ID_PREFIX, TAURI_KNOWLEDGE_DIR } from './constants';

/** 从绝对路径取所在目录（兼容 `/` 与 `\`） */
function dirnameFs(filePath: string): string {
	const n = filePath.replace(/[/\\]+$/, '');
	const i = Math.max(n.lastIndexOf('/'), n.lastIndexOf('\\'));
	if (i <= 0) return n;
	return n.slice(0, i);
}

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
						'cursor-pointer shrink-0 p-1 rounded-md text-textcolor/80 transition-opacity duration-150',
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
			<div className="text-xs text-textcolor/50 space-y-0.5">
				{item.localAbsolutePath ? (
					<div className="truncate opacity-70" title={item.localAbsolutePath}>
						{item.localAbsolutePath}
					</div>
				) : null}
				<div>更新 {formatDate(item.updatedAt?.toString() ?? '')}</div>
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
		/** 仅删本地浏览列表中的文件，不走数据库 */
		const [localFileDeleteOnly, setLocalFileDeleteOnly] = useState(false);
		/** 本地无文件或非 Tauri：仅删除数据库记录 */
		const [deleteRecordOnlyOpen, setDeleteRecordOnlyOpen] = useState(false);
		const [selectKnowledge, setSelectKnowledge] =
			useState<KnowledgeListItem | null>(null);

		/** false：云端列表；true：递归扫描本地文件夹中的 .md */
		const [useLocalFolder, setUseLocalFolder] = useState(false);
		const [localFolderPath, setLocalFolderPath] = useState(TAURI_KNOWLEDGE_DIR);
		const [localList, setLocalList] = useState<KnowledgeListItem[]>([]);
		const [localLoading, setLocalLoading] = useState(false);

		const loadLocalMarkdownList = useCallback(async () => {
			if (!isTauriRuntime()) return;
			setLocalLoading(true);
			try {
				const entries = await invokeListKnowledgeMarkdownFiles({
					dirPath: localFolderPath.trim() || undefined,
				});
				setLocalList(
					entries.map((e) => ({
						id: `${KNOWLEDGE_LOCAL_MD_ID_PREFIX}${encodeURIComponent(e.path)}`,
						title: e.title,
						author: null,
						authorId: null,
						updatedAt: new Date(e.updatedAtMs).toISOString(),
						localAbsolutePath: e.path,
					})),
				);
			} catch (e) {
				Toast({
					type: 'error',
					title: '加载本地列表失败',
					message: formatTauriInvokeError(e),
				});
				setLocalList([]);
			} finally {
				setLocalLoading(false);
			}
		}, [localFolderPath]);

		useEffect(() => {
			if (!open) return;
			if (useLocalFolder) return;
			void knowledgeStore.refreshList();
		}, [open, useLocalFolder, knowledgeStore]);

		useEffect(() => {
			if (!open || !useLocalFolder || !isTauriRuntime()) return;
			void loadLocalMarkdownList();
		}, [open, useLocalFolder, loadLocalMarkdownList]);

		const pickLocalFolder = useCallback(async () => {
			try {
				const { invoke } = await import('@tauri-apps/api/core');
				const dir = await invoke<string>('select_directory');
				setLocalFolderPath(dir);
			} catch (e) {
				const msg = formatTauriInvokeError(e);
				if (msg === '未选择目录') return;
				Toast({ type: 'error', title: msg });
			}
		}, []);

		const handleRowClick = useCallback(
			async (item: KnowledgeListItem) => {
				if (item.localAbsolutePath) {
					try {
						const content = await invokeReadKnowledgeMarkdownFile(
							item.localAbsolutePath,
						);
						const dir = dirnameFs(item.localAbsolutePath);
						const record: KnowledgeRecord = {
							id: item.id,
							title: item.title,
							content,
							author: null,
							authorId: null,
							updatedAt: item.updatedAt,
							localDirPath: dir,
						};
						await onPick?.(record);
						onOpenChange(false);
					} catch (e) {
						Toast({
							type: 'error',
							title: '读取失败',
							message: formatTauriInvokeError(e),
						});
					}
					return;
				}
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
			setLocalFileDeleteOnly(false);
			if (knowledge.localAbsolutePath && isTauriRuntime()) {
				setSelectKnowledge(knowledge);
				setDeleteLocalPath(knowledge.localAbsolutePath);
				setLocalFileDeleteOnly(true);
				setDeleteLocalOpen(true);
				return;
			}
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

		/** 确认删除：先删数据库记录（若有选中项），再删本地 Markdown；或仅删本地浏览中的文件 */
		const onConfirmDeleteLocal = useCallback(async () => {
			try {
				if (localFileDeleteOnly && selectKnowledge?.localAbsolutePath) {
					const result = await invokeDeleteKnowledgeMarkdown({
						title: selectKnowledge.title ?? '',
						filePath: deleteLocalPath,
					});
					if (result.success === 'success') {
						Toast({
							type: 'success',
							title: '文件已删除',
							message: result.filePath ? `${result.filePath}` : undefined,
						});
						setDeleteLocalOpen(false);
						setDeleteLocalPath('');
						setLocalFileDeleteOnly(false);
						onAfterLocalDelete?.(selectKnowledge.id);
						setSelectKnowledge(null);
						await loadLocalMarkdownList();
					} else {
						Toast({
							type: 'error',
							title: '删除失败',
							message: result.message,
						});
					}
					return;
				}
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
					setLocalFileDeleteOnly(false);
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
		}, [
			deleteLocalPath,
			handleDeleteApi,
			loadLocalMarkdownList,
			localFileDeleteOnly,
			onAfterLocalDelete,
			selectKnowledge,
		]);

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
		const displayList = useLocalFolder ? localList : list;
		const displayLoading = useLocalFolder ? localLoading : loading;
		const showInitialPlaceholder = displayLoading && displayList.length === 0;
		const showLoadMoreHint = !useLocalFolder && loadingMore;
		const showEmptyHint =
			!displayLoading &&
			displayList.length === 0 &&
			(!useLocalFolder ? !loadingMore : true);

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
							<div className="mt-2 font-medium text-base wrap-anywhere">
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
						if (!v) {
							setDeleteLocalPath('');
							setLocalFileDeleteOnly(false);
						}
					}}
					title="删除本地文件？"
					description={
						<>
							{localFileDeleteOnly
								? '将仅从磁盘删除该 Markdown 文件，不涉及云端知识库记录。'
								: '将同时移除数据库条目与本地同名文件。'}
							<div className="mt-2 font-medium text-base wrap-anywhere">
								「{deleteLocalFileName}」
							</div>
							<div className="mt-2 block break-all text-sm opacity-80">
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
					<div className="flex h-full min-h-0 flex-col">
						<div className="flex shrink-0 flex-col gap-3 pr-4 pb-3">
							<div className="flex flex-wrap items-center justify-between gap-2">
								<span className="text-sm text-textcolor/80">数据来源</span>
								<div className="flex items-center gap-2">
									<span
										className={cn(
											'text-xs',
											!useLocalFolder && 'font-medium text-textcolor',
										)}
									>
										数据库
									</span>
									<Switch
										id="knowledge-drawer-local-source"
										checked={useLocalFolder}
										disabled={!isTauriRuntime()}
										onCheckedChange={(v) => setUseLocalFolder(!!v)}
										size="sm"
									/>
									<span
										className={cn(
											'text-xs',
											useLocalFolder && 'font-medium text-textcolor',
										)}
									>
										本地文件夹
									</span>
								</div>
							</div>
							{useLocalFolder && isTauriRuntime() ? (
								<div className="flex flex-col gap-2">
									<div className="flex items-center gap-2">
										<Button
											variant="link"
											size="sm"
											className="shrink-0 p-0 text-teal-400"
											onClick={() => void pickLocalFolder()}
										>
											选择文件夹
										</Button>
										<span
											className="min-w-0 flex-1 truncate text-xs text-textcolor/50"
											title={localFolderPath}
										>
											{localFolderPath}
										</span>
									</div>
								</div>
							) : null}
							{!isTauriRuntime() ? (
								<p className="text-xs text-textcolor/50">
									本地文件夹列表仅在桌面端（Tauri）可用。
								</p>
							) : null}
						</div>
						<ScrollArea
							className="min-h-0 flex-1 overflow-y-auto pr-4 box-border"
							onScroll={
								useLocalFolder ? undefined : knowledgeStore.onListViewportScroll
							}
						>
							<div className="flex flex-col gap-2">
								{showInitialPlaceholder ? (
									<div className="text-sm text-textcolor/60 py-6 text-center">
										加载中…
									</div>
								) : null}
								{displayList.map((knowledge) => (
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
										{useLocalFolder
											? '该文件夹下暂无 .md 文件'
											: '暂无知识库条目'}
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

export default KnowledgeList;
