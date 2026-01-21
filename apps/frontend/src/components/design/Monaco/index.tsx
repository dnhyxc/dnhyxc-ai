import Editor, { type OnMount } from '@monaco-editor/react';
import { useRef } from 'react';
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
	theme = 'vs',
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
				'border border-theme/20 rounded-md overflow-hidden bg-theme-background',
				className,
			)}
		>
			<div
				className={cn(
					'flex items-center gap-2 p-2 bg-theme-background border-b border-border',
				)}
			>
				<div className="text-sm font-medium text-textcolor">Markdown</div>
			</div>
			<Editor
				height={height}
				language="markdown"
				value={value}
				onChange={(val) => onChange?.(val || '')}
				theme={theme}
				onMount={handleEditorMount}
				options={{
					readOnly, // 是否只读
					placeholder, // 占位文本
					minimap: { enabled: false }, // 关闭右侧缩略图
					fontSize: 14, // 字号
					lineHeight: 22, // 行高
					fontFamily:
						'Fira Code, "SF Mono", "Monaco", "Menlo", "Consolas", monospace', // 字体
					fontLigatures: true, // 启用连字
					lineNumbers: 'on', // 显示行号
					wordWrap: 'on', // 自动换行
					colorDecorators: true, // 呈现内联色彩装饰器和颜色选择器
					scrollBeyondLastLine: false, // 禁止滚动到最后一行之后
					automaticLayout: true, // 自动调整布局
					padding: { top: 10, bottom: 10 }, // 上下内边距
					quickSuggestions: false, // 禁用快速建议
					suggestOnTriggerCharacters: false, // 禁用触发字符建议
					tabSize: 2, // 缩进大小
					folding: true, // 是否启用代码折叠
					foldingHighlight: true, // 折叠时是否高亮
					foldingStrategy: 'indentation', // 代码折叠策略，使用缩进方式
					wordBasedSuggestions: 'allDocuments', // 关闭基于单词的建议
					parameterHints: { enabled: false }, // 关闭参数提示
					snippetSuggestions: 'inline', // 代码片段建议显示方式：inline（内联）
					cursorBlinking: 'smooth', // 光标平滑闪烁
					cursorSmoothCaretAnimation: 'off', // 启用光标平滑动画
					renderLineHighlight: 'line', // 高亮当前行
					hideCursorInOverviewRuler: true, // 在概览标尺中隐藏光标
					overviewRulerBorder: false, // 关闭概览标尺边框
					scrollbar: {
						vertical: 'visible', // 垂直滚动条可见
						horizontal: 'visible', // 水平滚动条可见
						verticalScrollbarSize: 8, // 垂直滚动条宽度
						horizontalScrollbarSize: 8, // 水平滚动条高度
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
