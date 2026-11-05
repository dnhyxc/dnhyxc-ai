import { NotebookPen } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { cn } from '../../cn';
import { Input } from '../../ui';
import { type RichEditorLocale, zhCN } from '../locale';

type Props = {
	value: string;
	onChange: (value: string) => void;
	/** Enter / Tab：交给正文 */
	onContinue?: () => void;
	className?: string;
	/** 覆盖默认中文文案（含 titleBadge） */
	locale?: Partial<RichEditorLocale>;
};

/**
 * 笔记标题外观（徽章 + 输入 + 字数）。
 * TipTap Title NodeView 与长文窗外标题共用；视觉以 editor.css 为准。
 */
export function NoteTitleField({
	value,
	onChange,
	onContinue,
	className,
	locale: localePartial,
}: Props) {
	const editorLocale = { ...zhCN, ...localePartial };
	const composing = useRef(false);
	const [local, setLocal] = useState(value);

	useEffect(() => {
		if (composing.current) return;
		setLocal(value);
	}, [value]);

	const commit = (next: string) => {
		setLocal(next);
		if (!composing.current) onChange(next);
	};

	return (
		<div className={cn('rich-editor-note-title', className)}>
			<div className="rich-editor-note-title-shell">
				<div className="rich-editor-note-title-badge">
					<NotebookPen aria-hidden />
					<span>{editorLocale.titleBadge}</span>
				</div>
				<Input
					className="rich-editor-note-title-input"
					value={local}
					placeholder={editorLocale.placeholderHeadingHint}
					maxLength={50}
					showCount
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
							onContinue?.();
						}
					}}
				/>
			</div>
		</div>
	);
}
