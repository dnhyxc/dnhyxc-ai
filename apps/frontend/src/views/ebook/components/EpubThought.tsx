import ChatTextArea from '@design/ChatTextArea';
import { Button } from '@ui/index';
import { useEffect, useRef } from 'react';
import { useI18n } from '@/hooks';
import { cn } from '@/lib/utils';
import type { EpubQuoteActionBarProps } from './EpubQuoteActionBar';
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
	onContentChange: (value: string) => void;
	onSave: () => void | Promise<void>;
	onDelete?: () => void | Promise<void>;
	onEdit?: () => void;
	saving?: boolean;
	quoteActions?: EpubQuoteActionBarProps | null;
	onQuoteHighlightClick?: () => void;
};

const THOUGHT_TEXTAREA_CLASS = cn(
	'h-full min-h-0 field-sizing-fixed resize-none border-none bg-transparent p-0 shadow-none rounded-none',
	'focus-visible:ring-transparent text-textcolor placeholder:text-textcolor/40 text-base',
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
		void onSave();
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
						mode={mode}
						className={mode === 'edit' ? 'pt-3' : undefined}
						actions={
							<>
								<Button
									type="button"
									size="sm"
									variant="outline"
									disabled={saving}
									onClick={onClose}
								>
									{t('ebook.read.thought.cancel')}
								</Button>
								<Button
									type="button"
									size="sm"
									disabled={!content.trim() || saving}
									onClick={() => void onSave()}
								>
									{t('ebook.read.thought.save')}
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
								mode === 'edit' ? 'border-t border-theme/10' : undefined,
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
				>
					<p className="text-textcolor whitespace-pre-wrap text-[16px] leading-[1.8]">
						{content.trim() || t('ebook.read.thought.empty')}
					</p>
					{onDelete || onEdit ? (
						<div className="mt-6 flex justify-end gap-3">
							{onDelete ? (
								<Button
									type="button"
									variant="outline"
									size="sm"
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
