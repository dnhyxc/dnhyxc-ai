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
import { isTauriRuntime } from '@/utils';
import {
	formatTauriInvokeError,
	invokeResolveKnowledgeMarkdownTarget,
	invokeSaveKnowledgeMarkdown,
	type SaveKnowledgeMarkdownPayload,
} from '@/utils/knowledge-save';
import {
	EDITOR_HEIGHT,
	isKnowledgeLocalMarkdownId,
	KNOWLEDGE_LOCAL_MD_ID_PREFIX,
	TAURI_KNOWLEDGE_DIR,
} from './constants';
import KnowledgeList from './KnowledgeList';

/** 保存路径解析用：从绝对路径取父目录 */
function dirnameFs(filePath: string): string {
	const n = filePath.replace(/[/\\]+$/, '');
	const i = Math.max(n.lastIndexOf('/'), n.lastIndexOf('\\'));
	if (i <= 0) return n;
	return n.slice(0, i);
}

/** 拆分标题中的主名与扩展（无扩展时默认 `.md`） */
function splitKnowledgeTitleStemAndExt(title: string): {
	stem: string;
	ext: string;
} {
	const t = title.trim() || '未命名';
	const lower = t.toLowerCase();
	for (const ext of ['.md', '.markdown', '.mdx'] as const) {
		if (lower.endsWith(ext)) {
			return { stem: t.slice(0, -ext.length), ext };
		}
	}
	return { stem: t, ext: '.md' };
}

/**
 * 另存为专用：仅用于 Tauri 落盘文件名，**不修改编辑器标题**。
 * 后缀为 `_年-月-日-时:分:秒`（如 `_2026-04-01-15:30:45`）；Rust 侧 sanitize 会把 `:` 换成 `-` 以兼容 Windows。
 * 仍冲突则再追加 `_2`、`_3`…
 */
async function pickNonConflictingDiskFileTitle(
	seedTitle: string,
	pending: SaveKnowledgeMarkdownPayload,
): Promise<string> {
	const d = new Date();
	const pad = (n: number) => String(n).padStart(2, '0');
	const timeStr = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}-${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
	const { stem, ext } = splitKnowledgeTitleStemAndExt(seedTitle);
	for (let n = 0; n < 50; n++) {
		const mid = n === 0 ? `_${timeStr}` : `_${timeStr}_${n + 1}`;
		const candidate = `${stem}${mid}${ext}`;
		const target = await invokeResolveKnowledgeMarkdownTarget({
			...pending,
			title: candidate,
			content: '',
			overwrite: false,
		});
		if (!target.exists) return candidate;
	}
	throw new Error('无法找到可用文件名');
}

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

/** 知识编辑页：正文与标题等草稿存于 knowledgeStore，聊天助手条「保存到知识库」会写入同一份草稿并跳转至此 */
const Knowledge = observer(() => {
	const { knowledgeStore, userStore } = useStore();
	const { theme } = useTheme();

	const [listOpen, setListOpen] = useState(false);
	const [saveLoading, setSaveLoading] = useState(false);

	/** 与 localStorage 脱钩，统一从 userStore 取（刷新后由 store 从缓存恢复） */
	const getUserInfo = useMemo((): StoredUserInfo => {
		const u = userStore.userInfo;
		if (u.id === 0 && !String(u.username ?? '').trim()) return null;
		return { id: u.id, username: u.username };
	}, [userStore.userInfo]);

	const monacoTheme = theme === 'black' ? 'vs-dark' : 'vs';

	const monacoLanguage = useMemo(
		() => monacoLanguageFromKnowledgeTitle(knowledgeStore.knowledgeTitle),
		[knowledgeStore.knowledgeTitle],
	);

	/** 清空标题与正文（store 级草稿，与 markdown 一并清除） */
	const resetEditorToNewDraft = useCallback(() => {
		knowledgeStore.clearKnowledgeDraft();
	}, [knowledgeStore]);

	const handleMarkdownChange = useCallback(
		(value: string) => {
			knowledgeStore.setMarkdown(value);
		},
		[knowledgeStore],
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
			return result;
		},
		[],
	);

	/** 写入后端：有 knowledgeEditingKnowledgeId 则更新，否则新建并刷新列表 */
	const persistKnowledgeApi = useCallback(async () => {
		const markdown = knowledgeStore.markdown ?? '';
		const trimmedTitle = knowledgeStore.knowledgeTitle.trim();
		const base = { title: trimmedTitle, content: markdown };
		const meta = buildAuthorMeta(getUserInfo);
		const editingId = knowledgeStore.knowledgeEditingKnowledgeId;
		/** 本地文件夹打开的条目仅写磁盘，不同步云端 */
		if (isKnowledgeLocalMarkdownId(editingId)) {
			return;
		}
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
				knowledgeStore.setKnowledgeEditingKnowledgeId(res.data.id);
				knowledgeStore.setKnowledgeLocalDiskTitle(trimmedTitle);
			}
		}
	}, [knowledgeStore, getUserInfo]);

	/**
	 * 另存为：始终新建云端记录（不更新当前 id），本地扫描打开的条目仍不写库。
	 * @param apiTitle 与编辑器展示一致，写入接口的标题（可与本地磁盘文件名不同）
	 */
	const persistKnowledgeApiSaveAs = useCallback(
		async (apiTitle: string) => {
			const markdown = knowledgeStore.markdown ?? '';
			const meta = buildAuthorMeta(getUserInfo);
			const editingId = knowledgeStore.knowledgeEditingKnowledgeId;
			if (isKnowledgeLocalMarkdownId(editingId)) {
				return;
			}
			const res = await saveKnowledge({
				title: apiTitle,
				content: markdown,
				...meta,
			} as Omit<KnowledgeRecord, 'id'>);
			if (!res.success || !res.data?.id) {
				Toast({
					type: 'error',
					title: '保存失败',
					message: res.message || '新建知识失败，请稍后重试',
				});
				throw new Error('saveKnowledge save-as failed');
			}
			knowledgeStore.setKnowledgeEditingKnowledgeId(res.data.id);
		},
		[knowledgeStore, getUserInfo],
	);

	const syncSnapshotAfterPersist = useCallback(
		(trimmedTitle: string, markdown: string) => {
			knowledgeStore.setKnowledgePersistedSnapshot({
				title: trimmedTitle,
				content: markdown,
			});
		},
		[knowledgeStore],
	);

	const onSave = useCallback(async () => {
		const markdown = knowledgeStore.markdown ?? '';
		const trimmedTitle = knowledgeStore.knowledgeTitle.trim();
		if (!trimmedTitle)
			return Toast({ type: 'warning', title: '请先输入文件名「标题」' });
		if (!markdown) return Toast({ type: 'warning', title: '请先输入内容' });
		const snap = knowledgeStore.knowledgePersistedSnapshot;
		if (snap.title === trimmedTitle && snap.content === markdown) return;
		setSaveLoading(true);
		try {
			if (isTauriRuntime()) {
				const diskTitle = knowledgeStore.knowledgeLocalDiskTitle;
				const previousTitle =
					knowledgeStore.knowledgeEditingKnowledgeId &&
					diskTitle &&
					diskTitle !== trimmedTitle
						? diskTitle
						: undefined;
				const tauriBaseDir = isKnowledgeLocalMarkdownId(
					knowledgeStore.knowledgeEditingKnowledgeId,
				)
					? knowledgeStore.knowledgeLocalDirPath?.trim() || TAURI_KNOWLEDGE_DIR
					: TAURI_KNOWLEDGE_DIR;
				const payload: SaveKnowledgeMarkdownPayload = {
					title: trimmedTitle,
					content: markdown,
					filePath: tauriBaseDir,
					...(previousTitle ? { previousTitle } : {}),
				};
				const target = await invokeResolveKnowledgeMarkdownTarget(payload);
				if (!target.exists) {
					await persistKnowledgeApi();
					await runTauriSave(payload);
					knowledgeStore.setKnowledgeLocalDiskTitle(trimmedTitle);
					syncSnapshotAfterPersist(trimmedTitle, markdown);
				} else {
					knowledgeStore.openKnowledgeOverwriteConfirm(target.path, payload);
				}
			} else {
				await persistKnowledgeApi();
				knowledgeStore.setKnowledgeLocalDiskTitle(trimmedTitle);
				syncSnapshotAfterPersist(trimmedTitle, markdown);
			}
		} finally {
			setSaveLoading(false);
		}
	}, [
		knowledgeStore,
		persistKnowledgeApi,
		runTauriSave,
		syncSnapshotAfterPersist,
	]);

	/** Command/Ctrl + S：与工具栏保存一致（捕获阶段优先于 Monaco 默认行为） */
	useEffect(() => {
		const onKeyDown = (e: KeyboardEvent) => {
			if (!(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== 's') return;
			e.preventDefault();
			if (saveLoading || knowledgeStore.knowledgeOverwriteOpen) return;
			void onSave();
		};
		window.addEventListener('keydown', onKeyDown, true);
		return () => window.removeEventListener('keydown', onKeyDown, true);
	}, [onSave, saveLoading, knowledgeStore]);

	const onConfirmOverwrite = useCallback(async () => {
		const pending = knowledgeStore.knowledgePendingSavePayload;
		if (!pending) return;
		const markdown = knowledgeStore.markdown ?? '';
		const trimmedTitle = knowledgeStore.knowledgeTitle.trim();
		const snap = knowledgeStore.knowledgePersistedSnapshot;
		if (snap.title === trimmedTitle && snap.content === markdown) {
			Toast({
				type: 'info',
				title: '暂无修改',
				message: '标题与内容与上次保存一致，未执行保存',
				duration: 2000,
			});
			knowledgeStore.setKnowledgeOverwriteOpen(false);
			return;
		}
		setSaveLoading(true);
		try {
			await persistKnowledgeApi();
			const merged = { ...pending, overwrite: true };
			await runTauriSave(merged);
			knowledgeStore.setKnowledgeLocalDiskTitle(merged.title.trim());
			syncSnapshotAfterPersist(trimmedTitle, markdown);
			knowledgeStore.setKnowledgeOverwriteOpen(false);
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
		knowledgeStore,
		syncSnapshotAfterPersist,
	]);

	/** 覆盖弹窗：另存为——仅本地文件名带 `_时间`；编辑器标题与接口标题保持当前展示名 */
	const onSaveAsFromOverwrite = useCallback(async () => {
		const pending = knowledgeStore.knowledgePendingSavePayload;
		if (!pending) return;
		const markdown = knowledgeStore.markdown ?? '';
		const displayTitle =
			knowledgeStore.knowledgeTitle.trim() || pending.title.trim();
		const wasLocalOnly = isKnowledgeLocalMarkdownId(
			knowledgeStore.knowledgeEditingKnowledgeId,
		);
		const pendingBase: SaveKnowledgeMarkdownPayload = { ...pending };
		delete pendingBase.previousTitle;
		knowledgeStore.setKnowledgeOverwriteOpen(false);
		setSaveLoading(true);
		try {
			const diskTitle = await pickNonConflictingDiskFileTitle(
				displayTitle,
				pendingBase,
			);
			const savePayload: SaveKnowledgeMarkdownPayload = {
				...pendingBase,
				title: diskTitle,
				content: markdown,
				overwrite: false,
			};
			await persistKnowledgeApiSaveAs(displayTitle);
			const tauriRes = await runTauriSave(savePayload);
			if (tauriRes.success !== 'success') return;
			knowledgeStore.setKnowledgeLocalDiskTitle(diskTitle);
			syncSnapshotAfterPersist(displayTitle, markdown);
			if (wasLocalOnly && tauriRes.filePath && tauriRes.filePath.length > 0) {
				knowledgeStore.setKnowledgeEditingKnowledgeId(
					`${KNOWLEDGE_LOCAL_MD_ID_PREFIX}${encodeURIComponent(tauriRes.filePath)}`,
				);
				knowledgeStore.setKnowledgeLocalDirPath(dirnameFs(tauriRes.filePath));
			}
		} catch (e) {
			Toast({
				type: 'error',
				title: formatTauriInvokeError(e),
			});
		} finally {
			setSaveLoading(false);
		}
	}, [
		knowledgeStore,
		persistKnowledgeApiSaveAs,
		runTauriSave,
		syncSnapshotAfterPersist,
	]);

	const handleOverwriteOpenChange = useCallback(
		(open: boolean) => {
			knowledgeStore.setKnowledgeOverwriteOpen(open);
		},
		[knowledgeStore],
	);

	const handlePickRecord = useCallback(
		(record: KnowledgeRecord) => {
			knowledgeStore.setKnowledgeOverwriteOpen(false);
			knowledgeStore.setKnowledgeEditingKnowledgeId(record.id);
			knowledgeStore.setKnowledgeLocalDirPath(record.localDirPath ?? null);
			const t = (record.title ?? '').trim();
			knowledgeStore.setKnowledgeLocalDiskTitle(t || null);
			const content = record.content ?? '';
			knowledgeStore.setKnowledgePersistedSnapshot({ title: t, content });
			knowledgeStore.setKnowledgeTitle(record.title ?? '');
			knowledgeStore.setMarkdown(content);
		},
		[knowledgeStore],
	);

	const handleDeletedRecord = useCallback(
		(id: string) => {
			if (knowledgeStore.knowledgeEditingKnowledgeId === id) {
				resetEditorToNewDraft();
			}
		},
		[knowledgeStore, resetEditorToNewDraft],
	);

	/** 仅当删除的是当前正在编辑的条目时才清空标题与正文（本地文件删成功后的回调） */
	const handleAfterLocalDelete = useCallback(
		(deletedKnowledgeId: string) => {
			if (!deletedKnowledgeId) return;
			if (knowledgeStore.knowledgeEditingKnowledgeId === deletedKnowledgeId) {
				resetEditorToNewDraft();
			}
		},
		[knowledgeStore, resetEditorToNewDraft],
	);

	const overwriteTargetPath = knowledgeStore.knowledgeOverwriteTargetPath;
	const overwriteFileName =
		overwriteTargetPath.split(/[/\\]/).filter(Boolean).pop() ??
		overwriteTargetPath;

	const markdownForDirty = knowledgeStore.markdown ?? '';
	const snapForDirty = knowledgeStore.knowledgePersistedSnapshot;
	const hasUnsavedChanges =
		knowledgeStore.knowledgeTitle.trim() !== snapForDirty.title ||
		markdownForDirty !== snapForDirty.content;

	return (
		<div className="w-full h-full flex flex-col justify-center items-center m-0">
			<Confirm
				open={knowledgeStore.knowledgeOverwriteOpen}
				onOpenChange={handleOverwriteOpenChange}
				title="覆盖已有文件？"
				description={
					<>
						当前目录下已存在同名文件「{overwriteFileName}
						」，确定要覆盖吗？此操作不可撤销。
						<div className="mt-2 block break-all text-xs opacity-80">
							{overwriteTargetPath}
						</div>
						<p className="mt-3 text-sm text-textcolor/80">
							也可选择「另存为」将文件保存为新文件
						</p>
					</>
				}
				descriptionClassName="text-left"
				confirmText="覆盖保存"
				confirmVariant="destructive"
				cancelText="取消保存"
				closeOnConfirm={false}
				confirmOnEnter
				secondaryActionText="另存为"
				onSecondaryAction={onSaveAsFromOverwrite}
				onConfirm={onConfirmOverwrite}
			/>

			<ScrollArea className="h-full min-w-0 w-full overflow-y-auto p-5 pt-0 rounded-none">
				<MarkdownEditor
					className="h-full min-w-0 max-w-full w-full"
					height={EDITOR_HEIGHT}
					theme={monacoTheme}
					language={monacoLanguage}
					documentIdentity={
						knowledgeStore.knowledgeEditingKnowledgeId ?? 'draft-new'
					}
					value={knowledgeStore.markdown}
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
								value={knowledgeStore.knowledgeTitle}
								maxLength={100}
								onChange={(e) =>
									knowledgeStore.setKnowledgeTitle(e.target.value)
								}
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
				currentTitle={knowledgeStore.knowledgeTitle}
				editingKnowledgeId={knowledgeStore.knowledgeEditingKnowledgeId}
				onAfterLocalDelete={handleAfterLocalDelete}
				onDeletedRecord={handleDeletedRecord}
				onPick={handlePickRecord}
			/>
		</div>
	);
});

export default Knowledge;
