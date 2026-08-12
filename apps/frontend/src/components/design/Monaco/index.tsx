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
	const { height = '300px', className } = props;
	return (
		<Suspense
			fallback={
				// 仅 loading 时占位；加载完成后由 MonacoEditor 自己吃 height，避免双层 height 撑不满
				<div
					className={cn('min-h-0 min-w-0 w-full bg-theme/5 ', className)}
					style={{ height }}
				>
					<Loading className="flex h-full w-full items-center justify-center" />
				</div>
			}
		>
			<MonacoEditor {...props} />
		</Suspense>
	);
}
