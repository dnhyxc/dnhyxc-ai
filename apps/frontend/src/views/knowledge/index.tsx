import Confirm from '@design/Confirm';
import Tooltip from '@design/Tooltip';
import { ScrollArea } from '@ui/scroll-area';
import { Toast } from '@ui/sonner';
import { MessageSquareText, NotebookPen } from 'lucide-react';
import { observer } from 'mobx-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ChatBot from '@/components/design/ChatBot';
import MarkdownEditor from '@/components/design/Monaco';
import { Input } from '@/components/ui';
import { ChatCoreProvider } from '@/contexts';
import { useTheme } from '@/hooks';
import { saveKnowledge } from '@/service';
import useStore from '@/store';
import { ChatStore } from '@/store/chat';
import { KnowledgeRecord } from '@/types';
import { isTauriRuntime } from '@/utils';
import {
	buildAuthorMeta,
	dirnameFs,
	formatTauriInvokeError,
	invokeResolveKnowledgeMarkdownTarget,
	invokeSaveKnowledgeMarkdown,
	monacoLanguageFromKnowledgeTitle,
	pickNonConflictingDiskFileTitle,
	type SaveKnowledgeMarkdownPayload,
} from '@/utils/knowledge-save';
import {
	chordMatchesStored,
	KNOWLEDGE_SHORTCUT_DEFAULT_CHORDS,
	KNOWLEDGE_SHORTCUTS_CHANGED_EVENT,
	loadKnowledgeShortcutChords,
} from '@/utils/knowledge-shortcuts';
import {
	EDITOR_HEIGHT,
	isKnowledgeLocalMarkdownId,
	KNOWLEDGE_LOCAL_MD_ID_PREFIX,
	TAURI_KNOWLEDGE_DIR,
} from './constants';
import KnowledgeList from './KnowledgeList';
import KnowledgeTrashList from './KnowledgeTrashList';
import KnowledgeEditorToolbar from './toolbar';

/** 知识编辑页：正文与标题等草稿存于 knowledgeStore，聊天助手条「保存到知识库」会写入同一份草稿并跳转至此 */
const Knowledge = observer(() => {
	const { knowledgeStore, userStore } = useStore();
	const { theme } = useTheme();

	const [listOpen, setListOpen] = useState(false);
	const [trashOpen, setTrashOpen] = useState(false);
	const [saveLoading, setSaveLoading] = useState(false);
	const [markdownBottomBarOpen, setMarkdownBottomBarOpen] = useState(false);
	const [chatbotOpen, setChatbotOpen] = useState<boolean>(() => {
		try {
			return localStorage.getItem('knowledge_chatbot_open') === '1';
		} catch {
			return false;
		}
	});

	// 知识库页内嵌 Chatbot：独立 chatStore，避免与 /chat 页串会话与消息
	const knowledgeChatStore = useMemo(() => new ChatStore(), []);
	/**
	 * 回收站打开时强制让 Monaco 视为“新文档”：
	 * - 解决：从回收站进入时 documentIdentity 可能恒为 'draft-new'，导致 MarkdownEditor 内部 viewMode 不重置（仍停留在 splitDiff）
	 * - 策略：每次从回收站 pick 时递增 nonce，拼到 documentIdentity 上，触发 MarkdownEditor 的 documentIdentity 变更链路
	 */
	const [trashOpenNonce, setTrashOpenNonce] = useState(0);
	/** 保存前从 Monaco 同步正文，避免 onChange 经 rAF 合并时 store 滞后导致脏检查误判 */
	const getMarkdownFromEditorRef = useRef<(() => string) | null>(null);
	const [knowledgeChords, setKnowledgeChords] = useState<{
		save: string;
		clear: string;
		openLibrary: string;
		toggleMarkdownBottomBar: string;
		openTrash: string;
	}>({
		save: KNOWLEDGE_SHORTCUT_DEFAULT_CHORDS.save,
		clear: KNOWLEDGE_SHORTCUT_DEFAULT_CHORDS.clear,
		openLibrary: KNOWLEDGE_SHORTCUT_DEFAULT_CHORDS.openLibrary,
		toggleMarkdownBottomBar:
			KNOWLEDGE_SHORTCUT_DEFAULT_CHORDS.toggleMarkdownBottomBar,
		openTrash: KNOWLEDGE_SHORTCUT_DEFAULT_CHORDS.openTrash,
	});

	const reloadKnowledgeChords = useCallback(async () => {
		const c = await loadKnowledgeShortcutChords();
		setKnowledgeChords(c);
	}, []);

	useEffect(() => {
		try {
			localStorage.setItem('knowledge_chatbot_open', chatbotOpen ? '1' : '0');
		} catch {
			// 忽略：可能没有 localStorage（或被禁用）
		}
	}, [chatbotOpen]);

	/** 与 localStorage 脱钩，统一从 userStore 取（刷新后由 store 从缓存恢复） */
	const getUserInfo = useMemo((): {
		username?: unknown;
		id?: unknown;
	} | null => {
		const u = userStore.userInfo;
		if (u.id === 0 && !String(u.username ?? '').trim()) return null;
		return { id: u.id, username: u.username };
	}, [userStore.userInfo]);

	/** 与 knowledgeStore.fetchPage 一致：无有效用户 id 时不走任何云端知识库接口 */
	const isCloudLoggedIn = Boolean(userStore.userInfo.id);

	const monacoTheme = theme === 'black' ? 'vs-dark' : 'vs';

	const monacoLanguage = useMemo(
		() => monacoLanguageFromKnowledgeTitle(knowledgeStore.knowledgeTitle),
		[knowledgeStore.knowledgeTitle],
	);

	/** 清空标题与正文（store 级草稿，与 markdown 一并清除） */
	const resetEditorToNewDraft = useCallback(() => {
		// 与「从列表打开条目」类似：editingId 从有值变 null 会改变 documentIdentity，从而触发 MarkdownEditor 换篇并退出 splitDiff。
		// 从回收站打开时 id 本就为 null，仅靠 id 不会变；递增 nonce 才能让 documentIdentity 变化，避免清空后仍卡在 Diff。
		setTrashOpenNonce((n) => n + 1);
		knowledgeStore.clearKnowledgeDraft();
	}, [knowledgeStore]);

	// 快捷键监听
	useEffect(() => {
		void reloadKnowledgeChords();
		const onShortcutsChanged = () => void reloadKnowledgeChords();
		// 系统设置中快捷键变化时重新加载快捷键
		window.addEventListener(
			KNOWLEDGE_SHORTCUTS_CHANGED_EVENT,
			onShortcutsChanged,
		);
		return () => {
			window.removeEventListener(
				KNOWLEDGE_SHORTCUTS_CHANGED_EVENT,
				onShortcutsChanged,
			);
		};
	}, [reloadKnowledgeChords]);

	// 未登录时关闭回收站抽屉，避免误触已隐藏的入口后仍请求云端
	useEffect(() => {
		if (!isCloudLoggedIn) {
			setTrashOpen(false);
		}
	}, [isCloudLoggedIn]);

	const handleMarkdownChange = useCallback(
		(value: string) => {
			knowledgeStore.setMarkdown(value);
		},
		[knowledgeStore],
	);

	// 约束：未开启覆盖保存时，不展示也不允许开启自动保存（避免后台定时保存触发冲突/弹窗逻辑分支）
	useEffect(() => {
		if (knowledgeStore.knowledgeOverwriteSaveEnabled) return;
		if (knowledgeStore.knowledgeAutoSaveEnabled) {
			knowledgeStore.setKnowledgeAutoSaveEnabled(false);
		}
	}, [
		knowledgeStore,
		knowledgeStore.knowledgeOverwriteSaveEnabled,
		knowledgeStore.knowledgeAutoSaveEnabled,
	]);

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
		/** 未登录：不调创建/更新接口（桌面端仅写本地文件由 performSave 中 Tauri 分支处理） */
		if (!isCloudLoggedIn) {
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
	}, [knowledgeStore, getUserInfo, isCloudLoggedIn]);

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
			if (!isCloudLoggedIn) {
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
		[knowledgeStore, getUserInfo, isCloudLoggedIn],
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

	type KnowledgeSaveMode = 'normal' | 'auto';

	/**
	 * 统一保存入口。
	 * - normal：缺标题/正文会 Toast；Tauri 同名冲突且未开覆盖保存时弹确认框。
	 * - auto：缺标题/正文静默跳过；冲突时静默跳过（不弹窗），避免定时保存打断编辑。
	 */
	const performSave = useCallback(
		async (mode: KnowledgeSaveMode) => {
			const markdown =
				getMarkdownFromEditorRef.current?.() ?? knowledgeStore.markdown ?? '';
			const trimmedTitle = knowledgeStore.knowledgeTitle.trim();
			if (!trimmedTitle) {
				if (mode === 'normal') {
					Toast({ type: 'warning', title: '请先输入文件名「标题」' });
				}
				return;
			}
			if (!markdown) {
				if (mode === 'normal') {
					Toast({ type: 'warning', title: '请先输入内容' });
				}
				return;
			}
			const snap = knowledgeStore.knowledgePersistedSnapshot;
			if (snap.title === trimmedTitle && snap.content === markdown) {
				return;
			}

			// 浏览器端未登录：无法写云端也无 Tauri 本地写入，避免仅更新快照造成「已保存」假象
			if (!isTauriRuntime() && !isCloudLoggedIn) {
				if (mode === 'normal') {
					Toast({
						type: 'warning',
						title: '未登录',
						message: '请登录后保存到云端知识库，或使用桌面端保存到本地文件夹。',
					});
				}
				return;
			}

			let tauriPayload: SaveKnowledgeMarkdownPayload | undefined;
			let tauriTargetExists = false;

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
				tauriPayload = {
					title: trimmedTitle,
					content: markdown,
					filePath: tauriBaseDir,
					...(previousTitle ? { previousTitle } : {}),
				};
				const target = await invokeResolveKnowledgeMarkdownTarget(tauriPayload);
				tauriTargetExists = target.exists;
				if (target.exists && !knowledgeStore.knowledgeOverwriteSaveEnabled) {
					if (mode === 'auto') {
						return;
					}
					knowledgeStore.openKnowledgeOverwriteConfirm(
						target.path,
						tauriPayload,
					);
					return;
				}
			}

			setSaveLoading(true);
			try {
				if (isTauriRuntime() && tauriPayload) {
					await persistKnowledgeApi();
					const toWrite = tauriTargetExists
						? { ...tauriPayload, overwrite: true as const }
						: tauriPayload;
					await runTauriSave(toWrite);
					knowledgeStore.setKnowledgeLocalDiskTitle(trimmedTitle);
					syncSnapshotAfterPersist(trimmedTitle, markdown);
				} else {
					await persistKnowledgeApi();
					knowledgeStore.setKnowledgeLocalDiskTitle(trimmedTitle);
					syncSnapshotAfterPersist(trimmedTitle, markdown);
				}
			} finally {
				setSaveLoading(false);
			}
		},
		[
			knowledgeStore,
			isCloudLoggedIn,
			persistKnowledgeApi,
			runTauriSave,
			syncSnapshotAfterPersist,
		],
	);

	const onSave = useCallback(() => {
		void performSave('normal');
	}, [performSave]);

	const saveLoadingRef = useRef(saveLoading);
	saveLoadingRef.current = saveLoading;
	const knowledgeStoreRef = useRef(knowledgeStore);
	knowledgeStoreRef.current = knowledgeStore;
	const performSaveRef = useRef(performSave);
	performSaveRef.current = performSave;
	const autoSaveTimeoutRef = useRef<number | null>(null);

	useEffect(() => {
		// 编辑防抖自动保存：每次标题/正文变化都重置计时器，停止编辑超过间隔后才保存
		if (autoSaveTimeoutRef.current) {
			window.clearTimeout(autoSaveTimeoutRef.current);
			autoSaveTimeoutRef.current = null;
		}
		// 约束：未开启覆盖保存时，不允许开启自动保存（上游会强制关，这里只做兜底）
		if (
			!knowledgeStore.knowledgeAutoSaveEnabled ||
			!knowledgeStore.knowledgeOverwriteSaveEnabled
		) {
			return;
		}
		// 没有内容变更时，不启动计时器
		const markdownNow = knowledgeStore.markdown ?? '';
		const titleNow = knowledgeStore.knowledgeTitle.trim();
		const snap = knowledgeStore.knowledgePersistedSnapshot;
		if (snap.title === titleNow && snap.content === markdownNow) {
			return;
		}
		const sec = knowledgeStore.knowledgeAutoSaveIntervalSec;
		const waitMs = Math.min(3_600_000, Math.max(5_000, sec * 1000));
		autoSaveTimeoutRef.current = window.setTimeout(() => {
			autoSaveTimeoutRef.current = null;
			if (saveLoadingRef.current) return;
			if (knowledgeStoreRef.current.knowledgeOverwriteOpen) return;
			void performSaveRef.current('auto');
		}, waitMs);
		return () => {
			if (autoSaveTimeoutRef.current) {
				window.clearTimeout(autoSaveTimeoutRef.current);
				autoSaveTimeoutRef.current = null;
			}
		};
	}, [
		knowledgeStore.knowledgeAutoSaveEnabled,
		knowledgeStore.knowledgeAutoSaveIntervalSec,
		knowledgeStore.knowledgeOverwriteSaveEnabled,
		knowledgeStore.knowledgeTitle,
		knowledgeStore.markdown,
		knowledgeStore.knowledgePersistedSnapshot.title,
		knowledgeStore.knowledgePersistedSnapshot.content,
	]);

	/**
	 * 知识库快捷键：组合键在系统设置中配置（shortcut_6/7/8/9），仅在本页捕获执行；
	 * 捕获阶段优先于 Monaco 默认行为。
	 */
	useEffect(() => {
		const onKeyDown = (e: KeyboardEvent) => {
			if (saveLoading || knowledgeStore.knowledgeOverwriteOpen) return;
			if (chordMatchesStored(knowledgeChords.save, e)) {
				e.preventDefault();
				void onSave();
				return;
			}
			if (chordMatchesStored(knowledgeChords.clear, e)) {
				e.preventDefault();
				resetEditorToNewDraft();
				return;
			}
			if (chordMatchesStored(knowledgeChords.openLibrary, e)) {
				e.preventDefault();
				setListOpen((open) => !open);
				return;
			}
			if (chordMatchesStored(knowledgeChords.toggleMarkdownBottomBar, e)) {
				e.preventDefault();
				setMarkdownBottomBarOpen((open) => !open);
				return;
			}
			if (chordMatchesStored(knowledgeChords.openTrash, e)) {
				if (!isCloudLoggedIn) return;
				e.preventDefault();
				setTrashOpen((open) => !open);
				return;
			}
		};
		window.addEventListener('keydown', onKeyDown, true);
		return () => window.removeEventListener('keydown', onKeyDown, true);
	}, [
		knowledgeChords,
		onSave,
		saveLoading,
		knowledgeStore.knowledgeOverwriteOpen,
		resetEditorToNewDraft,
		isCloudLoggedIn,
	]);

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
			if (isCloudLoggedIn) {
				await persistKnowledgeApiSaveAs(displayTitle);
			}
			const tauriRes = await runTauriSave(savePayload);
			if (tauriRes.success !== 'success') return;
			knowledgeStore.setKnowledgeLocalDiskTitle(diskTitle);
			syncSnapshotAfterPersist(displayTitle, markdown);
			if (
				(wasLocalOnly || !isCloudLoggedIn) &&
				tauriRes.filePath &&
				tauriRes.filePath.length > 0
			) {
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
		isCloudLoggedIn,
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

	/**
	 * 从回收站打开：仅用于展示到编辑器。
	 * 为避免把“已删除的 originalId”当作可更新条目，这里按“新草稿”处理：
	 * - editingKnowledgeId 置空（保存会走新建）
	 * - snapshot 设为当前内容（打开时不显示脏点）
	 */
	const handlePickTrashRecord = useCallback(
		(record: { title: string | null; content: string }) => {
			setTrashOpenNonce((n) => n + 1);
			knowledgeStore.setKnowledgeOverwriteOpen(false);
			knowledgeStore.setKnowledgeEditingKnowledgeId(null);
			knowledgeStore.setKnowledgeLocalDirPath(null);
			knowledgeStore.setKnowledgeLocalDiskTitle(null);
			const content = record.content ?? '';
			const trimmedTitle = (record.title ?? '').trim();
			// 从回收站打开按新草稿处理（保存走新建），Diff / 脏检查基线仍为「打开时正文/标题」（与列表 pick 一致）
			knowledgeStore.setKnowledgePersistedSnapshot({
				title: trimmedTitle,
				content,
			});
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
			if (isCloudLoggedIn) {
				void knowledgeStore.refreshList();
			}
		},
		[knowledgeStore, isCloudLoggedIn, resetEditorToNewDraft],
	);

	/** 仅当删除的是当前正在编辑的条目时才清空标题与正文（本地文件删成功后的回调） */
	const handleAfterLocalDelete = useCallback(
		(deletedKnowledgeId: string) => {
			if (!deletedKnowledgeId) return;
			if (knowledgeStore.knowledgeEditingKnowledgeId === deletedKnowledgeId) {
				resetEditorToNewDraft();
			}
			if (isCloudLoggedIn) {
				void knowledgeStore.refreshList();
			}
		},
		[knowledgeStore, isCloudLoggedIn, resetEditorToNewDraft],
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
					stickyScrollEnabled={false}
					stickyScrollScrollWithEditor={false}
					// Diff 基线：知识库/回收站均以“打开时的快照”为主；新草稿快照为空则等价于“当前 vs 空”
					diffBaselineSource="persisted"
					diffBaselineText={knowledgeStore.knowledgePersistedSnapshot.content}
					height={EDITOR_HEIGHT}
					theme={monacoTheme}
					language={monacoLanguage}
					// 回收站入口：documentIdentity 拼接 nonce，确保每次 pick/clear 都会触发组件内部重置到 edit，不重置会导致 diff 内容出现问题
					documentIdentity={`${knowledgeStore.knowledgeEditingKnowledgeId ?? 'draft-new'}__trash-${trashOpenNonce}`}
					value={knowledgeStore.markdown}
					onChange={handleMarkdownChange}
					getMarkdownFromEditorRef={getMarkdownFromEditorRef}
					markdownBottomBarOpen={markdownBottomBarOpen}
					onMarkdownBottomBarOpenChange={setMarkdownBottomBarOpen}
					markdownBottomBarShortcutHint={
						knowledgeChords.toggleMarkdownBottomBar
					}
					markdownForceViewMode={chatbotOpen ? 'split' : undefined}
					markdownSplitRightPane={
						chatbotOpen ? (
							<div className="h-full overflow-hidden contain-[inline-size]">
								<ChatCoreProvider>
									<ChatBot
										className="h-full"
										msgWrapClassName="pl-2.5 pr-3 pt-3"
										entryClassName="pl-3 pr-3.5 pb-3.5"
										apiEndpoint="/knowledge-chat/sse"
										createSessionEndpoint="/knowledge-chat/createSession"
										stopEndpoint="/knowledge-chat/stopSse"
										continueEndpoint="/knowledge-chat/continueSse"
										showEntry
										navigateToChatOnSend={false}
										entryShowUpload={false}
										entryShowWebSearchToggle={false}
										chatStore={knowledgeChatStore}
										showAvatar={false}
										showAnchorNav={false}
									/>
								</ChatCoreProvider>
							</div>
						) : undefined
					}
					markdownBottomBarExtra={
						<div className="flex items-center gap-2">
							<Tooltip
								side="top"
								content={chatbotOpen ? '关闭对话面板' : '开启对话面板'}
							>
								<button
									type="button"
									className={[
										'lucide-stroke-draw-hover flex size-7 cursor-pointer items-center justify-center rounded-md p-1 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-theme/40',
										chatbotOpen
											? 'bg-theme/25 text-textcolor'
											: 'text-textcolor/80 hover:bg-theme/10 hover:text-textcolor',
									].join(' ')}
									aria-pressed={chatbotOpen}
									aria-label={chatbotOpen ? '关闭对话面板' : '开启对话面板'}
									onClick={() => setChatbotOpen((v) => !v)}
								>
									<MessageSquareText size={18} strokeWidth={1.75} aria-hidden />
								</button>
							</Tooltip>
						</div>
					}
					overwriteSaveEnabled={knowledgeStore.knowledgeOverwriteSaveEnabled}
					onOverwriteSaveEnabledChange={(enabled) =>
						knowledgeStore.setKnowledgeOverwriteSaveEnabled(enabled)
					}
					autoSaveEnabled={
						knowledgeStore.knowledgeOverwriteSaveEnabled
							? knowledgeStore.knowledgeAutoSaveEnabled
							: false
					}
					onAutoSaveEnabledChange={
						knowledgeStore.knowledgeOverwriteSaveEnabled
							? (enabled) => knowledgeStore.setKnowledgeAutoSaveEnabled(enabled)
							: undefined
					}
					autoSaveIntervalSec={knowledgeStore.knowledgeAutoSaveIntervalSec}
					onAutoSaveIntervalSecChange={
						knowledgeStore.knowledgeOverwriteSaveEnabled
							? (sec) => knowledgeStore.setKnowledgeAutoSaveIntervalSec(sec)
							: undefined
					}
					toolbar={
						<KnowledgeEditorToolbar
							onOpenLibrary={() => setListOpen(true)}
							onOpenTrash={() => setTrashOpen(true)}
							onNewDraft={resetEditorToNewDraft}
							onSave={onSave}
							saveLoading={saveLoading}
							showTrash={isCloudLoggedIn}
							shortcutHintSave={knowledgeChords.save}
							shortcutHintClear={knowledgeChords.clear}
							shortcutHintOpenLibrary={knowledgeChords.openLibrary}
							shortcutHintOpenTrash={knowledgeChords.openTrash}
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
				allowCloudList={isCloudLoggedIn}
				currentTitle={knowledgeStore.knowledgeTitle}
				editingKnowledgeId={knowledgeStore.knowledgeEditingKnowledgeId}
				onAfterLocalDelete={handleAfterLocalDelete}
				onDeletedRecord={handleDeletedRecord}
				onPick={handlePickRecord}
			/>
			{isCloudLoggedIn ? (
				<KnowledgeTrashList
					open={trashOpen}
					onOpenChange={setTrashOpen}
					onPick={handlePickTrashRecord}
				/>
			) : null}
		</div>
	);
});

export default Knowledge;
