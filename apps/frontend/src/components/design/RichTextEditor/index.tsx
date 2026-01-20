import { createPopper, flip, offset } from '@popperjs/core';
import Blockquote from '@tiptap/extension-blockquote';
import BulletList from '@tiptap/extension-bullet-list';
import Code from '@tiptap/extension-code';
import Color from '@tiptap/extension-color';
import Highlight from '@tiptap/extension-highlight';
import Image from '@tiptap/extension-image';
import Link from '@tiptap/extension-link';
import OrderedList from '@tiptap/extension-ordered-list';
import Placeholder from '@tiptap/extension-placeholder';
import TextAlign from '@tiptap/extension-text-align';
import { FontSize, TextStyle } from '@tiptap/extension-text-style';
import Underline from '@tiptap/extension-underline';
import { Editor, EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import {
	AlignCenter,
	AlignJustify,
	AlignLeft,
	AlignRight,
	Bold,
	ChevronDown,
	Code as CodeIcon,
	Highlighter,
	Image as ImageIcon,
	Italic,
	Link as LinkIcon,
	List,
	ListOrdered,
	Minus,
	Quote,
	Redo,
	Strikethrough,
	Underline as UnderlineIcon,
	Undo,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';

interface RichTextEditorProps {
	content?: string;
	onChange?: (content: string) => void;
	placeholder?: string;
	className?: string;
}

const headingLevels = [
	{ level: 0, label: '正文', className: 'text-sm' },
	{ level: 1, label: 'H1', className: 'text-2xl font-bold' },
	{ level: 2, label: 'H2', className: 'text-xl font-bold' },
	{ level: 3, label: 'H3', className: 'text-lg font-semibold' },
];

interface CommandItem {
	title: string;
	description: string;
	icon: string;
	command: (editor: Editor) => void;
}

const COMMAND_ITEMS: CommandItem[] = [
	{
		title: '文本',
		description: '普通段落文本',
		icon: 'P',
		command: (e) => e.chain().focus().setParagraph().run(),
	},
	{
		title: '标题 1',
		description: '大标题',
		icon: 'H1',
		command: (e) => e.chain().focus().toggleHeading({ level: 1 }).run(),
	},
	{
		title: '标题 2',
		description: '中标题',
		icon: 'H2',
		command: (e) => e.chain().focus().toggleHeading({ level: 2 }).run(),
	},
	{
		title: '标题 3',
		description: '小标题',
		icon: 'H3',
		command: (e) => e.chain().focus().toggleHeading({ level: 3 }).run(),
	},
	{
		title: '无序列表',
		description: '项目符号列表',
		icon: '•',
		command: (e) => e.chain().focus().toggleBulletList().run(),
	},
	{
		title: '有序列表',
		description: '数字编号列表',
		icon: '1.',
		command: (e) => e.chain().focus().toggleOrderedList().run(),
	},
	{
		title: '引用',
		description: '引用内容',
		icon: '"',
		command: (e) => e.chain().focus().toggleBlockquote().run(),
	},
	{
		title: '代码块',
		description: '代码块',
		icon: '{ }',
		command: (e) => e.chain().focus().toggleCodeBlock().run(),
	},
];

const RichTextEditor: React.FC<RichTextEditorProps> = ({
	content = '',
	onChange,
	placeholder = "输入 '/' 唤起命令菜单...",
	className,
}) => {
	const [linkUrl, setLinkUrl] = useState('');
	const [showLinkInput, setShowLinkInput] = useState(false);
	const [imageUrl, setImageUrl] = useState('');
	const [showImageInput, setShowImageInput] = useState(false);
	const [showHeadingDropdown, setShowHeadingDropdown] = useState(false);
	const [showCommandMenu, setShowCommandMenu] = useState(false);
	const [selectedIndex, setSelectedIndex] = useState(0);
	const headingRef = useRef<HTMLDivElement>(null);
	const commandMenuRef = useRef<HTMLDivElement>(null);
	const popperRef = useRef<any>(null);

	const editor = useEditor({
		extensions: [
			StarterKit.configure({
				heading: { levels: [1, 2, 3] },
				code: false,
			}),
			Placeholder.configure({ placeholder }),
			Code.configure({
				HTMLAttributes: {
					class:
						'px-1.5 py-0.5 bg-theme/10 text-theme rounded font-mono text-sm',
				},
			}),
			Image.configure({ HTMLAttributes: { class: 'rounded-md max-w-full' } }),
			Link.configure({
				openOnClick: false,
				HTMLAttributes: { class: 'text-theme underline cursor-pointer' },
			}),
			Underline,
			TextAlign.configure({ types: ['heading', 'paragraph'] }),
			Highlight.configure({
				HTMLAttributes: {
					class: 'bg-yellow-200 dark:bg-yellow-800 px-0.5 rounded',
				},
			}),
			BulletList.configure({
				HTMLAttributes: { class: 'list-disc list-inside ml-4 space-y-1' },
			}),
			OrderedList.configure({
				HTMLAttributes: { class: 'list-decimal list-inside ml-4 space-y-1' },
			}),
			TextStyle,
			FontSize,
			Color,
			Blockquote.configure({
				HTMLAttributes: { class: 'border-l-4 border-theme/30 pl-4 italic' },
			}),
		],
		content,
		editorProps: {
			attributes: {
				class:
					'prose prose-sm max-w-none p-4 min-h-40 focus:outline-none [&ul]:list-disc [&ul]:list-inside [&ul]:ml-4 [&ul]:space-y-1 [&ol]:list-decimal [&ol]:list-inside [&ol]:ml-4 [&ol]:space-y-1 [&>hr]:my-4 [&>hr]:border-theme/20 [&>hr]:border-t [&>h1]:text-2xl [&>h1]:font-bold [&>h1]:mb-3 [&>h2]:text-xl [&>h2]:font-bold [&>h2]:mb-2 [&>h3]:text-lg [&>h3]:font-semibold [&>h3]:mb-2',
			},
		},
		onUpdate: ({ editor: e }) => onChange?.(e.getHTML()),
	});

	const addImage = useCallback(() => {
		if (imageUrl && editor) {
			editor.chain().focus().setImage({ src: imageUrl }).run();
			setImageUrl('');
			setShowImageInput(false);
		}
	}, [editor, imageUrl]);

	const addLink = useCallback(() => {
		if (linkUrl && editor) {
			editor.chain().focus().setLink({ href: linkUrl }).run();
			setLinkUrl('');
			setShowLinkInput(false);
		}
	}, [editor, linkUrl]);

	const getCurrentHeading = useCallback(() => {
		if (!editor) return 0;
		for (let i = 1; i <= 3; i++) {
			if (editor.isActive('heading', { level: i })) return i;
		}
		return 0;
	}, [editor]);

	const setHeading = useCallback(
		(level: number) => {
			if (!editor) return;
			const { to } = editor.state.selection;
			if (level === 0) {
				editor.chain().focus().setParagraph().unsetMark('textStyle').run();
			} else {
				editor
					.chain()
					.focus()
					.toggleHeading({ level: level as 1 | 2 | 3 })
					.unsetMark('textStyle')
					.run();
			}
			editor.commands.setTextSelection(to);
			setShowHeadingDropdown(false);
		},
		[editor],
	);

	const handleCommand = useCallback(
		(item: CommandItem) => {
			if (!editor) return;
			const { from } = editor.state.selection;
			if (from > 0) {
				const tr = editor.state.tr.delete(from - 1, from);
				editor.view.dispatch(tr);
			}
			item.command(editor);
			setShowCommandMenu(false);
			setTimeout(() => editor.commands.focus(), 10);
		},
		[editor],
	);

	const showMenu = useCallback(() => {
		if (!editor) return;
		setSelectedIndex(0);
		setShowCommandMenu(true);
		setTimeout(() => {
			if (commandMenuRef.current && editor) {
				const domSelection = window.getSelection();
				let rect: DOMRect = {
					top: 100,
					left: 100,
					right: 200,
					bottom: 120,
					width: 100,
					height: 20,
					x: 100,
					y: 100,
					toJSON: () => ({}),
				};
				if (domSelection && domSelection.rangeCount > 0) {
					const range = domSelection.getRangeAt(0);
					const clientRect = range.getBoundingClientRect();
					if (clientRect.width > 0) {
						rect = {
							top: clientRect.top,
							left: clientRect.left,
							right: clientRect.right,
							bottom: clientRect.bottom,
							width: clientRect.width,
							height: clientRect.height,
							x: clientRect.x,
							y: clientRect.y,
							toJSON: () => ({}),
						};
					}
				}
				if (popperRef.current) popperRef.current.destroy();
				popperRef.current = createPopper(
					{ getBoundingClientRect: () => rect } as any,
					commandMenuRef.current,
					{
						placement: 'bottom-start',
						modifiers: [
							{ name: 'offset', options: { offset: [0, 8] } },
							{ name: 'flip', options: { fallbackPlacements: ['top-start'] } },
						],
					},
				);
			}
		}, 0);
	}, [editor]);

	const hideMenu = useCallback(() => {
		setShowCommandMenu(false);
		if (popperRef.current) {
			popperRef.current.destroy();
			popperRef.current = null;
		}
	}, []);

	useEffect(() => {
		if (!editor) return;
		const handleKeyDown = (event: KeyboardEvent) => {
			if (event.key === '/' && !showCommandMenu) {
				const { from } = editor.state.selection;
				if (from > 0) {
					const textBefore = editor.state.doc.textBetween(
						Math.max(0, from - 1),
						from,
					);
					if (!textBefore || textBefore === ' ') {
						event.preventDefault();
						showMenu();
						return;
					}
				}
			}
			if (!showCommandMenu) return;
			if (event.key === 'Escape') {
				event.preventDefault();
				hideMenu();
				return;
			}
			if (event.key === 'ArrowUp') {
				event.preventDefault();
				setSelectedIndex((prev) =>
					prev > 0 ? prev - 1 : COMMAND_ITEMS.length - 1,
				);
				return;
			}
			if (event.key === 'ArrowDown') {
				event.preventDefault();
				setSelectedIndex((prev) =>
					prev < COMMAND_ITEMS.length - 1 ? prev + 1 : 0,
				);
				return;
			}
			if (event.key === 'Enter') {
				event.preventDefault();
				handleCommand(COMMAND_ITEMS[selectedIndex]);
				return;
			}
		};
		document.addEventListener('keydown', handleKeyDown);
		return () => {
			document.removeEventListener('keydown', handleKeyDown);
			hideMenu();
		};
	}, [editor, showMenu, hideMenu, handleCommand, selectedIndex]);

	useEffect(() => {
		if (!showHeadingDropdown) return;
		const handleClickOutside = (e: MouseEvent) => {
			if (headingRef.current && !headingRef.current.contains(e.target as Node))
				setShowHeadingDropdown(false);
		};
		document.addEventListener('mousedown', handleClickOutside);
		return () => document.removeEventListener('mousedown', handleClickOutside);
	}, [showHeadingDropdown]);

	const ToolbarButton: React.FC<{
		onClick: () => void;
		isActive?: boolean;
		children: React.ReactNode;
		title?: string;
	}> = ({ onClick, isActive, children, title }) => (
		<button
			type="button"
			onClick={onClick}
			title={title}
			className={`p-1.5 rounded hover:bg-theme/10 transition-colors ${isActive ? 'bg-theme/20 text-theme' : ''}`}
		>
			{children}
		</button>
	);

	if (!editor) return null;

	return (
		<div
			className={`border border-theme/20 rounded-md overflow-hidden ${className || ''}`}
		>
			<div className="flex flex-wrap items-center gap-0.5 p-2 bg-theme-background/50 border-b border-theme/10">
				<ToolbarButton
					onClick={() => editor.chain().focus().undo().run()}
					title="撤销"
				>
					<Undo />
				</ToolbarButton>
				<ToolbarButton
					onClick={() => editor.chain().focus().redo().run()}
					title="重做"
				>
					<Redo />
				</ToolbarButton>
				<div className="w-px h-5 bg-theme/20 mx-1" />

				<div className="relative" ref={headingRef}>
					<button
						type="button"
						onClick={() => setShowHeadingDropdown(!showHeadingDropdown)}
						className="flex items-center gap-1 px-2 py-1.5 rounded hover:bg-theme/10 transition-colors text-sm"
					>
						<span>
							{headingLevels.find((h) => h.level === getCurrentHeading())
								?.label || '正文'}
						</span>
						<ChevronDown className="w-4 h-4" />
					</button>
					{showHeadingDropdown && (
						<div className="absolute top-full left-0 mt-1 py-1 bg-background border border-theme/20 rounded-md shadow-lg z-10 min-w-32">
							{headingLevels.map((h) => (
								<button
									type="button"
									key={h.level}
									onClick={() => setHeading(h.level)}
									className={`w-full px-3 py-1.5 text-left hover:bg-theme/10 transition-colors ${getCurrentHeading() === h.level ? 'bg-theme/10 text-theme' : ''} ${h.className}`}
								>
									{h.label}
								</button>
							))}
						</div>
					)}
				</div>

				<div className="w-px h-5 bg-theme/20 mx-1" />
				<ToolbarButton
					onClick={() => editor.chain().focus().toggleBold().run()}
					isActive={editor.isActive('bold')}
					title="加粗"
				>
					<Bold className="w-4 h-4" />
				</ToolbarButton>
				<ToolbarButton
					onClick={() => editor.chain().focus().toggleItalic().run()}
					isActive={editor.isActive('italic')}
					title="斜体"
				>
					<Italic className="w-4 h-4" />
				</ToolbarButton>
				<ToolbarButton
					onClick={() => editor.chain().focus().toggleUnderline().run()}
					isActive={editor.isActive('underline')}
					title="下划线"
				>
					<UnderlineIcon className="w-4 h-4" />
				</ToolbarButton>
				<ToolbarButton
					onClick={() => editor.chain().focus().toggleStrike().run()}
					isActive={editor.isActive('strike')}
					title="删除线"
				>
					<Strikethrough className="w-4 h-4" />
				</ToolbarButton>
				<ToolbarButton
					onClick={() => editor.chain().focus().toggleCode().run()}
					isActive={editor.isActive('code')}
					title="行内代码"
				>
					<CodeIcon className="w-4 h-4" />
				</ToolbarButton>
				<ToolbarButton
					onClick={() => editor.chain().focus().toggleHighlight().run()}
					isActive={editor.isActive('highlight')}
					title="高亮"
				>
					<Highlighter className="w-4 h-4" />
				</ToolbarButton>

				<div className="w-px h-5 bg-theme/20 mx-1" />
				<ToolbarButton
					onClick={() => editor.chain().focus().setTextAlign('left').run()}
					isActive={editor.isActive({ textAlign: 'left' })}
					title="左对齐"
				>
					<AlignLeft className="w-4 h-4" />
				</ToolbarButton>
				<ToolbarButton
					onClick={() => editor.chain().focus().setTextAlign('center').run()}
					isActive={editor.isActive({ textAlign: 'center' })}
					title="居中"
				>
					<AlignCenter className="w-4 h-4" />
				</ToolbarButton>
				<ToolbarButton
					onClick={() => editor.chain().focus().setTextAlign('right').run()}
					isActive={editor.isActive({ textAlign: 'right' })}
					title="右对齐"
				>
					<AlignRight className="w-4 h-4" />
				</ToolbarButton>
				<ToolbarButton
					onClick={() => editor.chain().focus().setTextAlign('justify').run()}
					isActive={editor.isActive({ textAlign: 'justify' })}
					title="两端对齐"
				>
					<AlignJustify className="w-4 h-4" />
				</ToolbarButton>

				<div className="w-px h-5 bg-theme/20 mx-1" />
				<ToolbarButton
					onClick={() => editor.chain().focus().toggleBulletList().run()}
					isActive={editor.isActive('bulletList')}
					title="无序列表"
				>
					<List className="w-4 h-4" />
				</ToolbarButton>
				<ToolbarButton
					onClick={() => editor.chain().focus().toggleOrderedList().run()}
					isActive={editor.isActive('orderedList')}
					title="有序列表"
				>
					<ListOrdered className="w-4 h-4" />
				</ToolbarButton>
				<ToolbarButton
					onClick={() => editor.chain().focus().toggleBlockquote().run()}
					isActive={editor.isActive('blockquote')}
					title="引用"
				>
					<Quote className="w-4 h-4" />
				</ToolbarButton>
				<ToolbarButton
					onClick={() => editor.chain().focus().setHorizontalRule().run()}
					title="分割线"
				>
					<Minus className="w-4 h-4" />
				</ToolbarButton>

				<div className="w-px h-5 bg-theme/20 mx-1" />

				<div className="relative">
					<ToolbarButton
						onClick={() => setShowLinkInput(!showLinkInput)}
						isActive={editor.isActive('link')}
						title="链接"
					>
						<LinkIcon className="w-4 h-4" />
					</ToolbarButton>
					{showLinkInput && (
						<div className="absolute top-full left-0 mt-1 p-2 bg-background border border-theme/20 rounded-md shadow-lg z-2 flex gap-1">
							<input
								type="url"
								value={linkUrl}
								onChange={(e) => setLinkUrl(e.target.value)}
								placeholder="输入链接地址"
								className="px-2 py-1 border border-theme/20 rounded text-sm w-40"
								onKeyDown={(e) => e.key === 'Enter' && addLink()}
							/>
							<button
								type="button"
								onClick={addLink}
								className="px-2 py-1 bg-theme text-white rounded text-sm hover:bg-theme/80"
							>
								确认
							</button>
						</div>
					)}
				</div>

				<div className="relative">
					<ToolbarButton
						onClick={() => setShowImageInput(!showImageInput)}
						title="图片"
					>
						<ImageIcon className="w-4 h-4" />
					</ToolbarButton>
					{showImageInput && (
						<div className="absolute top-full left-0 mt-1 p-2 bg-background border border-theme/20 rounded-md shadow-lg z-10 flex gap-1">
							<input
								type="url"
								value={imageUrl}
								onChange={(e) => setImageUrl(e.target.value)}
								placeholder="输入图片地址"
								className="px-2 py-1 border border-theme/20 rounded text-sm w-40"
								onKeyDown={(e) => e.key === 'Enter' && addImage()}
							/>
							<button
								type="button"
								onClick={addImage}
								className="px-2 py-1 bg-theme text-white rounded text-sm hover:bg-theme/80"
							>
								确认
							</button>
						</div>
					)}
				</div>
			</div>

			{showCommandMenu && (
				<div
					ref={commandMenuRef}
					className="absolute z-50 py-1 bg-background border border-theme/20 rounded-md shadow-lg min-w-48 max-h-64 overflow-y-auto"
				>
					{COMMAND_ITEMS.map((item, index) => (
						<button
							key={item.title}
							type="button"
							onClick={() => handleCommand(item)}
							className={`w-full px-3 py-2 flex items-center gap-2 text-left hover:bg-theme/10 transition-colors ${index === selectedIndex ? 'bg-theme/10 text-theme' : ''}`}
						>
							<span className="text-muted-foreground font-bold w-4">
								{item.icon}
							</span>
							<div>
								<div className="text-sm">{item.title}</div>
								<div className="text-xs text-muted-foreground">
									{item.description}
								</div>
							</div>
						</button>
					))}
				</div>
			)}

			<EditorContent
				editor={editor}
				className="prose prose-sm max-w-none min-h-40 focus:outline-none"
			/>
		</div>
	);
};

export default RichTextEditor;
