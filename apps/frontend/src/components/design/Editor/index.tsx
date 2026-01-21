import Code from '@editorjs/code';
import EditorJS, { type OutputData } from '@editorjs/editorjs';
import Header from '@editorjs/header';
import InlineCode from '@editorjs/inline-code';
import List from '@editorjs/list';
import Marker from '@editorjs/marker';
import Paragraph from '@editorjs/paragraph';
import Table from '@editorjs/table';
import Underline from '@editorjs/underline';
import {
	Bold,
	ChevronDown,
	Code as CodeIcon,
	Highlighter,
	Image as ImageIcon,
	Italic,
	Link as LinkIcon,
	List as ListIcon,
	ListOrdered,
	Minus,
	Quote,
	Strikethrough,
	Underline as UnderlineIcon,
} from 'lucide-react';
import {
	useCallback,
	useEffect,
	useLayoutEffect,
	useRef,
	useState,
} from 'react';
import { Toast } from '@/components/ui/sonner';
import { cn } from '@/lib/utils';

interface EditorProps {
	data?: OutputData;
	onChange?: (data: OutputData) => void;
	placeholder?: string;
	className?: string;
	readOnly?: boolean;
}

const headingLevels = [
	{ level: 1, label: 'H1', className: 'text-2xl font-bold' },
	{ level: 2, label: 'H2', className: 'text-xl font-bold' },
	{ level: 3, label: 'H3', className: 'text-lg font-semibold' },
	{ level: 4, label: 'H4', className: 'text-base font-semibold' },
	{ level: 5, label: 'H5', className: 'text-sm font-semibold' },
];

const Editor: React.FC<EditorProps> = ({
	data,
	onChange,
	placeholder = '开始输入...',
	className,
	readOnly = false,
}) => {
	const editorRef = useRef<EditorJS | null>(null);
	const containerRef = useRef<HTMLDivElement>(null);
	const [showHeadingDropdown, setShowHeadingDropdown] = useState(false);
	const headingRef = useRef<HTMLDivElement>(null);
	const [isReady, setIsReady] = useState(false);
	const initializedRef = useRef(false);

	useLayoutEffect(() => {
		if (initializedRef.current || !containerRef.current) {
			return;
		}

		initializedRef.current = true;

		const initialData = data
			? {
					...data,
					blocks: data.blocks.map((block) => {
						if (block.type === 'header') {
							return {
								...block,
								data: {
									text: block.data.text || '标题',
									level: block.data.level || 2,
								},
							};
						}
						return block;
					}),
				}
			: {
					blocks: [
						{
							type: 'paragraph',
							data: {
								text: '',
							},
						},
					],
				};

		const editor = new EditorJS({
			holder: containerRef.current,
			placeholder,
			readOnly,
			data: initialData,
			tools: {
				header: {
					class: Header as any,
					inlineToolbar: true,
					config: {
						levels: [1, 2, 3, 4, 5],
						defaultLevel: 1,
					},
					toolbox: {
						title: 'H1',
					},
				},
				header2: {
					class: Header as any,
					inlineToolbar: true,
					config: {
						levels: [1, 2, 3, 4, 5],
						defaultLevel: 2,
					},
					toolbox: {
						title: 'H2',
					},
				},
				header3: {
					class: Header as any,
					inlineToolbar: true,
					config: {
						levels: [1, 2, 3, 4, 5],
						defaultLevel: 3,
					},
					toolbox: {
						title: 'H3',
					},
				},
				header4: {
					class: Header as any,
					inlineToolbar: true,
					config: {
						levels: [1, 2, 3, 4, 5],
						defaultLevel: 4,
					},
					toolbox: {
						title: 'H4',
					},
				},
				header5: {
					class: Header as any,
					inlineToolbar: true,
					config: {
						levels: [1, 2, 3, 4, 5],
						defaultLevel: 5,
					},
					toolbox: {
						title: 'H5',
					},
				},
				'inline-code': InlineCode,
				list: List,
				paragraph: Paragraph,
				code: Code,
				marker: Marker,
				// table: {
				// 	class: Table as any,
				// 	inlineToolbar: true,
				// 	config: {
				// 		rows: 2,
				// 		cols: 3,
				// 		maxRows: 5,
				// 		maxCols: 5,
				// 	},
				// },
				underline: Underline,
			},
			inlineToolbar: [
				'bold',
				'italic',
				'underline',
				'inline-code',
				'marker',
				'link',
			],
			i18n: {
				messages: {
					ui: {
						blockTunes: {
							toggler: {
								'Click to tune': '点击转换',
							},
						},
						inlineToolbar: {
							converter: {
								'Convert to': '转换',
							},
						},
						toolbar: {
							toolbox: {
								Add: '工具栏添加',
							},
						},
						popover: {
							Filter: '过滤',
							'Nothing found': '找不到',
						},
					},
					toolNames: {
						Text: '段落',
						Bold: '加粗',
						Italic: '斜体',
					},
					tools: {
						paragraph: {
							'Press Tab': '输入内容',
						},
					},
					blockTunes: {
						delete: {
							Delete: '删除',
						},
						moveUp: {
							'Move up': '上移',
						},
						moveDown: {
							'Move down': '下移',
						},
					},
				},
			},
			onReady: () => {
				editorRef.current = editor;
				setIsReady(true);
			},
			onChange: async () => {
				const content = await editor.save();
				onChange?.(content);
			},
		});

		console.log(editor, 'editor');

		editorRef.current = editor;
	}, [data, onChange, placeholder, readOnly]);

	useEffect(() => {
		return () => {
			const editor = editorRef.current;
			if (editor && isReady) {
				editor.destroy();
				editorRef.current = null;
				setIsReady(false);
				initializedRef.current = false;
			}
		};
	}, [isReady]);

	useEffect(() => {
		if (!showHeadingDropdown) {
			return;
		}
		const handleClickOutside = (e: MouseEvent) => {
			if (
				headingRef.current &&
				!headingRef.current.contains(e.target as Node)
			) {
				setShowHeadingDropdown(false);
			}
		};
		document.addEventListener('mousedown', handleClickOutside);
		return () => document.removeEventListener('mousedown', handleClickOutside);
	}, [showHeadingDropdown]);

	const clearContent = useCallback(async () => {
		if (!editorRef.current) {
			return;
		}
		try {
			await editorRef.current.clear();
			onChange?.({ blocks: [], time: 0, version: '' });
		} catch (error) {
			console.error('清空失败:', error);
		}
	}, [onChange]);

	const insertHeading = useCallback(async (level: number) => {
		if (!editorRef.current) {
			return;
		}
		try {
			await editorRef.current.blocks.insert('header', {
				text: '',
				level,
			});
		} catch (error) {
			console.error('插入标题失败:', error);
		}
	}, []);

	const insertBlock = useCallback(
		async (type: string, blockData?: Record<string, unknown>) => {
			if (!editorRef.current) {
				return;
			}
			try {
				await editorRef.current.blocks.insert(type, blockData);
			} catch (error) {
				console.error('插入块失败:', error);
			}
		},
		[],
	);

	const ToolbarButton: React.FC<{
		onClick: () => void;
		isActive?: boolean;
		disabled?: boolean;
		children: React.ReactNode;
		title?: string;
	}> = ({ onClick, isActive, disabled, children, title }) => (
		<button
			type="button"
			onClick={onClick}
			disabled={disabled}
			title={title}
			className={cn(
				'p-1.5 rounded hover:bg-accent transition-colors disabled:opacity-50 disabled:cursor-not-allowed',
				isActive && 'bg-accent text-foreground',
			)}
		>
			{children}
		</button>
	);

	return (
		<div
			className={cn(
				'border border-border rounded-md overflow-hidden bg-background',
				className,
			)}
		>
			<div className="flex flex-wrap items-center gap-0.5 p-2 bg-muted/50 border-b border-border">
				<div className="relative" ref={headingRef}>
					<button
						type="button"
						onClick={() => setShowHeadingDropdown(!showHeadingDropdown)}
						className="flex items-center gap-1 px-2 py-1.5 rounded hover:bg-accent transition-colors text-sm"
					>
						<span>标题</span>
						<ChevronDown className="w-4 h-4" />
					</button>
					{showHeadingDropdown && (
						<div className="absolute top-full left-0 mt-1 py-1 bg-background border border-border rounded-md shadow-lg z-10 min-w-32">
							{headingLevels.map((heading) => (
								<button
									type="button"
									key={heading.level}
									onClick={() => {
										insertHeading(heading.level);
										setShowHeadingDropdown(false);
									}}
									className={cn(
										'w-full px-3 py-1.5 text-left hover:bg-accent transition-colors',
										heading.className,
									)}
								>
									{heading.label}
								</button>
							))}
						</div>
					)}
				</div>

				<div className="w-px h-5 bg-border mx-1" />

				<ToolbarButton
					onClick={() => insertBlock('paragraph')}
					title="段落"
					disabled={!isReady}
				>
					<span className="text-xs font-medium">P</span>
				</ToolbarButton>

				<div className="w-px h-5 bg-border mx-1" />

				<ToolbarButton
					onClick={() => insertBlock('list', { style: 'unordered' })}
					title="无序列表"
					disabled={!isReady}
				>
					<ListIcon className="w-4 h-4" />
				</ToolbarButton>
				<ToolbarButton
					onClick={() => insertBlock('list', { style: 'ordered' })}
					title="有序列表"
					disabled={!isReady}
				>
					<ListOrdered className="w-4 h-4" />
				</ToolbarButton>
				<ToolbarButton
					onClick={() => insertBlock('quote')}
					title="引用"
					disabled={!isReady}
				>
					<Quote className="w-4 h-4" />
				</ToolbarButton>
				<ToolbarButton
					onClick={() => insertBlock('code')}
					title="代码块"
					disabled={!isReady}
				>
					<CodeIcon className="w-4 h-4" />
				</ToolbarButton>

				<div className="w-px h-5 bg-border mx-1" />

				<ToolbarButton
					onClick={() =>
						Toast({
							type: 'info',
							title: '提示',
							message: '请选中文字后使用格式化工具',
						})
					}
					title="加粗 (快捷键: Ctrl+B)"
				>
					<Bold className="w-4 h-4" />
				</ToolbarButton>
				<ToolbarButton
					onClick={() =>
						Toast({
							type: 'info',
							title: '提示',
							message: '请选中文字后使用格式化工具',
						})
					}
					title="斜体 (快捷键: Ctrl+I)"
				>
					<Italic className="w-4 h-4" />
				</ToolbarButton>
				<ToolbarButton
					onClick={() =>
						Toast({
							type: 'info',
							title: '提示',
							message: '请选中文字后使用格式化工具',
						})
					}
					title="下划线"
				>
					<UnderlineIcon className="w-4 h-4" />
				</ToolbarButton>
				<ToolbarButton
					onClick={() =>
						Toast({
							type: 'info',
							title: '提示',
							message: '请选中文字后使用格式化工具',
						})
					}
					title="删除线"
				>
					<Strikethrough className="w-4 h-4" />
				</ToolbarButton>
				<ToolbarButton
					onClick={() =>
						Toast({
							type: 'info',
							title: '提示',
							message: '请选中文字后使用格式化工具',
						})
					}
					title="行内代码"
				>
					<CodeIcon className="w-4 h-4" />
				</ToolbarButton>
				<ToolbarButton
					onClick={() =>
						Toast({
							type: 'info',
							title: '提示',
							message: '请选中文字后使用格式化工具',
						})
					}
					title="高亮"
				>
					<Highlighter className="w-4 h-4" />
				</ToolbarButton>

				<div className="w-px h-5 bg-border mx-1" />

				<ToolbarButton
					onClick={() =>
						Toast({
							type: 'info',
							title: '提示',
							message: '请选中文字后添加链接',
						})
					}
					title="链接"
				>
					<LinkIcon className="w-4 h-4" />
				</ToolbarButton>
				<ToolbarButton
					onClick={() =>
						Toast({ type: 'info', title: '提示', message: '请输入图片地址' })
					}
					title="图片"
				>
					<ImageIcon className="w-4 h-4" />
				</ToolbarButton>

				<div className="w-px h-5 bg-border mx-1" />

				<ToolbarButton
					onClick={clearContent}
					title="清空内容"
					disabled={!isReady}
				>
					<Minus className="w-4 h-4" />
				</ToolbarButton>
			</div>

			<div
				ref={containerRef}
				className="prose prose-sm max-w-none min-h-[200px] p-4 focus:outline-none"
			/>
		</div>
	);
};

export default Editor;
