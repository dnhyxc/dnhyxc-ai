import { type NodeViewProps, NodeViewWrapper } from '@tiptap/react';
import { NotebookPen } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Input } from '@/components/ui';
import { zhCN } from '../locale';
import { focusAfterTitle } from './TitleNode';

/**
 * 原生 input 编辑标题。
 * 中文 IME：组字期间不写 attrs，避免受控重渲染把拼音一起提交进框。
 */
export default function TitleView({
	node,
	updateAttributes,
	editor,
}: NodeViewProps) {
	const composing = useRef(false);
	const [value, setValue] = useState(String(node.attrs.value ?? ''));

	useEffect(() => {
		if (composing.current) return;
		setValue(String(node.attrs.value ?? ''));
	}, [node.attrs.value]);

	const commit = (next: string) => {
		setValue(next);
		if (!composing.current) updateAttributes({ value: next });
	};

	return (
		<NodeViewWrapper
			as="div"
			className="flex flex-col gap-2 mb-2"
			contentEditable={false}
		>
			<div className="relative flex flex-col gap-2 p-3 pt-9 border border-theme/5 bg-theme/5 rounded-md">
				<div className="absolute -inset-0.5 bg-theme/20 border border-theme/5 text-theme/80 rounded-tl-md rounded-br-md pl-3 py-3.5 w-26 h-6 flex items-center gap-2">
					<NotebookPen className="size-4" />
					<span className="text-sm font-medium pb-0.5">笔记标题</span>
				</div>
				<Input
					className="h-12 size-full px-0 py-0 md:text-xl rounded-none border-0 bg-transparent pr-2 text-textcolor shadow-none placeholder:text-lg placeholder:text-textcolor/35 focus-visible:border-0 focus-visible:ring-0"
					value={value}
					placeholder={zhCN.placeholderHeadingHint}
					maxLength={100}
					// 不进 Tab 序，避免正文按 Tab 时焦点跳到标题
					tabIndex={-1}
					onMouseDown={(e) => e.stopPropagation()}
					onCompositionStart={() => {
						composing.current = true;
					}}
					onCompositionEnd={(e) => {
						composing.current = false;
						commit(e.currentTarget.value);
					}}
					onChange={(e) => commit(e.target.value)}
					onKeyDown={(e) => {
						if (e.nativeEvent.isComposing) return;
						if (e.key === 'Enter' || e.key === 'Tab') {
							e.preventDefault();
							focusAfterTitle(editor);
						}
					}}
				/>
			</div>
			{/* <div className="h-2 w-full rounded-md bg-theme/10" /> */}
		</NodeViewWrapper>
	);
}
