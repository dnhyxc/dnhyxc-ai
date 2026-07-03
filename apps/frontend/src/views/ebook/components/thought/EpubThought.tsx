import ChatTextArea from '@design/ChatTextArea';
import { Button } from '@ui/index';
import { useEffect, useRef } from 'react';
import { useI18n } from '@/hooks';
import { cn } from '@/lib/utils';
import {
	epubReaderChromeBorderColorClass,
	epubReaderChromeOutlineButtonClass,
	epubReaderChromePrimaryButtonClass,
	epubReaderChromeTextareaClass,
} from '../../utils/epub/reader/epubReaderSettings';
import type { EpubQuoteActionBarProps } from '../selection/EpubQuoteActionBar';
import { EpubThoughtPanelShell } from './EpubThoughtPanelShell';
import {
	EpubThoughtComposeCard,
	EpubThoughtItemCard,
	EpubThoughtQuoteCard,
} from './EpubThoughtParts';

export type EpubThoughtMode = 'create' | 'view' | 'edit';

type Props = {
	onClose: () => void;
	mode: EpubThoughtMode;
	/** 递增时滚到底部并聚焦输入框（含写想法页内再次点「写想法」） */
	scrollToComposeKey?: number;
	quote: string;
	content: string;
	username?: string;
	avatar?: string;
	createdAt?: string;
	updatedAt?: string;
	isPublic?: boolean;
	onContentChange: (value: string) => void;
	onSave: (isPublic: boolean) => void | Promise<void>;
	onDelete?: () => void | Promise<void>;
	onEdit?: () => void;
	saving?: boolean;
	quoteActions?: EpubQuoteActionBarProps | null;
	onQuoteHighlightClick?: () => void;
};

const THOUGHT_TEXTAREA_CLASS = cn(
	'h-full min-h-0 field-sizing-fixed resize-none border-none bg-transparent p-0 shadow-none rounded-none',
	'focus-visible:ring-transparent text-base',
	epubReaderChromeTextareaClass,
);

export function EpubThought({
	onClose,
	mode,
	scrollToComposeKey = 0,
	quote,
	content,
	username,
	avatar,
	createdAt,
	isPublic,
	onContentChange,
	onSave,
	onDelete,
	onEdit,
	saving = false,
	quoteActions,
	onQuoteHighlightClick,
}: Props) {
	const textareaRef = useRef<HTMLTextAreaElement>(null);
	const scrollRef = useRef<HTMLDivElement>(null);

	const { t } = useI18n();
	const readOnly = mode === 'view';
	const displayName = username || t('ebook.read.thought.unknownUser');

	const title =
		mode === 'create'
			? t('ebook.read.thought.createTitle')
			: mode === 'edit'
				? t('ebook.read.thought.editTitle')
				: t('ebook.read.thought.viewTitle');

	const handleSaveFromKeyboard = () => {
		if (!content.trim() || saving) return;
		void onSave(true);
	};

	useEffect(() => {
		if (mode === 'view') return;
		const frame = requestAnimationFrame(() => {
			const el = textareaRef.current;
			if (!el) return;
			el.focus({ preventScroll: true });
			const end = el.value.length;
			el.setSelectionRange(end, end);
		});
		return () => cancelAnimationFrame(frame);
	}, [mode, quote, scrollToComposeKey]);

	return (
		<EpubThoughtPanelShell
			ref={scrollRef}
			footer={
				readOnly ? undefined : (
					<EpubThoughtComposeCard
						username={mode === 'edit' ? displayName : undefined}
						avatar={mode === 'edit' ? avatar : undefined}
						createdAt={mode === 'edit' ? createdAt : undefined}
						isPublic={mode === 'edit' ? isPublic !== false : undefined}
						mode={mode}
						className={mode === 'edit' ? 'pt-3' : undefined}
						actions={
							<>
								<Button
									type="button"
									size="sm"
									variant="outline"
									className={epubReaderChromeOutlineButtonClass}
									disabled={saving}
									onClick={onClose}
								>
									{t('ebook.read.thought.cancel')}
								</Button>
								<Button
									type="button"
									size="sm"
									variant="outline"
									className={epubReaderChromeOutlineButtonClass}
									disabled={!content.trim() || saving}
									onClick={() => void onSave(false)}
								>
									{t('ebook.read.thought.sendPrivate')}
								</Button>
								<Button
									type="button"
									size="sm"
									className={epubReaderChromePrimaryButtonClass}
									disabled={!content.trim() || saving}
									onClick={() => void onSave(true)}
								>
									{t('ebook.read.thought.sendPublic')}
								</Button>
							</>
						}
					>
						<ChatTextArea
							ref={textareaRef}
							input={content}
							setInput={onContentChange}
							sendMessage={handleSaveFromKeyboard}
							loading={saving}
							maxLength={500}
							placeholder={t('ebook.read.thought.placeholder')}
							className={cn(
								'h-full max-h-none border-0 px-3 pt-3',
								mode === 'edit'
									? cn('border-t', epubReaderChromeBorderColorClass)
									: undefined,
							)}
							textareaClassName={THOUGHT_TEXTAREA_CLASS}
						/>
					</EpubThoughtComposeCard>
				)
			}
		>
			<EpubThoughtQuoteCard
				quote={quote}
				title={title}
				onClose={onClose}
				closeMode={mode === 'view' ? 'view' : 'edit'}
				quoteActions={quoteActions}
				onQuoteHighlightClick={onQuoteHighlightClick}
				className={readOnly ? undefined : 'border-b border-theme/10'}
			/>

			{readOnly ? (
				<EpubThoughtItemCard
					username={displayName}
					avatar={avatar}
					createdAt={createdAt}
					isPublic={isPublic !== false}
				>
					<p className="text-textcolor text-sm wrap-break-word">
						{content.trim() || t('ebook.read.thought.empty')}
					</p>
					{onDelete || onEdit ? (
						<div className="mt-6 flex justify-end gap-3">
							{onDelete ? (
								<Button
									type="button"
									variant="outline"
									size="sm"
									className={epubReaderChromeOutlineButtonClass}
									disabled={saving}
									onClick={() => void onDelete()}
								>
									{t('ebook.read.thought.delete')}
								</Button>
							) : null}
							{onEdit ? (
								<Button
									type="button"
									size="sm"
									className={epubReaderChromePrimaryButtonClass}
									disabled={saving}
									onClick={onEdit}
								>
									{t('ebook.read.thought.edit')}
								</Button>
							) : null}
						</div>
					) : null}
				</EpubThoughtItemCard>
			) : null}
		</EpubThoughtPanelShell>
	);
}
