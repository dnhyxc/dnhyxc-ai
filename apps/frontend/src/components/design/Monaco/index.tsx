import Editor, { type OnMount } from '@monaco-editor/react';
import { useRef } from 'react';
import { cn } from '@/lib/utils';
import { options } from './options';

interface MarkdownEditorProps {
	value?: string;
	onChange?: (value: string) => void;
	placeholder?: string;
	className?: string;
	height?: string;
	readOnly?: boolean;
	theme?: 'vs' | 'vs-dark' | 'hc-black';
	language?: string;
}

const MarkdownEditor: React.FC<MarkdownEditorProps> = ({
	value = '',
	onChange,
	placeholder = '# 输入内容...',
	className,
	height = '300px',
	readOnly = false,
	theme = 'vs',
	language = 'markdown',
}) => {
	const editorRef = useRef<Parameters<OnMount>[0] | null>(null);

	const handleEditorMount: OnMount = (editor, monaco) => {
		editorRef.current = editor;

		editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyB, () => {
			editor.trigger('keyboard', 'editor.action.commentLine', null);
		});

		editor.onDidChangeModelContent(() => {
			console.log('editor.getValue()', editor.getValue());
			onChange?.(editor.getValue());
		});

		editor.focus();
	};

	return (
		<div
			className={cn(
				'rounded-md overflow-hidden bg-theme-background',
				className,
			)}
		>
			<div
				className={cn(
					'flex items-center gap-2 p-2 bg-theme-background border-b border-theme/10',
				)}
			>
				<div className="text-sm font-medium text-textcolor">{language}</div>
			</div>
			<Editor
				height={height}
				language={language}
				value={value}
				onChange={(val) => onChange?.(val || '')}
				theme={theme}
				onMount={handleEditorMount}
				options={{ ...options, readOnly, placeholder }}
				loading={
					<div className="flex items-center justify-center w-full h-full text-textcolor bg-theme-background/20">
						Loading...
					</div>
				}
			/>
		</div>
	);
};

export default MarkdownEditor;
