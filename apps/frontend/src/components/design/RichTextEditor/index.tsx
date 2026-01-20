import Color from '@tiptap/extension-color';
import Highlight from '@tiptap/extension-highlight';
import Image from '@tiptap/extension-image';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import TextAlign from '@tiptap/extension-text-align';
import { TextStyle } from '@tiptap/extension-text-style';
import Underline from '@tiptap/extension-underline';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import {
	AlignCenter,
	AlignJustify,
	AlignLeft,
	AlignRight,
	Bold,
	Code,
	Heading1,
	Heading2,
	Heading3,
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
import { useCallback, useState } from 'react';
import { cn } from '@/lib/utils';

interface RichTextEditorProps {
	content?: string;
	onChange?: (content: string) => void;
	placeholder?: string;
	className?: string;
}

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

	const editor = useEditor({
		extensions: [
			StarterKit.configure({
				heading: {
					levels: [1, 2, 3],
				},
			}),
			Placeholder.configure({
				placeholder,
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
			Highlight,
			TextStyle,
			Color,
		],
		content,
		editorProps: {
			attributes: {
				class: 'prose prose-sm max-w-none p-4 min-h-40 focus:outline-none',
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
					// disabled={!editor.can().undo()}
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

				<ToolbarButton
					onClick={() =>
						editor.chain().focus().toggleHeading({ level: 1 }).run()
					}
					isActive={editor.isActive('heading', { level: 1 })}
					title="标题1"
				>
					<Heading1 className="w-4 h-4" />
				</ToolbarButton>
				<ToolbarButton
					onClick={() =>
						editor.chain().focus().toggleHeading({ level: 2 }).run()
					}
					isActive={editor.isActive('heading', { level: 2 })}
					title="标题2"
				>
					<Heading2 className="w-4 h-4" />
				</ToolbarButton>
				<ToolbarButton
					onClick={() =>
						editor.chain().focus().toggleHeading({ level: 3 }).run()
					}
					isActive={editor.isActive('heading', { level: 3 })}
					title="标题3"
				>
					<Heading3 className="w-4 h-4" />
				</ToolbarButton>

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
					<Code className="w-4 h-4" />
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
						<div className="absolute top-full left-0 mt-1 p-2 bg-background border border-theme/20 rounded-md shadow-lg z-10 flex gap-1">
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
				className="prose prose-sm max-w-none p-4 min-h-40 focus:outline-none"
			/>
		</div>
	);
};

export default RichTextEditor;
