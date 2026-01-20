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
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Toast } from '@ui/sonner';
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
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

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
	{ level: 4, label: 'H4', className: 'text-base font-semibold' },
	{ level: 5, label: 'H5', className: 'text-sm font-medium' },
];

const fontSizes = [
	{ size: 12, label: '12px' },
	{ size: 14, label: '14px' },
	{ size: 16, label: '16px' },
	{ size: 18, label: '18px' },
	{ size: 20, label: '20px' },
	{ size: 24, label: '24px' },
	{ size: 32, label: '32px' },
];

const RichTextEditor: React.FC<RichTextEditorProps> = ({
	content = '',
	onChange,
	placeholder = '输入内容...',
	className,
}) => {
	const [linkUrl, setLinkUrl] = useState('');
	const [showLinkInput, setShowLinkInput] = useState(false);
	const [imageUrl, setImageUrl] = useState('');
	const [showImageInput, setShowImageInput] = useState(false);
	const [showHeadingDropdown, setShowHeadingDropdown] = useState(false);
	const [showFontSizeDropdown, setShowFontSizeDropdown] = useState(false);
	const headingRef = useRef<HTMLDivElement>(null);
	const fontSizeRef = useRef<HTMLDivElement>(null);

	const editor = useEditor({
		extensions: [
			StarterKit.configure({
				heading: {
					levels: [1, 2, 3, 4, 5],
				},
				blockquote: {},
			}),
			Placeholder.configure({
				placeholder,
			}),
			Code.configure({
				HTMLAttributes: {
					class:
						'px-1.5 py-0.5 bg-theme/10 text-theme rounded font-mono text-sm',
				},
			}),
			Image.configure({
				HTMLAttributes: {
					class: 'rounded-md max-w-full',
				},
			}),
			Link.configure({
				openOnClick: false,
				HTMLAttributes: {
					class: 'text-theme underline cursor-pointer',
				},
			}),
			Underline,
			TextAlign.configure({
				types: ['heading', 'paragraph'],
			}),
			Highlight.configure({
				HTMLAttributes: {
					class: 'bg-yellow-200 dark:bg-yellow-800 px-0.5 rounded',
				},
			}),
			BulletList.configure({
				HTMLAttributes: {
					class: 'list-disc list-inside ml-4 space-y-1',
				},
			}),
			OrderedList.configure({
				HTMLAttributes: {
					class: 'list-decimal list-inside ml-4 space-y-1',
				},
			}),
			TextStyle,
			FontSize,
			Color,
			Blockquote.configure({
				HTMLAttributes: {
					class: 'border-l-4 border-theme/30 pl-4 italic',
				},
			}),
		],
		content,
		editorProps: {
			attributes: {
				class:
					'prose prose-sm max-w-none p-4 min-h-40 focus:outline-none [&ul]:list-disc [&ul]:list-inside [&ul]:ml-4 [&ul]:space-y-1 [&ol]:list-decimal [&ol]:list-inside [&ol]:ml-4 [&ol]:space-y-1 [&>hr]:my-4 [&>hr]:border-theme/20 [&>hr]:border-t [&>h1]:text-2xl [&>h1]:font-bold [&>h1]:mb-3 [&>h2]:text-xl [&>h2]:font-bold [&>h2]:mb-2 [&>h3]:text-lg [&>h3]:font-semibold [&>h3]:mb-2 [&>h4]:text-base [&>h4]:font-semibold [&>h4]:mb-1 [&>h5]:text-sm [&>h5]:font-medium',
			},
		},
		onUpdate: ({ editor: e }) => {
			onChange?.(e.getHTML());
		},
	});

	const addImage = useCallback(() => {
		if (imageUrl) {
			editor?.chain().focus().setImage({ src: imageUrl }).run();
			setImageUrl('');
			setShowImageInput(false);
		}
	}, [editor, imageUrl]);

	const addLink = useCallback(() => {
		if (linkUrl) {
			editor?.chain().focus().setLink({ href: linkUrl }).run();
			setLinkUrl('');
			setShowLinkInput(false);
		}
	}, [editor, linkUrl]);

	const getCurrentHeading = () => {
		for (let i = 1; i <= 5; i++) {
			if (editor?.isActive('heading', { level: i })) {
				return i;
			}
		}
		return 0;
	};

	const getCurrentFontSize = () => {
		const attrs = editor?.getAttributes('textStyle');
		if (!attrs || !attrs.fontSize) {
			return null;
		}
		const fontSize = attrs.fontSize as string;
		return parseInt(fontSize.replace('px', ''), 10);
	};

	const setHeading = (level: number) => {
		if (!editor) return;

		const { to } = editor.state.selection;

		if (level === 0) {
			editor.chain().focus().setParagraph().unsetMark('textStyle').run();
		} else {
			editor
				.chain()
				.focus()
				.toggleHeading({ level: level as 1 | 2 | 3 | 4 | 5 })
				.unsetMark('textStyle')
				.run();
		}

		editor.commands.setTextSelection(to);
		setShowHeadingDropdown(false);
	};

	const setFontSize = (size: number) => {
		if (!editor) return;

		const { from, to } = editor.state.selection;
		if (from === to) {
			Toast({
				type: 'warning',
				title: '请先选中文字',
			});
			return;
		}

		editor
			.chain()
			.focus()
			.setMark('textStyle', { fontSize: `${size}px` })
			.setTextSelection(to)
			.run();

		setShowFontSizeDropdown(false);
	};

	useEffect(() => {
		if (!showHeadingDropdown) return;
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

	useEffect(() => {
		if (!showFontSizeDropdown) return;
		const handleClickOutside = (e: MouseEvent) => {
			if (
				fontSizeRef.current &&
				!fontSizeRef.current.contains(e.target as Node)
			) {
				setShowFontSizeDropdown(false);
			}
		};
		document.addEventListener('mousedown', handleClickOutside);
		return () => document.removeEventListener('mousedown', handleClickOutside);
	}, [showFontSizeDropdown]);

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
				'p-1.5 rounded hover:bg-theme/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed',
				isActive && 'bg-theme/20 text-theme',
			)}
		>
			{children}
		</button>
	);

	if (!editor) {
		return null;
	}

	return (
		<div
			className={cn(
				'border border-theme/20 rounded-md overflow-hidden',
				className,
			)}
		>
			<div className="flex flex-wrap items-center gap-0.5 p-2 bg-theme-background/50 border-b border-theme/10">
				<ToolbarButton
					onClick={() => editor.chain().focus().undo().run()}
					disabled={!editor.can().undo()}
					title="撤销"
				>
					<Undo className="w-4 h-4" />
				</ToolbarButton>
				<ToolbarButton
					onClick={() => editor.chain().focus().redo().run()}
					disabled={!editor.can().redo()}
					title="重做"
				>
					<Redo className="w-4 h-4" />
				</ToolbarButton>

				<div className="w-px h-5 bg-theme/20 mx-1" />

				<div className="relative" ref={headingRef}>
					<button
						type="button"
						onClick={() => setShowHeadingDropdown(!showHeadingDropdown)}
						className="flex items-center gap-1 px-2 py-1.5 rounded hover:bg-theme/10 transition-colors text-sm z-99"
					>
						<span>
							{headingLevels.find((h) => h.level === getCurrentHeading())
								?.label || '正文'}
						</span>
						<ChevronDown className="w-4 h-4" />
					</button>
					{showHeadingDropdown && (
						<div className="absolute top-full left-0 mt-1 py-1 bg-background border border-theme/20 rounded-md shadow-lg z-10 min-w-32">
							<ScrollArea className="h-48">
								{headingLevels.map((heading) => (
									<button
										type="button"
										key={heading.level}
										onClick={() => setHeading(heading.level)}
										className={cn(
											'w-full px-3 py-1.5 text-left hover:bg-theme/10 transition-colors',
											getCurrentHeading() === heading.level &&
												'bg-theme/10 text-theme',
											heading.className,
										)}
									>
										{heading.label}
									</button>
								))}
							</ScrollArea>
						</div>
					)}
				</div>

				<div className="w-px h-5 bg-theme/20 mx-1" />

				<div className="relative" ref={fontSizeRef}>
					<button
						type="button"
						onClick={() => setShowFontSizeDropdown(!showFontSizeDropdown)}
						className="flex items-center gap-1 px-2 py-1.5 rounded hover:bg-theme/10 transition-colors text-sm"
					>
						<span>
							{getCurrentFontSize() ? `${getCurrentFontSize()}px` : '字体'}
						</span>
						<ChevronDown className="w-4 h-4" />
					</button>
					{showFontSizeDropdown && (
						<div className="absolute top-full left-0 mt-1 py-1 bg-theme-background border border-theme/20 rounded-md shadow-lg z-10 min-w-28">
							<ScrollArea className="h-48">
								{fontSizes.map((font) => (
									<button
										type="button"
										key={font.size}
										onClick={() => setFontSize(font.size)}
										className={cn(
											'w-full px-3 py-1.5 text-left hover:bg-theme/10 transition-colors',
											getCurrentFontSize() === font.size &&
												'bg-theme/10 text-theme',
										)}
									>
										{font.label}
									</button>
								))}
							</ScrollArea>
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

			<EditorContent
				editor={editor}
				className="prose prose-sm max-w-none min-h-40 focus:outline-none [&>*:first-child]:p-2.5 [&>*:first-child]:pt-1.5"
			/>
		</div>
	);
};

export default RichTextEditor;
