import Editor, { type OnMount } from '@monaco-editor/react';
import { useCallback, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

interface MarkdownEditorProps {
	value?: string;
	onChange?: (value: string) => void;
	placeholder?: string;
	className?: string;
	height?: string;
	readOnly?: boolean;
	theme?: 'vs' | 'vs-dark' | 'hc-black';
}

const MarkdownEditor: React.FC<MarkdownEditorProps> = ({
	value = '',
	onChange,
	placeholder = '# 输入内容...',
	className,
	height = '400px',
	readOnly = false,
	theme = 'vs-dark',
}) => {
	const editorRef = useRef<Parameters<OnMount>[0] | null>(null);
	const [isFullscreen, setIsFullscreen] = useState(false);

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

	const handleFullscreen = useCallback(() => {
		if (!editorRef.current) return;

		if (!isFullscreen) {
			editorRef.current.layout({
				width: window.innerWidth,
				height: window.innerHeight,
			});
		} else {
			editorRef.current.layout();
		}
		setIsFullscreen(!isFullscreen);
	}, [isFullscreen]);

	return (
		<div
			className={cn(
				'border border-border rounded-md overflow-hidden bg-background',
				isFullscreen && 'fixed inset-0 z-50',
				className,
			)}
		>
			<div
				className={cn(
					'flex items-center gap-2 p-2 bg-muted/50 border-b border-border',
					isFullscreen && 'fixed top-0 left-0 right-0 z-50',
				)}
			>
				<div className="text-sm font-medium text-muted-foreground">
					Markdown
				</div>
				<div className="flex-1" />
				<button
					type="button"
					onClick={handleFullscreen}
					className="px-2 py-1 text-xs rounded hover:bg-accent transition-colors"
				>
					{isFullscreen ? '退出全屏' : '全屏'}
				</button>
			</div>
			<Editor
				height={isFullscreen ? '100vh' : height}
				language="markdown"
				value={value}
				onChange={(val) => onChange?.(val || '')}
				theme={theme}
				onMount={handleEditorMount}
				options={{
					readOnly,
					placeholder,
					minimap: { enabled: false },
					fontSize: 14,
					lineHeight: 22,
					fontFamily: '"SF Mono", "Monaco", "Menlo", "Consolas", monospace',
					fontLigatures: true,
					lineNumbers: 'on',
					wordWrap: 'on',
					scrollBeyondLastLine: false,
					automaticLayout: true,
					padding: { top: 10, bottom: 10 },
					quickSuggestions: false,
					suggestOnTriggerCharacters: false,
					wordBasedSuggestions: 'off',
					parameterHints: { enabled: false },
					snippetSuggestions: 'none',
					cursorBlinking: 'smooth',
					cursorSmoothCaretAnimation: 'on',
					renderLineHighlight: 'none',
					hideCursorInOverviewRuler: true,
					overviewRulerBorder: false,
					scrollbar: {
						vertical: 'visible',
						horizontal: 'visible',
						verticalScrollbarSize: 8,
						horizontalScrollbarSize: 8,
					},
				}}
				loading={
					<div className="flex items-center justify-center h-full text-muted-foreground text-sm">
						加载中...
					</div>
				}
			/>
		</div>
	);
};

export default MarkdownEditor;
