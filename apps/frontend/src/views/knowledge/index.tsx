import { ScrollArea } from '@ui/scroll-area';
import { Toast } from '@ui/sonner';
import { Layers2, LayersPlus, LibraryBig, ScrollText } from 'lucide-react';
import { useCallback, useState } from 'react';
import Confirm from '@design/Confirm';
import MarkdownEditor from '@/components/design/Monaco';
import { Button, Input } from '@/components/ui';
import { useTheme } from '@/hooks';
import { saveKnowledge } from '@/service';
import useStore from '@/store';
import {
	formatTauriInvokeError,
	invokeResolveKnowledgeMarkdownTarget,
	invokeSaveKnowledgeMarkdown,
	type SaveKnowledgeMarkdownPayload,
} from '@/utils/knowledge-save';

/** 是否在 Tauri 桌面壳内运行（用于直连本地 knowledge 目录） */
function isTauriRuntime(): boolean {
	return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

const Knowledge = () => {
	const [, setMarkdown] = useState('');
	const [title, setTitle] = useState('');
	const { detailStore } = useStore();
	const { theme } = useTheme();

	const [overwriteOpen, setOverwriteOpen] = useState(false);
	const [overwriteTargetPath, setOverwriteTargetPath] = useState('');
	const [pendingSavePayload, setPendingSavePayload] =
		useState<SaveKnowledgeMarkdownPayload | null>(null);

	const getValue = (value: string) => {
		setMarkdown(value);
		detailStore.setMarkdown(value);
	};

	const onDraft = () => {
		console.log('草稿');
	};

	const runTauriSave = useCallback(
		async (payload: SaveKnowledgeMarkdownPayload) => {
			const result = await invokeSaveKnowledgeMarkdown(payload);
			if (result.success === 'success') {
				Toast({ type: 'success', title: '文件已保存', message: result.filePath ? `已保存到：${result.filePath}` : '已保存到默认目录' });
			} else {
				Toast({ type: 'error', title: '保存失败', message: result.message });
			}
		},
		[],
	);

	const onSave = useCallback(async () => {
		const content = detailStore.markdown ?? '';
		const trimmedTitle = title.trim();
		if (!trimmedTitle) return Toast({ type: 'warning', title: '请先输入标题' });
		if (!content) return Toast({ type: 'warning', title: '请先输入内容' });
		try {
			if (isTauriRuntime()) {
				const payload: SaveKnowledgeMarkdownPayload = {
					title: trimmedTitle,
					content,
					// 可选：filePath / dirPath
					filePath: `/Users/dnhyxc/Documents/code/dnhyxc-ai/knowledge`,
				};
				const target = await invokeResolveKnowledgeMarkdownTarget(payload);
				if (!target.exists) {
					await runTauriSave(payload);
					// TODO: 调接口保存到数据库
					return;
				}
				setOverwriteTargetPath(target.path);
				setPendingSavePayload(payload);
				setOverwriteOpen(true);
				return;
			}
			const res = await saveKnowledge({
				title: trimmedTitle || undefined,
				content,
			});
			const name = res.data?.filename ?? '';
			Toast({
				type: 'success',
				title: '文件已保存',
				message: name ? `已保存到：${name}` : '已保存到默认目录',
			});
		} catch (e) {
			if (!isTauriRuntime()) {
				return;
			}
			Toast({
				type: 'error',
				title: formatTauriInvokeError(e),
			});
		}
	}, [title, runTauriSave]);

	const onConfirmOverwrite = useCallback(async () => {
		if (!pendingSavePayload) return;
		try {
			await runTauriSave({ ...pendingSavePayload, overwrite: true });
			// TODO: 调接口保存到数据库
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
					className="w-full h-full"
					height="calc(100vh - 172px)"
					theme={theme === 'black' ? 'vs-dark' : 'vs'}
					onChange={getValue}
					toolbar={
						<div className="flex items-center pr-3 gap-4">
							<Button
								variant="link"
								className="flex items-center gap-0! px-0!"
								onClick={onDraft}
							>
								<LibraryBig />
								<span className="mt-0.5 ml-1">知识库</span>
							</Button>
							<Button
								variant="link"
								className="flex items-center gap-0! px-0!"
								onClick={onDraft}
							>
								<Layers2 />
								<span className="mt-0.5 ml-1">草稿</span>
							</Button>
							<Button
								variant="link"
								className="flex items-center gap-0! px-0!"
								onClick={onSave}
							>
								<LayersPlus />
								<span className="mt-0.5 ml-1">保存</span>
							</Button>
						</div>
					}
					title={
						<div className="flex flex-1 items-center pl-3">
							<ScrollText size={18} />
							<Input
								value={title}
								onChange={(e) => setTitle(e.target.value)}
								placeholder="输入标题..."
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
