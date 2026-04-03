import Confirm from '@design/Confirm';
import { ScrollArea } from '@ui/scroll-area';
import { Toast } from '@ui/sonner';
import { LayersPlus, LibraryBig, NotebookPen, OctagonX } from 'lucide-react';
import { observer } from 'mobx-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import MarkdownEditor from '@/components/design/Monaco';
import { Button, Input } from '@/components/ui';
import { useTheme } from '@/hooks';
import { cn } from '@/lib/utils';
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

/** 根据标题扩展名选择 Monaco language，CSS 等才能走对应 Prettier parser */
function monacoLanguageFromKnowledgeTitle(title: string): string {
	const t = title.trim().toLowerCase();
	const dot = t.lastIndexOf('.');
	if (dot < 0) return 'markdown';
	const ext = t.slice(dot + 1);
	switch (ext) {
		case 'css':
			return 'css';
		case 'scss':
		case 'sass':
			return 'scss';
		case 'less':
			return 'less';
		case 'json':
			return 'json';
		case 'html':
		case 'htm':
			return 'html';
		case 'ts':
			return 'typescript';
		case 'tsx':
			return 'typescriptreact';
		case 'jsx':
			return 'javascriptreact';
		case 'js':
		case 'mjs':
		case 'cjs':
			return 'javascript';
		case 'yaml':
		case 'yml':
			return 'yaml';
		case 'md':
		case 'markdown':
		case 'mdx':
			return 'markdown';
		default:
			return 'markdown';
	}
}

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

/** 知识编辑页：正文与标题等草稿存于 detailStore，聊天助手条「保存到知识库」会写入同一份草稿并跳转至此 */
const Knowledge = observer(() => {
	const { detailStore, knowledgeStore } = useStore();
	const { theme } = useTheme();

	const [listOpen, setListOpen] = useState(false);
	const [saveLoading, setSaveLoading] = useState(false);

	const getUserInfo = useMemo(() => readUserInfoFromStorage(), []);

	const monacoTheme = theme === 'black' ? 'vs-dark' : 'vs';

	const monacoLanguage = useMemo(
		() => monacoLanguageFromKnowledgeTitle(detailStore.knowledgeTitle),
		[detailStore.knowledgeTitle],
	);

	/** 清空标题与正文（store 级草稿，与 markdown 一并清除） */
	const resetEditorToNewDraft = useCallback(() => {
		detailStore.clearKnowledgeDraft();
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

	/** 写入后端：有 knowledgeEditingKnowledgeId 则更新，否则新建并刷新列表 */
	const persistKnowledgeApi = useCallback(async () => {
		const markdown = detailStore.markdown ?? '';
		const trimmedTitle = detailStore.knowledgeTitle.trim();
		const base = { title: trimmedTitle, content: markdown };
		const meta = buildAuthorMeta(getUserInfo);
		const editingId = detailStore.knowledgeEditingKnowledgeId;
		if (editingId) {
			const row = await knowledgeStore.updateItem(editingId, {
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
			// 新建成功后必须记下 id，否则删除本条时 id 仍为 null，无法清空编辑器
			if (res.success && res.data?.id) {
				detailStore.setKnowledgeEditingKnowledgeId(res.data.id);
				detailStore.setKnowledgeLocalDiskTitle(trimmedTitle);
			}
		}
	}, [detailStore, getUserInfo, knowledgeStore]);

	const syncSnapshotAfterPersist = useCallback(
		(trimmedTitle: string, markdown: string) => {
			detailStore.setKnowledgePersistedSnapshot({
				title: trimmedTitle,
				content: markdown,
			});
		},
		[detailStore],
	);

	const onSave = useCallback(async () => {
		const markdown = detailStore.markdown ?? '';
		const trimmedTitle = detailStore.knowledgeTitle.trim();
		if (!trimmedTitle)
			return Toast({ type: 'warning', title: '请先输入文件名「标题」' });
		if (!markdown) return Toast({ type: 'warning', title: '请先输入内容' });
		const snap = detailStore.knowledgePersistedSnapshot;
		if (snap.title === trimmedTitle && snap.content === markdown) return;
		setSaveLoading(true);
		try {
			if (isTauriRuntime()) {
				const diskTitle = detailStore.knowledgeLocalDiskTitle;
				const previousTitle =
					detailStore.knowledgeEditingKnowledgeId &&
					diskTitle &&
					diskTitle !== trimmedTitle
						? diskTitle
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
					detailStore.setKnowledgeLocalDiskTitle(trimmedTitle);
					syncSnapshotAfterPersist(trimmedTitle, markdown);
				} else {
					detailStore.openKnowledgeOverwriteConfirm(target.path, payload);
				}
			} else {
				await persistKnowledgeApi();
				detailStore.setKnowledgeLocalDiskTitle(trimmedTitle);
				syncSnapshotAfterPersist(trimmedTitle, markdown);
			}
		} finally {
			setSaveLoading(false);
		}
	}, [
		detailStore,
		persistKnowledgeApi,
		runTauriSave,
		syncSnapshotAfterPersist,
	]);

	/** Command/Ctrl + S：与工具栏保存一致（捕获阶段优先于 Monaco 默认行为） */
	useEffect(() => {
		const onKeyDown = (e: KeyboardEvent) => {
			if (!(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== 's') return;
			e.preventDefault();
			if (saveLoading || detailStore.knowledgeOverwriteOpen) return;
			void onSave();
		};
		window.addEventListener('keydown', onKeyDown, true);
		return () => window.removeEventListener('keydown', onKeyDown, true);
	}, [onSave, saveLoading, detailStore]);

	const onConfirmOverwrite = useCallback(async () => {
		const pending = detailStore.knowledgePendingSavePayload;
		if (!pending) return;
		const markdown = detailStore.markdown ?? '';
		const trimmedTitle = detailStore.knowledgeTitle.trim();
		const snap = detailStore.knowledgePersistedSnapshot;
		if (snap.title === trimmedTitle && snap.content === markdown) {
			Toast({
				type: 'info',
				title: '暂无修改',
				message: '标题与内容与上次保存一致，未执行保存',
				duration: 2000,
			});
			detailStore.setKnowledgeOverwriteOpen(false);
			return;
		}
		setSaveLoading(true);
		try {
			await persistKnowledgeApi();
			const merged = { ...pending, overwrite: true };
			await runTauriSave(merged);
			detailStore.setKnowledgeLocalDiskTitle(merged.title.trim());
			syncSnapshotAfterPersist(trimmedTitle, markdown);
			detailStore.setKnowledgeOverwriteOpen(false);
		} catch (e) {
			Toast({
				type: 'error',
				title: formatTauriInvokeError(e),
			});
		} finally {
			setSaveLoading(false);
		}
	}, [
		persistKnowledgeApi,
		runTauriSave,
		detailStore,
		syncSnapshotAfterPersist,
	]);

	const handleOverwriteOpenChange = useCallback(
		(open: boolean) => {
			detailStore.setKnowledgeOverwriteOpen(open);
		},
		[detailStore],
	);

	const handlePickRecord = useCallback(
		(record: KnowledgeRecord) => {
			detailStore.setKnowledgeOverwriteOpen(false);
			detailStore.setKnowledgeEditingKnowledgeId(record.id);
			const t = (record.title ?? '').trim();
			detailStore.setKnowledgeLocalDiskTitle(t || null);
			const content = record.content ?? '';
			detailStore.setKnowledgePersistedSnapshot({ title: t, content });
			detailStore.setKnowledgeTitle(record.title ?? '');
			detailStore.setMarkdown(content);
		},
		[detailStore],
	);

	const handleDeletedRecord = useCallback(
		(id: string) => {
			if (detailStore.knowledgeEditingKnowledgeId === id) {
				resetEditorToNewDraft();
			}
		},
		[detailStore, resetEditorToNewDraft],
	);

	/** 仅当删除的是当前正在编辑的条目时才清空标题与正文（本地文件删成功后的回调） */
	const handleAfterLocalDelete = useCallback(
		(deletedKnowledgeId: string) => {
			if (!deletedKnowledgeId) return;
			if (detailStore.knowledgeEditingKnowledgeId === deletedKnowledgeId) {
				resetEditorToNewDraft();
			}
		},
		[detailStore, resetEditorToNewDraft],
	);

	const overwriteTargetPath = detailStore.knowledgeOverwriteTargetPath;
	const overwriteFileName =
		overwriteTargetPath.split(/[/\\]/).filter(Boolean).pop() ??
		overwriteTargetPath;

	const markdownForDirty = detailStore.markdown ?? '';
	const snapForDirty = detailStore.knowledgePersistedSnapshot;
	const hasUnsavedChanges =
		detailStore.knowledgeTitle.trim() !== snapForDirty.title ||
		markdownForDirty !== snapForDirty.content;

	return (
		<div className="w-full h-full flex flex-col justify-center items-center m-0">
			<Confirm
				open={detailStore.knowledgeOverwriteOpen}
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
				confirmOnEnter
				onConfirm={onConfirmOverwrite}
			/>

			<ScrollArea className="h-full min-w-0 w-full overflow-y-auto p-5 pt-0 rounded-none">
				<MarkdownEditor
					className="h-full min-w-0 max-w-full w-full"
					height={EDITOR_HEIGHT}
					theme={monacoTheme}
					language={monacoLanguage}
					documentIdentity={
						detailStore.knowledgeEditingKnowledgeId ?? 'draft-new'
					}
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
						<div className="flex flex-1 items-center pl-3 gap-1">
							<span
								role="img"
								aria-label={hasUnsavedChanges ? '有未保存的修改' : '知识文档'}
								className="relative inline-flex shrink-0"
							>
								<NotebookPen size={16} className="text-textcolor" />
								{hasUnsavedChanges ? (
									<span
										className="pointer-events-none absolute -right-0.5 -top-0.5 size-2 rounded-full bg-orange-500"
										aria-hidden
									/>
								) : null}
							</span>
							<Input
								value={detailStore.knowledgeTitle}
								maxLength={100}
								onChange={(e) => detailStore.setKnowledgeTitle(e.target.value)}
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
				currentTitle={detailStore.knowledgeTitle}
				editingKnowledgeId={detailStore.knowledgeEditingKnowledgeId}
				onAfterLocalDelete={handleAfterLocalDelete}
				onDeletedRecord={handleDeletedRecord}
				onPick={handlePickRecord}
			/>
		</div>
	);
});

export default Knowledge;
