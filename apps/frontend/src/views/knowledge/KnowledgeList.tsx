import Confirm from '@design/Confirm';
import { Drawer } from '@design/Drawer';
import Loading from '@design/Loading';
import Tooltip from '@design/Tooltip';
import { Button, ScrollArea, Spinner, Switch, Toast } from '@ui/index';
import { Input } from '@ui/input';
import {
	ChevronRight,
	Code2,
	Folder,
	FolderOpen,
	Globe,
	Search,
	Trash2,
} from 'lucide-react';
import { observer } from 'mobx-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useI18n } from '@/hooks';
import { cn } from '@/lib/utils';
import { deleteKnowledge } from '@/service';
import useStore from '@/store';
import type { KnowledgeListItem, KnowledgeRecord } from '@/types';
import { formatDate, isTauriRuntime } from '@/utils';
import {
	formatTauriInvokeError,
	invokeDeleteKnowledgeMarkdown,
	invokeListKnowledgeMarkdownFiles,
	invokeOpenKnowledgeMarkdownInEditor,
	invokeReadKnowledgeMarkdownFile,
	invokeResolveKnowledgeMarkdownTarget,
} from '@/utils/knowledge-save';
import { KNOWLEDGE_LOCAL_MD_ID_PREFIX, TAURI_KNOWLEDGE_DIR } from './constants';
import {
	buildLocalMdTree,
	collectLocalMdDirPaths,
	flattenVisibleLocalMdTree,
	type LocalMdTreeDir,
	type LocalMdTreeFile,
	normalizeFsPath,
} from './knowledge-local-tree';

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
	/**
	 * 是否允许云端列表（未登录时应为 false：不调列表接口，默认本地文件夹，且不可切到数据库）
	 */
	allowCloudList?: boolean;
}

interface KnowledgeListRowProps {
	item: KnowledgeListItem;
	selected: boolean;
	onActivate: (item: KnowledgeListItem) => void;
	onTrashClick: (e: React.MouseEvent, item: KnowledgeListItem) => void;
	onVisibilityClick?: (e: React.MouseEvent, item: KnowledgeListItem) => void;
	/** 本地文件夹模式：在 Cursor / Trae 中打开（按钮在删除左侧） */
	showOpenInExternalEditor?: boolean;
	onOpenInExternalEditorClick?: (
		e: React.MouseEvent,
		item: KnowledgeListItem,
	) => void;
	/** 本地树缩进层级（0 起） */
	depth?: number;
}

interface KnowledgeFolderRowProps {
	node: LocalMdTreeDir;
	depth: number;
	expanded: boolean;
	onToggle: (path: string) => void;
}

function localFileToListItem(node: LocalMdTreeFile): KnowledgeListItem {
	return {
		id: `${KNOWLEDGE_LOCAL_MD_ID_PREFIX}${encodeURIComponent(node.path)}`,
		title: node.title,
		author: null,
		authorId: null,
		updatedAt: node.updatedAt,
		localAbsolutePath: node.path,
	};
}

const KnowledgeListRow = (props: KnowledgeListRowProps) => {
	const { t } = useI18n();
	const {
		item,
		selected,
		onActivate,
		onTrashClick,
		onVisibilityClick,
		showOpenInExternalEditor = false,
		onOpenInExternalEditorClick,
		depth = 0,
	} = props;

	const onKeyDown = (e: React.KeyboardEvent) => {
		if (e.key === 'Enter' || e.key === ' ') {
			e.preventDefault();
			void onActivate(item);
		}
	};

	const showOpenEditor =
		showOpenInExternalEditor &&
		!!item.localAbsolutePath &&
		!!onOpenInExternalEditorClick;
	const owned = item.localAbsolutePath ? true : item.isOwned !== false;
	const showVisibility =
		owned && !item.localAbsolutePath && !!onVisibilityClick;
	const showTrash = owned;
	const actionCount =
		(showOpenEditor ? 1 : 0) + (showVisibility ? 1 : 0) + (showTrash ? 1 : 0);
	const hoverPr =
		actionCount >= 3
			? 'group-hover:pr-22'
			: actionCount === 2
				? 'group-hover:pr-14'
				: actionCount === 1
					? 'group-hover:pr-8'
					: '';
	const author = item.author?.trim() || '';
	const updatedLabel = t('knowledge.list.updatedAt', {
		time: formatDate(item.updatedAt?.toString() ?? ''),
	});

	return (
		<div
			onClick={() => void onActivate(item)}
			onKeyDown={onKeyDown}
			style={depth > 0 ? { paddingLeft: 15 + depth * 12 } : undefined}
			className={cn(
				'group relative w-full cursor-pointer overflow-hidden flex flex-col gap-1 p-2 rounded-md transition-colors',
				selected ? 'bg-theme/10' : 'hover:bg-theme/10',
			)}
		>
			{/* 与学习笔记列表一致：非 hover 时 title 占满；操作区 absolute 不占位 */}
			<div
				className={cn('min-w-0 w-full flex items-center gap-1.5 pr-0', hoverPr)}
			>
				{item.isPublic ? (
					<span
						className={cn(
							'shrink-0 rounded px-1.5 py-1 text-xs font-medium leading-none',
							owned
								? 'bg-teal-500/15 text-teal-500'
								: 'bg-sky-500/15 text-sky-500',
						)}
					>
						{t('knowledge.list.publicBadge')}
					</span>
				) : null}
				<span className="min-w-0 truncate font-medium">
					{item.title?.trim() || t('knowledge.common.untitled')}
				</span>
			</div>
			{actionCount > 0 ? (
				<div className="absolute top-2 right-2 flex items-center gap-0.5 opacity-0 pointer-events-none transition-opacity duration-150 group-hover:opacity-100 group-hover:pointer-events-auto">
					{showOpenEditor ? (
						<Tooltip
							side="left"
							sideOffset={6}
							delayDuration={200}
							shadow
							content={t('knowledge.list.openInEditor')}
						>
							<button
								type="button"
								aria-label={t('knowledge.list.openInEditor')}
								className={cn(
									'flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-md text-textcolor/80',
									'hover:text-teal-500 hover:bg-teal-500/10',
								)}
								onClick={(e) => {
									e.stopPropagation();
									onOpenInExternalEditorClick?.(e, item);
								}}
							>
								<Code2 size={16} />
							</button>
						</Tooltip>
					) : null}
					{showVisibility ? (
						<Tooltip
							side="left"
							sideOffset={6}
							delayDuration={200}
							shadow
							content={
								item.isPublic
									? t('knowledge.list.makePrivate')
									: t('knowledge.list.makePublic')
							}
						>
							<button
								type="button"
								aria-label={
									item.isPublic
										? t('knowledge.list.makePrivate')
										: t('knowledge.list.makePublic')
								}
								className={cn(
									'flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-md',
									item.isPublic
										? 'text-teal-500 hover:bg-teal-500/10'
										: 'text-textcolor/80 hover:text-teal-500 hover:bg-teal-500/10',
								)}
								onClick={(e) => onVisibilityClick?.(e, item)}
							>
								<Globe size={15} />
							</button>
						</Tooltip>
					) : null}
					{showTrash ? (
						<button
							type="button"
							aria-label={
								item.localAbsolutePath
									? t('knowledge.list.deleteLocalMdAria')
									: t('knowledge.list.deleteFromLibraryAria')
							}
							className={cn(
								'flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-md text-textcolor/80',
								'hover:text-destructive hover:bg-destructive/10',
							)}
							onClick={(e) => onTrashClick(e, item)}
						>
							<Trash2 size={16} />
						</button>
					) : null}
				</div>
			) : null}
			<div className="flex min-w-0 w-full items-center gap-1 text-xs text-textcolor/50">
				{author ? (
					<>
						<Tooltip
							side="bottom"
							sideOffset={6}
							delayDuration={200}
							shadow
							content={author}
						>
							<span className="min-w-0 truncate">{author}</span>
						</Tooltip>
						<span className="shrink-0" aria-hidden>
							·
						</span>
						<span className="shrink-0 whitespace-nowrap">{updatedLabel}</span>
					</>
				) : (
					<span className="truncate">{updatedLabel}</span>
				)}
			</div>
		</div>
	);
};

const KnowledgeFolderRow = (props: KnowledgeFolderRowProps) => {
	const { node, depth, expanded, onToggle } = props;
	const onKeyDown = (e: React.KeyboardEvent) => {
		if (e.key === 'Enter' || e.key === ' ') {
			e.preventDefault();
			onToggle(node.path);
		}
	};

	return (
		<div
			role="button"
			tabIndex={0}
			aria-expanded={expanded}
			onClick={() => onToggle(node.path)}
			onKeyDown={onKeyDown}
			style={depth > 0 ? { paddingLeft: 8 + depth * 12 } : undefined}
			className="group relative w-full cursor-pointer overflow-hidden flex items-center gap-1.5 p-2 rounded-md transition-colors hover:bg-theme/10"
		>
			<ChevronRight
				size={14}
				aria-hidden
				className={cn(
					'shrink-0 text-textcolor/50 transition-transform',
					expanded && 'rotate-90',
				)}
			/>
			{expanded ? (
				<FolderOpen
					size={15}
					className="shrink-0 text-teal-500/90"
					aria-hidden
				/>
			) : (
				<Folder size={15} className="shrink-0 text-teal-500/90" aria-hidden />
			)}
			<span className="min-w-0 truncate font-medium">{node.name}</span>
			{node.children.length > 0 ? (
				<span className="shrink-0 text-xs text-textcolor/40">
					{node.children.length}
				</span>
			) : null}
		</div>
	);
};

const KnowledgeList: React.FC<IProps> = observer(
	({
		open,
		onOpenChange,
		onPick,
		currentTitle: _currentTitle = '',
		onAfterLocalDelete,
		onDeletedRecord,
		editingKnowledgeId = null,
		allowCloudList = true,
	}) => {
		const { knowledgeStore, userStore } = useStore();
		const { t } = useI18n();

		const [deleteLocalOpen, setDeleteLocalOpen] = useState(false);
		const [deleteLocalPath, setDeleteLocalPath] = useState('');
		/** 仅删本地浏览列表中的文件，不走数据库 */
		const [localFileDeleteOnly, setLocalFileDeleteOnly] = useState(false);
		/** 本地无文件或非 Tauri：仅删除数据库记录 */
		const [deleteRecordOnlyOpen, setDeleteRecordOnlyOpen] = useState(false);
		const [selectKnowledge, setSelectKnowledge] =
			useState<KnowledgeListItem | null>(null);
		const [visibilityConfirmOpen, setVisibilityConfirmOpen] = useState(false);
		const [pendingVisibility, setPendingVisibility] = useState<{
			id: string;
			isPublic: boolean;
		} | null>(null);

		/** false：云端列表；true：本地文件夹树（仅展开含 .md 的目录） */
		const [useLocalFolder, setUseLocalFolder] = useState(!allowCloudList);
		const [localFolderPath, setLocalFolderPath] = useState(TAURI_KNOWLEDGE_DIR);
		const [localList, setLocalList] = useState<KnowledgeListItem[]>([]);
		const [localLoading, setLocalLoading] = useState(false);
		const [expandedDirs, setExpandedDirs] = useState(
			() => new Set([normalizeFsPath(TAURI_KNOWLEDGE_DIR)]),
		);
		/** 文档名称搜索：输入框内容；回车后写入 appliedQuery 才真正过滤 / 请求 */
		const [titleQuery, setTitleQuery] = useState(
			() => knowledgeStore.titleKeyword,
		);
		const [appliedQuery, setAppliedQuery] = useState(
			() => knowledgeStore.titleKeyword,
		);
		const titleQueryNorm = appliedQuery.trim().toLowerCase();
		const searching = titleQueryNorm.length > 0;

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
					title: t('knowledge.list.localLoadFailed'),
					message: formatTauriInvokeError(e),
				});
				setLocalList([]);
			} finally {
				setLocalLoading(false);
			}
		}, [localFolderPath, t]);

		const localTree = useMemo(() => {
			const root = localFolderPath.trim() || TAURI_KNOWLEDGE_DIR;
			const entries = localList
				.filter((i) => !!i.localAbsolutePath)
				.map((i) => ({
					path: i.localAbsolutePath!,
					title:
						i.title?.trim() || i.localAbsolutePath!.split(/[/\\]/).pop() || '',
					updatedAt: i.updatedAt?.toString() ?? '',
				}))
				.filter((e) =>
					searching ? e.title.toLowerCase().includes(titleQueryNorm) : true,
				);
			return buildLocalMdTree(root, entries);
		}, [localFolderPath, localList, searching, titleQueryNorm]);

		const visibleLocalRows = useMemo(
			() => flattenVisibleLocalMdTree(localTree, expandedDirs),
			[localTree, expandedDirs],
		);

		const localFileCount = useMemo(() => {
			let n = 0;
			const walk = (dir: LocalMdTreeDir) => {
				for (const c of dir.children) {
					if (c.type === 'file') n += 1;
					else walk(c);
				}
			};
			walk(localTree);
			return n;
		}, [localTree]);

		const toggleLocalDir = useCallback((path: string) => {
			const key = normalizeFsPath(path);
			setExpandedDirs((prev) => {
				const next = new Set(prev);
				if (next.has(key)) next.delete(key);
				else next.add(key);
				return next;
			});
		}, []);

		const submitTitleSearch = useCallback(() => {
			setAppliedQuery(titleQuery);
			if (useLocalFolder) {
				const q = titleQuery.trim().toLowerCase();
				if (!q) return;
				// 回车搜索时先展开匹配树，之后折叠由 expandedDirs 控制
				const root = localFolderPath.trim() || TAURI_KNOWLEDGE_DIR;
				const entries = localList
					.filter((i) => !!i.localAbsolutePath)
					.map((i) => ({
						path: i.localAbsolutePath!,
						title:
							i.title?.trim() ||
							i.localAbsolutePath!.split(/[/\\]/).pop() ||
							'',
						updatedAt: i.updatedAt?.toString() ?? '',
					}))
					.filter((e) => e.title.toLowerCase().includes(q));
				setExpandedDirs(
					new Set(collectLocalMdDirPaths(buildLocalMdTree(root, entries))),
				);
				return;
			}
			if (allowCloudList) {
				void knowledgeStore.refreshList(titleQuery);
			}
		}, [
			titleQuery,
			useLocalFolder,
			localFolderPath,
			localList,
			allowCloudList,
			knowledgeStore,
		]);

		// 未登录：固定使用本地文件夹模式，避免请求云端列表
		useEffect(() => {
			if (!allowCloudList) {
				setUseLocalFolder(true);
			}
		}, [allowCloudList]);

		// 云端列表：打开 / 切回数据库时拉当前已提交的关键词（输入中未回车的不搜）
		useEffect(() => {
			if (!open || useLocalFolder || !allowCloudList) return;
			void knowledgeStore.refreshList(appliedQuery);
		}, [open, useLocalFolder, allowCloudList, knowledgeStore]);

		useEffect(() => {
			if (!open || !useLocalFolder || !isTauriRuntime()) return;
			void loadLocalMarkdownList();
		}, [open, useLocalFolder, loadLocalMarkdownList]);

		const pickLocalFolder = useCallback(async () => {
			try {
				const { invoke } = await import('@tauri-apps/api/core');
				const dir = await invoke<string>('select_directory');
				const normalized = normalizeFsPath(dir);
				setLocalFolderPath(dir);
				setExpandedDirs(new Set([normalized]));
			} catch (e) {
				const msg = formatTauriInvokeError(e);
				if (msg === t('knowledge.list.dirNotSelected')) return;
				Toast({ type: 'error', title: msg });
			}
		}, [t]);

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
							title: t('knowledge.list.readFailed'),
							message: formatTauriInvokeError(e),
						});
					}
					return;
				}
				if (!userStore.userInfo.id) {
					Toast({
						type: 'warning',
						title: t('auth.loginRequired'),
						message: t('knowledge.list.cloudOpenLoginTip'),
					});
					return;
				}
				const detail = await knowledgeStore.fetchDetail(item.id);
				if (!detail) {
					Toast({
						type: 'error',
						title: t('common.loadFailed'),
						message: t('knowledge.list.detailMissing'),
					});
					return;
				}
				await onPick?.(detail);
				onOpenChange(false);
			},
			[knowledgeStore, userStore.userInfo.id, onPick, onOpenChange, t],
		);

		const handleDeleteApi = useCallback(
			async (item: KnowledgeListItem): Promise<boolean> => {
				if (!userStore.userInfo.id) {
					Toast({
						type: 'warning',
						title: t('auth.loginRequired'),
						message: t('knowledge.list.cloudDeleteLoginTip'),
					});
					return false;
				}
				const res = await deleteKnowledge(item.id);
				if (!res.success) {
					Toast({
						type: 'error',
						title: t('common.deleteFailed'),
						message: res.message || t('common.tryLater'),
					});
					return false;
				}
				knowledgeStore.removeFromLocalList(item.id);
				onDeletedRecord?.(item.id);
				return true;
			},
			[knowledgeStore, userStore.userInfo.id, onDeletedRecord, t],
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

		const closeDeleteLocalDialog = useCallback(() => {
			setDeleteLocalOpen(false);
			setDeleteLocalPath('');
			setLocalFileDeleteOnly(false);
			setSelectKnowledge(null);
		}, []);

		/** 本地文件夹浏览：仅从磁盘删除当前文件 */
		const onConfirmDeleteLocalFolderFile = useCallback(async () => {
			if (!selectKnowledge?.localAbsolutePath) return;
			try {
				const result = await invokeDeleteKnowledgeMarkdown({
					title: selectKnowledge.title ?? '',
					filePath: deleteLocalPath,
				});
				if (result.success === 'success') {
					Toast({
						type: 'success',
						title: t('knowledge.list.fileDeleted'),
						message: result.filePath ? `${result.filePath}` : undefined,
					});
					closeDeleteLocalDialog();
					onAfterLocalDelete?.(selectKnowledge.id);
					await loadLocalMarkdownList();
				} else {
					Toast({
						type: 'error',
						title: t('common.deleteFailed'),
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
			closeDeleteLocalDialog,
			deleteLocalPath,
			loadLocalMarkdownList,
			onAfterLocalDelete,
			selectKnowledge,
		]);

		/** 云端条目 + 已解析本地文件：仅删本地 Markdown，保留在线记录 */
		const onSecondaryDeleteLocalOnly = useCallback(async () => {
			if (!selectKnowledge) return;
			try {
				const result = await invokeDeleteKnowledgeMarkdown({
					title: selectKnowledge.title ?? '',
					filePath: TAURI_KNOWLEDGE_DIR,
				});
				if (result.success === 'success') {
					Toast({
						type: 'success',
						title: t('knowledge.list.localFileDeleted'),
						message: result.filePath ? `${result.filePath}` : undefined,
					});
					closeDeleteLocalDialog();
					onAfterLocalDelete?.(selectKnowledge.id);
				} else {
					Toast({
						type: 'error',
						title: t('common.deleteFailed'),
						message: result.message,
					});
				}
			} catch (e) {
				Toast({
					type: 'error',
					title: formatTauriInvokeError(e),
				});
			}
		}, [closeDeleteLocalDialog, onAfterLocalDelete, selectKnowledge]);

		/** 云端条目 + 已解析本地文件：仅删在线（数据库）记录，保留本地文件 */
		const onTertiaryDeleteOnlineOnly = useCallback(async () => {
			if (!selectKnowledge) return;
			const ok = await handleDeleteApi(selectKnowledge);
			if (ok) closeDeleteLocalDialog();
		}, [closeDeleteLocalDialog, handleDeleteApi, selectKnowledge]);

		/** 先删在线记录再删本地文件（与原先单一「删除」一致） */
		const onConfirmDeleteBoth = useCallback(async () => {
			if (!selectKnowledge) return;
			try {
				const dbOk = await handleDeleteApi(selectKnowledge);
				if (!dbOk) return;
				const result = await invokeDeleteKnowledgeMarkdown({
					title: selectKnowledge.title ?? '',
					filePath: TAURI_KNOWLEDGE_DIR,
				});
				if (result.success === 'success') {
					Toast({
						type: 'success',
						title: t('knowledge.list.deletedBoth'),
						message: result.filePath ? `${result.filePath}` : undefined,
					});
					closeDeleteLocalDialog();
					onAfterLocalDelete?.(selectKnowledge.id);
				} else {
					Toast({
						type: 'error',
						title: t('knowledge.list.localFileDeleteFailed'),
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
			closeDeleteLocalDialog,
			handleDeleteApi,
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

		const onVisibilityClick = useCallback(
			(e: React.MouseEvent, knowledge: KnowledgeListItem) => {
				e.stopPropagation();
				setPendingVisibility({
					id: knowledge.id,
					isPublic: !knowledge.isPublic,
				});
				setVisibilityConfirmOpen(true);
			},
			[],
		);

		const onConfirmVisibility = useCallback(async () => {
			if (!pendingVisibility) return;
			const ok = await knowledgeStore.setItemVisibility(
				pendingVisibility.id,
				pendingVisibility.isPublic,
			);
			if (ok) {
				Toast({
					type: 'success',
					title: pendingVisibility.isPublic
						? t('knowledge.list.madePublic')
						: t('knowledge.list.madePrivate'),
				});
			}
			setVisibilityConfirmOpen(false);
			setPendingVisibility(null);
		}, [knowledgeStore, pendingVisibility, t]);

		/** 本地列表：在 Cursor / Trae 中打开（由 Rust detect_markdown_editor，优先 Cursor） */
		const onOpenInExternalEditorClick = useCallback(
			async (_e: React.MouseEvent, knowledge: KnowledgeListItem) => {
				const p = knowledge.localAbsolutePath;
				if (!p) return;
				try {
					const { openedWith } = await invokeOpenKnowledgeMarkdownInEditor(p);
					Toast({
						type: 'success',
						title: t('knowledge.list.openedInExternalEditor'),
						message: t('knowledge.list.openedWithEditor', {
							editor: openedWith,
						}),
						duration: 2000,
					});
				} catch (err) {
					Toast({
						type: 'error',
						title: t('knowledge.list.openFailed'),
						message: formatTauriInvokeError(err),
					});
				}
			},
			[t],
		);

		const deleteLocalFileName =
			deleteLocalPath.split(/[/\\]/).filter(Boolean).pop() ?? deleteLocalPath;

		const { loading, loadingMore, list, hasMore } = knowledgeStore;
		const displayList = useLocalFolder ? localList : list;
		const displayLoading = useLocalFolder ? localLoading : loading;
		const showInitialPlaceholder =
			displayLoading &&
			(useLocalFolder ? localList.length === 0 : displayList.length === 0);
		const showLoadMoreHint = !useLocalFolder && loadingMore;
		const showNoMoreHint =
			!useLocalFolder &&
			!loading &&
			!loadingMore &&
			list.length > 0 &&
			!hasMore;
		const showEmptyHint =
			!displayLoading && !showInitialPlaceholder
				? useLocalFolder
					? localList.length === 0 || (searching && localFileCount === 0)
					: list.length === 0 && !loadingMore
				: false;
		const emptyHintText = useLocalFolder
			? localList.length === 0
				? t('knowledge.list.empty.local')
				: t('knowledge.list.empty.search')
			: searching
				? t('knowledge.list.empty.search')
				: t('knowledge.list.empty.cloud');

		const deleteRecordTitle =
			selectKnowledge?.title?.trim() || t('knowledge.common.untitled');

		return (
			<>
				<Confirm
					open={visibilityConfirmOpen}
					onOpenChange={(v) => {
						setVisibilityConfirmOpen(v);
						if (!v) setPendingVisibility(null);
					}}
					title={
						pendingVisibility?.isPublic
							? t('knowledge.list.publicConfirmTitle')
							: t('knowledge.list.privateConfirmTitle')
					}
					description={
						pendingVisibility?.isPublic
							? t('knowledge.list.publicConfirmDesc')
							: t('knowledge.list.privateConfirmDesc')
					}
					cancelText={t('common.cancel')}
					confirmText={t('common.confirm')}
					closeOnConfirm={false}
					onConfirm={onConfirmVisibility}
				/>

				<Confirm
					open={deleteRecordOnlyOpen}
					onOpenChange={(v) => {
						setDeleteRecordOnlyOpen(v);
						if (!v) setSelectKnowledge(null);
					}}
					title={t('knowledge.list.deleteRecordTitle')}
					description={
						<>
							{isTauriRuntime()
								? t('knowledge.list.deleteRecordDesc.tauri')
								: t('knowledge.list.deleteRecordDesc.web')}
							<div className="mt-2 font-medium text-base wrap-anywhere">
								{t('knowledge.list.fileNameLabel', {
									name: deleteRecordTitle,
								})}
							</div>
						</>
					}
					cancelText={t('common.cancel')}
					descriptionClassName="text-left"
					confirmText={t('common.delete')}
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
							setSelectKnowledge(null);
						}
					}}
					title={t('knowledge.list.deleteFileTitle')}
					description={
						<>
							{localFileDeleteOnly
								? t('knowledge.list.deleteFileDesc.localOnly')
								: t('knowledge.list.deleteFileDesc.linked')}
							<div className="mt-2 font-medium text-base wrap-anywhere">
								「{deleteLocalFileName}」
							</div>
							<div className="mt-2 block break-all text-sm opacity-80">
								{deleteLocalPath}
							</div>
						</>
					}
					descriptionClassName="text-left"
					confirmText={
						localFileDeleteOnly
							? t('common.delete')
							: t('knowledge.list.deleteBoth')
					}
					confirmVariant="destructive"
					closeOnConfirm={false}
					cancelText={t('common.cancel')}
					onConfirm={
						localFileDeleteOnly
							? onConfirmDeleteLocalFolderFile
							: onConfirmDeleteBoth
					}
					{...(localFileDeleteOnly
						? {}
						: {
								secondaryActionText: t('knowledge.list.deleteLocal'),
								onSecondaryAction: onSecondaryDeleteLocalOnly,
								tertiaryActionText: t('knowledge.list.deleteOnline'),
								tertiaryVariant: 'destructive' as const,
								onTertiaryAction: onTertiaryDeleteOnlineOnly,
							})}
				/>

				<Drawer
					title={t('route.knowledge.title')}
					open={open}
					onOpenChange={onOpenChange}
				>
					<div className="flex h-full min-h-0 flex-col">
						<div className="flex shrink-0 flex-col gap-0.5 pr-4 pl-2.5 pb-0.5">
							<div className="flex flex-wrap items-center justify-between gap-2">
								<span className="text-sm text-textcolor/80">
									{t('knowledge.list.dataSource')}
								</span>
								<div className="flex items-center gap-2">
									<span
										className={cn(
											'text-xs',
											!useLocalFolder &&
												allowCloudList &&
												'font-medium text-textcolor',
										)}
									>
										{t('knowledge.list.source.db')}
									</span>
									<Switch
										id="knowledge-drawer-local-source"
										checked={useLocalFolder}
										disabled={!isTauriRuntime() || !allowCloudList}
										onCheckedChange={(v) => {
											if (!allowCloudList) return;
											setUseLocalFolder(!!v);
										}}
										size="sm"
									/>
									<span
										className={cn(
											'text-xs',
											useLocalFolder && 'font-medium text-textcolor',
										)}
									>
										{t('knowledge.list.source.local')}
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
											{t('knowledge.list.pickFolder')}
										</Button>
										<Tooltip shadow side="bottom" content={localFolderPath}>
											<span className="min-w-0 flex-1 truncate text-xs text-textcolor/50">
												{localFolderPath}
											</span>
										</Tooltip>
									</div>
								</div>
							) : null}
							{!isTauriRuntime() ? (
								<div className="text-xs text-textcolor/50">
									{t('knowledge.list.localOnlyInDesktop')}
								</div>
							) : null}
							<div
								className={cn(
									'text-xs text-textcolor/50',
									useLocalFolder ? 'mb-0.5' : 'mb-0.5 mt-2',
								)}
							>
								{!allowCloudList
									? t('knowledge.list.cloudDisabledWhenLoggedOut')
									: useLocalFolder
										? t('knowledge.list.localOpsOnly')
										: t('knowledge.list.localAndDbSync')}
							</div>
							<div className="relative mt-1.5 mb-1">
								<Search
									className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-textcolor/40"
									aria-hidden
								/>
								<Input
									type="search"
									size={18}
									value={titleQuery}
									onChange={(e) => setTitleQuery(e.target.value)}
									onKeyDown={(e) => {
										if (e.key !== 'Enter') return;
										e.preventDefault();
										submitTitleSearch();
									}}
									placeholder={t('knowledge.list.searchPlaceholder')}
									aria-label={t('knowledge.list.searchPlaceholder')}
									className="h-9 pl-8"
								/>
							</div>
						</div>
						<ScrollArea
							className="flex min-h-0 flex-1 flex-col pr-1.5 box-border"
							onScroll={
								useLocalFolder ? undefined : knowledgeStore.onListViewportScroll
							}
						>
							<div className="flex min-h-0 w-full flex-1 flex-col gap-2">
								{showInitialPlaceholder ? (
									<div className="flex flex-1 flex-col items-center justify-center py-6 text-center text-sm text-textcolor/60">
										<Loading text={t('common.loading')} />
									</div>
								) : null}
								{useLocalFolder
									? !showEmptyHint
										? visibleLocalRows.map(({ node, depth }) => {
												if (node.type === 'dir') {
													return (
														<KnowledgeFolderRow
															key={`dir:${node.path}`}
															node={node}
															depth={depth}
															expanded={expandedDirs.has(node.path)}
															onToggle={toggleLocalDir}
														/>
													);
												}
												const item = localFileToListItem(node);
												return (
													<KnowledgeListRow
														key={node.path}
														item={item}
														depth={depth}
														selected={
															editingKnowledgeId != null &&
															editingKnowledgeId === item.id
														}
														onActivate={handleRowClick}
														onTrashClick={onTrashClick}
														showOpenInExternalEditor={isTauriRuntime()}
														onOpenInExternalEditorClick={
															onOpenInExternalEditorClick
														}
													/>
												);
											})
										: null
									: displayList.map((knowledge) => (
											<KnowledgeListRow
												key={knowledge.id}
												item={knowledge}
												selected={
													editingKnowledgeId != null &&
													editingKnowledgeId === knowledge.id
												}
												onActivate={handleRowClick}
												onTrashClick={onTrashClick}
												onVisibilityClick={onVisibilityClick}
											/>
										))}
								{showLoadMoreHint ? (
									<div className="col-span-full text-textcolor/50 flex items-center justify-center gap-1.5 py-2 text-xs">
										<Spinner
											className="size-3.5 text-textcolor/50"
											aria-hidden
										/>
										{t('common.loadingMore')}
									</div>
								) : null}
								{showNoMoreHint ? (
									<div className="col-span-full text-textcolor/35 py-2 text-center text-xs">
										{t('common.noMore')}
									</div>
								) : null}
								{showEmptyHint ? (
									<div className="text-sm text-textcolor/60 py-8 text-center">
										{emptyHintText}
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
