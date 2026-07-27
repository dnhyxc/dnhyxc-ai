import { NotebookPen } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Input } from '@/components/ui';
import { useI18n } from '@/hooks';
import { cn } from '@/lib/utils';
import { richEditorLocaleOf } from '../locale';

type Props = {
	value: string;
	onChange: (value: string) => void;
	/** Enter / Tab：交给正文 */
	onContinue?: () => void;
	className?: string;
};

/**
 * 笔记标题外观（徽章 + 输入 + 字数）。
 * TipTap Title NodeView 与长文窗外标题共用，避免两套 UI。
 */
export function NoteTitleField({
	value,
	onChange,
	onContinue,
	className,
}: Props) {
	const { locale, t } = useI18n();
	const editorLocale = richEditorLocaleOf(locale);
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
		<div
			className={cn(
				'rich-editor-note-title flex flex-col gap-2 mb-2',
				className,
			)}
		>
			<div className="relative flex flex-col gap-2 p-3 pr-0 pt-9 border border-theme/5 bg-theme/5 rounded-md">
				<div className="absolute -inset-0.5 bg-theme/20 border border-theme/5 text-theme/80 rounded-tl-md rounded-br-md pl-3 py-3.5 w-26 h-6 flex items-center gap-2">
					<NotebookPen className="size-4" />
					<span className="text-sm font-medium pb-0.5">
						{t('learningNotes.titleBadge')}
					</span>
				</div>
				<Input
					className="h-12 size-full px-0 py-0 text-xl md:text-xl rounded-none border-0 bg-transparent text-textcolor shadow-none placeholder:text-lg placeholder:text-textcolor/35 focus-visible:border-0 focus-visible:ring-0"
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
