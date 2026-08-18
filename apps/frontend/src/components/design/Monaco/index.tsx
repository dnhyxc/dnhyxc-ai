import Loading from '@design/Loading';
import { lazy, Suspense } from 'react';
import { cn } from '@/lib/utils';
import type { MarkdownEditorProps } from './MonacoEditor';

export type {
	MarkdownEditorProps,
	MarkdownEditorT,
	MarkdownEditorWordWrap,
} from './MonacoEditor';
export { MARKDOWN_EDITOR_WORD_WRAP_COLUMN } from './options';

/** 打开编辑器时再拉 @monaco-editor/react（及随之而来的 monaco-editor） */
const MonacoEditor = lazy(() => import('./MonacoEditor'));

export default function MarkdownEditor(props: MarkdownEditorProps) {
	return (
		<Suspense
			fallback={
				// 仅 loading 时占位；加载完成后由 MonacoEditor 自己吃 height，避免双层 height 撑不满
				<div
					className={cn(
						'rounded-md min-h-0 min-w-0 w-full bg-theme-background h-[calc(100vh-130px)]',
					)}
				>
					<Loading className="flex h-full w-full items-center justify-center" />
				</div>
			}
		>
			<MonacoEditor {...props} className="h-[calc(100vh-130px)]" />
		</Suspense>
	);
}
