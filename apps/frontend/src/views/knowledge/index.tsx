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
	invokeDeleteKnowledgeMarkdown,
	invokeResolveKnowledgeMarkdownTarget,
	invokeSaveKnowledgeMarkdown,
	type SaveKnowledgeMarkdownPayload,
} from '@/utils/knowledge-save';

/** Tauri 下知识 Markdown 所在目录（保存 / 删除共用） */
const TAURI_KNOWLEDGE_DIR = '/Users/dnhyxc/Documents/code/dnhyxc-ai/knowledge';

const Knowledge = () => {
	const [content, setContent] = useState('');
	const [title, setTitle] = useState('');
	const { detailStore } = useStore();
	const { theme } = useTheme();

	const [overwriteOpen, setOverwriteOpen] = useState(false);
	const [overwriteTargetPath, setOverwriteTargetPath] = useState('');
	const [pendingSavePayload, setPendingSavePayload] =
		useState<SaveKnowledgeMarkdownPayload | null>(null);

	const [deleteOpen, setDeleteOpen] = useState(false);
	const [deleteTargetPath, setDeleteTargetPath] = useState('');
	const [editorKey, setEditorKey] = useState(0);

	const getValue = (value: string) => {
		setContent(value);
		detailStore.setMarkdown(value);
	};

	const onDraft = () => {
		console.log('草稿');
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

	// 保存到数据库
	const runSave = useCallback(
		async (params: Omit<KnowledgeRecord, 'id'>) => {
			await saveKnowledge(params);
		},
		[title, content],
	);

	const onSave = useCallback(async () => {
		const content = detailStore.markdown ?? '';
		const trimmedTitle = title.trim();
		if (!trimmedTitle)
			return Toast({ type: 'warning', title: '请先输入文件名「标题」' });
		if (!content) return Toast({ type: 'warning', title: '请先输入内容' });
		try {
			if (isTauriRuntime()) {
				const payload: SaveKnowledgeMarkdownPayload = {
					title: trimmedTitle,
					content,
					filePath: TAURI_KNOWLEDGE_DIR,
				};
				const target = await invokeResolveKnowledgeMarkdownTarget(payload);
				if (!target.exists) {
					await runSave({
						title,
						content,
						author: getUserInfo?.username,
						authorId: getUserInfo?.id,
					});
					await runTauriSave(payload);
				} else {
					setOverwriteTargetPath(target.path);
					setPendingSavePayload(payload);
					setOverwriteOpen(true);
				}
			}
		} catch (e) {
			Toast({
				type: 'error',
				title: formatTauriInvokeError(e),
			});
		}
	}, [title, runTauriSave]);

	const onConfirmOverwrite = useCallback(async () => {
		if (!pendingSavePayload) return;
		try {
			await runSave({
				title,
				content,
				author: getUserInfo?.username,
				authorId: getUserInfo?.id,
			});
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
	}, [pendingSavePayload, runTauriSave]);

	const onDelete = useCallback(async () => {
		const trimmedTitle = title.trim();
		if (!trimmedTitle) {
			return Toast({ type: 'warning', title: '请先输入文件名「标题」' });
		}
		if (!isTauriRuntime()) {
			return Toast({
				type: 'warning',
				title: '删除本地文件仅在桌面端可用',
			});
		}
		try {
			const target = await invokeResolveKnowledgeMarkdownTarget({
				title: trimmedTitle,
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
			setDeleteTargetPath(target.path);
			setDeleteOpen(true);
		} catch (e) {
			Toast({
				type: 'error',
				title: formatTauriInvokeError(e),
			});
		}
	}, [title]);

	const onConfirmDelete = useCallback(async () => {
		const trimmedTitle = title.trim();
		if (!trimmedTitle) return;
		try {
			const result = await invokeDeleteKnowledgeMarkdown({
				title: trimmedTitle,
				filePath: TAURI_KNOWLEDGE_DIR,
			});
			if (result.success === 'success') {
				Toast({
					type: 'success',
					title: '文件已删除',
					message: result.filePath ? `已删除：${result.filePath}` : undefined,
				});
				setDeleteOpen(false);
				setDeleteTargetPath('');
				setTitle('');
				detailStore.setMarkdown('');
				setEditorKey((k) => k + 1);
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
	}, [title, detailStore]);

	const overwriteFileName =
		overwriteTargetPath.split(/[/\\]/).filter(Boolean).pop() ??
		overwriteTargetPath;

	const deleteFileName =
		deleteTargetPath.split(/[/\\]/).filter(Boolean).pop() ?? deleteTargetPath;

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

			<Confirm
				open={deleteOpen}
				onOpenChange={(open) => {
					setDeleteOpen(open);
					if (!open) setDeleteTargetPath('');
				}}
				title="删除本地文件？"
				description={
					<>
						确定要删除「{deleteFileName}」吗？此操作不可撤销。
						<div className="mt-2 block break-all text-xs opacity-80">
							{deleteTargetPath}
						</div>
					</>
				}
				descriptionClassName="text-left"
				confirmText="删除"
				confirmVariant="destructive"
				closeOnConfirm={false}
				onConfirm={onConfirmDelete}
			/>

			<ScrollArea className="w-full h-full overflow-y-auto p-5 pt-0 rounded-none">
				<MarkdownEditor
					key={editorKey}
					className="w-full h-full"
					height="calc(100vh - 172px)"
					theme={theme === 'black' ? 'vs-dark' : 'vs'}
					onChange={getValue}
					toolbar={
						<div className="flex items-center pr-3 gap-4">
							<Button
								variant="link"
								className="flex items-center gap-1 px-0 has-[>svg]:px-0"
								onClick={onDraft}
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
								onClick={onDelete}
							>
								<LayersPlus />
								<span className="mt-0.5">删除</span>
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
		</div>
	);
};

export default Knowledge;
