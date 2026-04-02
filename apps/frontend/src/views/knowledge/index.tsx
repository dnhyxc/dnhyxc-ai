import Confirm from '@design/Confirm';
import { ScrollArea } from '@ui/scroll-area';
import { Toast } from '@ui/sonner';
import { LayersPlus, LibraryBig, OctagonX, ScrollText } from 'lucide-react';
import { useCallback, useMemo, useRef, useState } from 'react';
import MarkdownEditor from '@/components/design/Monaco';
import { Button, Input } from '@/components/ui';
import { useTheme } from '@/hooks';
import { saveKnowledge } from '@/service';
import useStore from '@/store';
import { KnowledgeRecord } from '@/types';
import { getStorage, isTauriRuntime } from '@/utils';
import {
	formatTauriInvokeError,
	invokeResolveKnowledgeMarkdownTarget,
	invokeSaveKnowledgeMarkdown,
	type SaveKnowledgeMarkdownPayload,
} from '@/utils/knowledge-save';
import { EDITOR_HEIGHT, TAURI_KNOWLEDGE_DIR } from './constants';
import KnowledgeList from './KnowledgeList';
import { cn } from '@/lib/utils';

type StoredUserInfo = { username?: unknown; id?: unknown } | null;

function readUserInfoFromStorage(): StoredUserInfo {
	const raw = getStorage('userInfo');
	if (!raw) return null;
	return JSON.parse(raw as string) as StoredUserInfo;
}

/** 与原先 persist 内联逻辑一致：仅有 username / id 时写入 author / authorId */
function buildAuthorMeta(user: StoredUserInfo): {
	author?: string;
	authorId?: number;
} {
	if (!user || (user.username == null && user.id == null)) {
		return {};
	}
	return {
		...(user.username != null ? { author: user.username as string } : {}),
		...(user.id != null ? { authorId: user.id as number } : {}),
	};
}

/** 编辑器顶栏：知识库 / 草稿 / 保存 */
function KnowledgeEditorToolbar(props: {
	onOpenLibrary: () => void;
	onNewDraft: () => void;
	onSave: () => void;
	/** 保存请求进行中：禁用保存按钮 */
	saveLoading?: boolean;
}) {
	const { onOpenLibrary, onNewDraft, onSave, saveLoading = false } = props;
	const linkBtn =
		'flex items-center gap-1 px-0 has-[>svg]:px-0 disabled:hover:text-textcolor' as const;
	return (
		<div className="flex items-center pr-3 gap-4">
			<Button
				variant="link"
				className={linkBtn}
				onClick={onSave}
				disabled={saveLoading}
				aria-busy={saveLoading}
			>
				<LayersPlus className="mt-0.5" />
				<span className="mt-0.5">保存</span>
			</Button>
			<Button
				variant="link"
				className={cn(linkBtn, 'hover:text-orange-500')}
				onClick={onNewDraft}
			>
				<OctagonX className="mt-0.5" />
				<span className="mt-0.5">清空</span>
			</Button>
			<Button variant="link" className={linkBtn} onClick={onOpenLibrary}>
				<LibraryBig className="mt-0.5" />
				<span className="mt-0.5">知识库</span>
			</Button>
		</div>
	);
}

const Knowledge = () => {
	const [title, setTitle] = useState('');
	/** 正在编辑的云端知识库 id；为空表示新建 */
	const [editingKnowledgeId, setEditingKnowledgeId] = useState<string | null>(
		null,
	);
	const { detailStore, knowledgeStore } = useStore();
	const { theme } = useTheme();

	const [overwriteOpen, setOverwriteOpen] = useState(false);
	const [overwriteTargetPath, setOverwriteTargetPath] = useState('');
	const [pendingSavePayload, setPendingSavePayload] =
		useState<SaveKnowledgeMarkdownPayload | null>(null);

	const [listOpen, setListOpen] = useState(false);
	const [saveLoading, setSaveLoading] = useState(false);

	/** 打开该条时的标题：桌面端用于标题变更时重命名本地 .md，避免残留旧文件 */
	const knowledgeLocalTitleRef = useRef<string | null>(null);

	const getUserInfo = useMemo(() => readUserInfoFromStorage(), []);

	const monacoTheme = theme === 'black' ? 'vs-dark' : 'vs';

	/** 清空标题与正文并 remount 编辑器（与原先四处内联一致） */
	const resetEditorToNewDraft = useCallback(() => {
		knowledgeLocalTitleRef.current = null;
		setEditingKnowledgeId(null);
		setTitle('');
		detailStore.setMarkdown('');
	}, [detailStore]);

	const handleMarkdownChange = useCallback(
		(value: string) => {
			detailStore.setMarkdown(value);
		},
		[detailStore],
	);

	const runTauriSave = useCallback(
		async (payload: SaveKnowledgeMarkdownPayload) => {
			const result = await invokeSaveKnowledgeMarkdown(payload);
			if (result.success === 'success') {
				Toast({
					type: 'success',
					title: '文件已保存',
					message: result.filePath
						? `已保存到：${result.filePath}`
						: '已保存到默认目录',
					duration: 1000,
				});
			} else {
				Toast({ type: 'error', title: '保存失败', message: result.message });
			}
		},
		[],
	);

	/** 写入后端：有 editingKnowledgeId 则更新，否则新建并刷新列表 */
	const persistKnowledgeApi = useCallback(async () => {
		const markdown = detailStore.markdown ?? '';
		const trimmedTitle = title.trim();
		const base = { title: trimmedTitle, content: markdown };
		const meta = buildAuthorMeta(getUserInfo);
		if (editingKnowledgeId) {
			const row = await knowledgeStore.updateItem(editingKnowledgeId, {
				...base,
				...meta,
			});
			if (!row) {
				Toast({
					type: 'error',
					title: '保存失败',
					message: '更新知识失败，请稍后重试',
				});
				throw new Error('updateKnowledge failed');
			}
		} else {
			const res = await saveKnowledge({
				...base,
				...meta,
			} as Omit<KnowledgeRecord, 'id'>);
			// 新建成功后必须记下 id，否则删除本条时 editingKnowledgeId 仍为 null，无法清空编辑器
			if (res.success && res.data?.id) {
				setEditingKnowledgeId(res.data.id);
				knowledgeLocalTitleRef.current = trimmedTitle;
			}
		}
	}, [detailStore, title, getUserInfo, editingKnowledgeId, knowledgeStore]);

	const onSave = useCallback(async () => {
		const markdown = detailStore.markdown ?? '';
		const trimmedTitle = title.trim();
		if (!trimmedTitle)
			return Toast({ type: 'warning', title: '请先输入文件名「标题」' });
		if (!markdown) return Toast({ type: 'warning', title: '请先输入内容' });
		setSaveLoading(true);
		try {
			if (isTauriRuntime()) {
				const previousTitle =
					editingKnowledgeId &&
					knowledgeLocalTitleRef.current &&
					knowledgeLocalTitleRef.current !== trimmedTitle
						? knowledgeLocalTitleRef.current
						: undefined;
				const payload: SaveKnowledgeMarkdownPayload = {
					title: trimmedTitle,
					content: markdown,
					filePath: TAURI_KNOWLEDGE_DIR,
					...(previousTitle ? { previousTitle } : {}),
				};
				const target = await invokeResolveKnowledgeMarkdownTarget(payload);
				if (!target.exists) {
					await persistKnowledgeApi();
					await runTauriSave(payload);
					knowledgeLocalTitleRef.current = trimmedTitle;
				} else {
					setOverwriteTargetPath(target.path);
					setPendingSavePayload(payload);
					setOverwriteOpen(true);
				}
			} else {
				await persistKnowledgeApi();
				knowledgeLocalTitleRef.current = trimmedTitle;
			}
		} finally {
			setSaveLoading(false);
		}
	}, [
		title,
		detailStore,
		persistKnowledgeApi,
		runTauriSave,
		editingKnowledgeId,
	]);

	const onConfirmOverwrite = useCallback(async () => {
		if (!pendingSavePayload) return;
		setSaveLoading(true);
		try {
			await persistKnowledgeApi();
			const merged = { ...pendingSavePayload, overwrite: true };
			await runTauriSave(merged);
			knowledgeLocalTitleRef.current = merged.title.trim();
			setOverwriteOpen(false);
			setPendingSavePayload(null);
			setOverwriteTargetPath('');
		} catch (e) {
			Toast({
				type: 'error',
				title: formatTauriInvokeError(e),
			});
		} finally {
			setSaveLoading(false);
		}
	}, [pendingSavePayload, persistKnowledgeApi, runTauriSave]);

	const handleOverwriteOpenChange = useCallback((open: boolean) => {
		setOverwriteOpen(open);
		if (!open) {
			setPendingSavePayload(null);
			setOverwriteTargetPath('');
		}
	}, []);

	const handlePickRecord = useCallback(
		(record: KnowledgeRecord) => {
			setEditingKnowledgeId(record.id);
			const t = (record.title ?? '').trim();
			knowledgeLocalTitleRef.current = t || null;
			setTitle(record.title ?? '');
			detailStore.setMarkdown(record.content ?? '');
		},
		[detailStore],
	);

	const handleDeletedRecord = useCallback(
		(id: string) => {
			if (editingKnowledgeId === id) {
				resetEditorToNewDraft();
			}
		},
		[editingKnowledgeId, resetEditorToNewDraft],
	);

	/** 仅当删除的是当前正在编辑的条目时才清空标题与正文（本地文件删成功后的回调） */
	const handleAfterLocalDelete = useCallback(
		(deletedKnowledgeId: string) => {
			if (!deletedKnowledgeId) return;
			if (editingKnowledgeId === deletedKnowledgeId) {
				resetEditorToNewDraft();
			}
		},
		[editingKnowledgeId, resetEditorToNewDraft],
	);

	const overwriteFileName =
		overwriteTargetPath.split(/[/\\]/).filter(Boolean).pop() ??
		overwriteTargetPath;

	return (
		<div className="w-full h-full flex flex-col justify-center items-center m-0">
			<Confirm
				open={overwriteOpen}
				onOpenChange={handleOverwriteOpenChange}
				title="覆盖已有文件？"
				description={
					<>
						当前目录下已存在同名文件「{overwriteFileName}
						」，确定要覆盖吗？此操作不可撤销。
						<div className="mt-2 block break-all text-xs opacity-80">
							{overwriteTargetPath}
						</div>
					</>
				}
				descriptionClassName="text-left"
				confirmText="覆盖保存"
				confirmVariant="destructive"
				closeOnConfirm={false}
				onConfirm={onConfirmOverwrite}
			/>

			<ScrollArea className="w-full h-full overflow-y-auto p-5 pt-0 rounded-none">
				<MarkdownEditor
					// key={editorKey}
					className="w-full h-full"
					height={EDITOR_HEIGHT}
					theme={monacoTheme}
					value={detailStore.markdown}
					onChange={handleMarkdownChange}
					toolbar={
						<KnowledgeEditorToolbar
							onOpenLibrary={() => setListOpen(true)}
							onNewDraft={resetEditorToNewDraft}
							onSave={onSave}
							saveLoading={saveLoading}
						/>
					}
					title={
						<div className="flex flex-1 items-center pl-3">
							<ScrollText size={18} />
							<Input
								value={title}
								maxLength={100}
								onChange={(e) => setTitle(e.target.value)}
								placeholder="请先输入文件名「标题」..."
								aria-label="知识标题"
								className="md:text-base h-full border-0 bg-transparent pr-2 text-textcolor shadow-none placeholder:text-sm placeholder:text-textcolor/60 focus-visible:border-0 focus-visible:ring-0"
							/>
						</div>
					}
				/>
			</ScrollArea>
			<KnowledgeList
				open={listOpen}
				onOpenChange={setListOpen}
				currentTitle={title}
				editingKnowledgeId={editingKnowledgeId}
				onAfterLocalDelete={handleAfterLocalDelete}
				onDeletedRecord={handleDeletedRecord}
				onPick={handlePickRecord}
			/>
		</div>
	);
};

export default Knowledge;
