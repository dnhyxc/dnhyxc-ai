import Confirm from '@design/Confirm';
import { ScrollArea } from '@ui/scroll-area';
import { Toast } from '@ui/sonner';
import { Layers2, LayersPlus, LibraryBig, ScrollText } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
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
import { TAURI_KNOWLEDGE_DIR } from './constants';
import KnowledgeList from './KnowledgeList';

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

	const [editorKey, setEditorKey] = useState(0);
	const [open, setOpen] = useState(false);

	const getValue = (value: string) => {
		detailStore.setMarkdown(value);
	};

	const onDraft = () => {
		setEditingKnowledgeId(null);
		setTitle('');
		detailStore.setMarkdown('');
		setEditorKey((k) => k + 1);
	};

	const getUserInfo = useMemo(() => {
		return getStorage('userInfo')
			? JSON.parse(getStorage('userInfo') as string)
			: null;
	}, []);

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
		const meta =
			getUserInfo?.username != null || getUserInfo?.id != null
				? {
						...(getUserInfo?.username != null
							? { author: getUserInfo.username as string }
							: {}),
						...(getUserInfo?.id != null
							? { authorId: getUserInfo.id as number }
							: {}),
					}
				: {};
		if (editingKnowledgeId) {
			await knowledgeStore.updateItem(editingKnowledgeId, { ...base, ...meta });
		} else {
			await saveKnowledge({ ...base, ...meta } as Omit<KnowledgeRecord, 'id'>);
			void knowledgeStore.refreshList();
		}
	}, [detailStore, title, getUserInfo, editingKnowledgeId, knowledgeStore]);

	const onSave = useCallback(async () => {
		const markdown = detailStore.markdown ?? '';
		const trimmedTitle = title.trim();
		if (!trimmedTitle)
			return Toast({ type: 'warning', title: '请先输入文件名「标题」' });
		if (!markdown) return Toast({ type: 'warning', title: '请先输入内容' });
		try {
			if (isTauriRuntime()) {
				const payload: SaveKnowledgeMarkdownPayload = {
					title: trimmedTitle,
					content: markdown,
					filePath: TAURI_KNOWLEDGE_DIR,
				};
				const target = await invokeResolveKnowledgeMarkdownTarget(payload);
				if (!target.exists) {
					await persistKnowledgeApi();
					await runTauriSave(payload);
				} else {
					setOverwriteTargetPath(target.path);
					setPendingSavePayload(payload);
					setOverwriteOpen(true);
				}
			} else {
				await persistKnowledgeApi();
				Toast({
					type: 'success',
					title: '文件已保存',
					message: trimmedTitle ? `「${trimmedTitle}」` : undefined,
				});
			}
		} catch (e) {
			Toast({
				type: 'error',
				title: isTauriRuntime()
					? formatTauriInvokeError(e)
					: e instanceof Error
						? e.message
						: '保存失败',
			});
		}
	}, [title, detailStore, persistKnowledgeApi, runTauriSave]);

	const onConfirmOverwrite = useCallback(async () => {
		if (!pendingSavePayload) return;
		try {
			await persistKnowledgeApi();
			await runTauriSave({ ...pendingSavePayload, overwrite: true });
			setOverwriteOpen(false);
			setPendingSavePayload(null);
			setOverwriteTargetPath('');
		} catch (e) {
			Toast({
				type: 'error',
				title: formatTauriInvokeError(e),
			});
		}
	}, [pendingSavePayload, persistKnowledgeApi, runTauriSave]);

	const overwriteFileName =
		overwriteTargetPath.split(/[/\\]/).filter(Boolean).pop() ??
		overwriteTargetPath;

	return (
		<div className="w-full h-full flex flex-col justify-center items-center m-0">
			<Confirm
				open={overwriteOpen}
				onOpenChange={(open) => {
					setOverwriteOpen(open);
					if (!open) {
						setPendingSavePayload(null);
						setOverwriteTargetPath('');
					}
				}}
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
					key={editorKey}
					className="w-full h-full"
					height="calc(100vh - 172px)"
					theme={theme === 'black' ? 'vs-dark' : 'vs'}
					value={detailStore.markdown}
					onChange={getValue}
					toolbar={
						<div className="flex items-center pr-3 gap-4">
							<Button
								variant="link"
								className="flex items-center gap-1 px-0 has-[>svg]:px-0"
								onClick={() => setOpen(true)}
							>
								<LibraryBig />
								<span className="mt-0.5">知识库</span>
							</Button>
							<Button
								variant="link"
								className="flex items-center gap-1 px-0 has-[>svg]:px-0"
								onClick={onDraft}
							>
								<Layers2 />
								<span className="mt-0.5">草稿</span>
							</Button>
							<Button
								variant="link"
								className="flex items-center gap-1 px-0 has-[>svg]:px-0"
								onClick={onSave}
							>
								<LayersPlus />
								<span className="mt-0.5">保存</span>
							</Button>
						</div>
					}
					title={
						<div className="flex flex-1 items-center pl-3">
							<ScrollText size={18} />
							<Input
								value={title}
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
				open={open}
				onOpenChange={setOpen}
				currentTitle={title}
				onAfterLocalDelete={() => {
					setEditingKnowledgeId(null);
					setTitle('');
					detailStore.setMarkdown('');
					setEditorKey((k) => k + 1);
				}}
				onDeletedRecord={(id) => {
					if (editingKnowledgeId === id) {
						setEditingKnowledgeId(null);
						setTitle('');
						detailStore.setMarkdown('');
						setEditorKey((k) => k + 1);
					}
				}}
				onPick={(record) => {
					setEditingKnowledgeId(record.id);
					setTitle(record.title ?? '');
					detailStore.setMarkdown(record.content ?? '');
					setEditorKey((k) => k + 1);
				}}
			/>
		</div>
	);
};

export default Knowledge;
