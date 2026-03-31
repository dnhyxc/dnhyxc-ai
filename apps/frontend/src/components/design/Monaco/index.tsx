import Editor, { type OnMount } from '@monaco-editor/react';
import { useRef } from 'react';
import { cn } from '@/lib/utils';
import { registerPrettierFormatProviders } from './format';
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
	toolbar: React.ReactNode;
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
	toolbar,
}) => {
	const editorRef = useRef<Parameters<OnMount>[0] | null>(null);

	const handleEditorMount: OnMount = (editor, monaco) => {
		editorRef.current = editor;

		registerPrettierFormatProviders(monaco);

		// 与 VS Code 一致：格式化文档（Format Document）— Windows/Linux: Shift+Alt+F，Mac: Shift+Option+F
		editor.addCommand(
			monaco.KeyMod.Shift | monaco.KeyMod.Alt | monaco.KeyCode.KeyF,
			() => {
				editor.trigger('keyboard', 'editor.action.formatDocument', null);
			},
		);

		editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyB, () => {
			editor.trigger('keyboard', 'editor.action.commentLine', null);
		});

		editor.onDidChangeModelContent(() => {
			onChange?.(editor.getValue());
		});

		editor.focus();
	};

	return (
		<div className={cn('rounded-md overflow-hidden bg-theme/5', className)}>
			<div
				className={cn(
					'flex items-center justify-between h-10 gap-2 border-b border-theme/10',
				)}
			>
				<div className="text-base font-medium text-textcolor pl-3.5">
					{language}
				</div>
				{toolbar ? (
					<div className="flex items-center gap-2">{toolbar}</div>
				) : null}
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
