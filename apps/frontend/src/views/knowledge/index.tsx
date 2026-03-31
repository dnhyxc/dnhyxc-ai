import { ScrollArea } from '@ui/scroll-area';
import { Toast } from '@ui/sonner';
import { Layers2, LayersPlus, LibraryBig, ScrollText } from 'lucide-react';
import { useCallback, useState } from 'react';
import MarkdownEditor from '@/components/design/Monaco';
import { Button, Input } from '@/components/ui';
import { useTheme } from '@/hooks';
import { saveKnowledge } from '@/service';
import useStore from '@/store';
import {
	formatTauriInvokeError,
	invokeSaveKnowledgeMarkdown,
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

	const getValue = (value: string) => {
		setMarkdown(value);
		detailStore.setMarkdown(value);
	};

	const onDraft = () => {
		console.log('草稿');
	};

	const onSave = useCallback(async () => {
		const content = detailStore.markdown ?? '';
		const trimmedTitle = title.trim();
		if (!trimmedTitle) return Toast({ type: 'warning', title: '请先输入标题' });
		if (!content) return Toast({ type: 'warning', title: '请先输入内容' });
		try {
			if (isTauriRuntime()) {
				const result = await invokeSaveKnowledgeMarkdown({
					title: trimmedTitle,
					content,
					filePath: `/Users/dnhyxc/Documents/code/dnhyxc-ai/knowledge`,
					// 可选：传目录或完整 .md 路径，例如 filePath: '/你的路径/knowledge'
				});
				if (result.success === 'success') {
					Toast({ type: 'success', title: '文件已保存' });
				} else {
					Toast({ type: 'error', title: result.message || '保存失败' });
				}
				return;
			}
			const res = await saveKnowledge({
				title: trimmedTitle || undefined,
				content,
			});
			const name = res.data?.filename ?? '';
			Toast({
				type: 'success',
				title: name ? `已保存：${name}` : '已保存',
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
	}, [title]);

	return (
		<div className="w-full h-full flex flex-col justify-center items-center m-0">
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
