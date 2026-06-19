import Model from '@design/Model';
import { Button, ScrollArea, Textarea } from '@ui/index';
import { useI18n } from '@/hooks';
import { cn } from '@/lib/utils';

export type EpubThoughtDialogMode = 'create' | 'view' | 'edit';

type Props = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	mode: EpubThoughtDialogMode;
	quote: string;
	content: string;
	username?: string;
	updatedAt?: string;
	onContentChange: (value: string) => void;
	onSave: () => void | Promise<void>;
	onDelete?: () => void | Promise<void>;
	onEdit?: () => void;
	saving?: boolean;
};

const SCROLL_AREA_EDGE_CLASS =
	'max-h-72 -mx-4.5 min-w-0 w-[calc(100%+2.25rem)]';
const SCROLL_AREA_VIEWPORT_CLASS =
	'min-w-0 max-w-full [&>div]:!min-w-0 [&>div]:!max-w-full [&>div]:min-h-0!';

function formatThoughtTime(iso: string): string {
	try {
		return new Date(iso).toLocaleString();
	} catch {
		return iso;
	}
}

export function EpubThoughtDialog({
	open,
	onOpenChange,
	mode,
	quote,
	content,
	username,
	updatedAt,
	onContentChange,
	onSave,
	onDelete,
	onEdit,
	saving = false,
}: Props) {
	const { t } = useI18n();
	const readOnly = mode === 'view';
	const showMeta = mode !== 'create' && updatedAt;

	const title =
		mode === 'create'
			? t('ebook.read.thought.createTitle')
			: mode === 'edit'
				? t('ebook.read.thought.editTitle')
				: t('ebook.read.thought.viewTitle');

	return (
		<Model
			open={open}
			onOpenChange={onOpenChange}
			title={title}
			width="38rem"
			footer={null}
		>
			<div className="flex min-w-0 flex-col gap-2">
				<ScrollArea
					className={SCROLL_AREA_EDGE_CLASS}
					viewportClassName={SCROLL_AREA_VIEWPORT_CLASS}
				>
					<div className="flex min-w-0 flex-col gap-2 px-4.5 pb-2">
						{quote ? (
							<blockquote
								className={cn(
									'border-amber-500/50 bg-amber-500/5 text-textcolor/80',
									'mb-2 border-l-5 py-2 pl-2 pr-2 box-border text-sm leading-relaxed rounded-md',
								)}
							>
								{quote}
							</blockquote>
						) : null}

						<div className="flex flex-col gap-2">
							{showMeta ? (
								<span className="text-textcolor/50 text-xs">
									{username || t('ebook.read.thought.unknownUser')}
									{' · '}
									{formatThoughtTime(updatedAt)}
								</span>
							) : (
								<span className="text-textcolor/60 text-xs">
									{t('ebook.read.thought.label')}
								</span>
							)}
							{readOnly ? (
								<p className="text-textcolor min-h-16 whitespace-pre-wrap text-sm leading-relaxed">
									{content.trim() || t('ebook.read.thought.empty')}
								</p>
							) : (
								<Textarea
									value={content}
									onChange={(e) => onContentChange(e.target.value)}
									placeholder={t('ebook.read.thought.placeholder')}
									className="min-h-28 resize-y"
									disabled={saving}
									autoFocus
								/>
							)}
						</div>
					</div>
				</ScrollArea>

				<div className="flex justify-end gap-3">
					{mode === 'view' ? (
						<>
							{onDelete ? (
								<Button
									type="button"
									variant="outline"
									className="w-20"
									disabled={saving}
									onClick={() => void onDelete()}
								>
									{t('ebook.read.thought.delete')}
								</Button>
							) : null}
							{onEdit ? (
								<Button
									type="button"
									className="w-20"
									disabled={saving}
									onClick={onEdit}
								>
									{t('ebook.read.thought.edit')}
								</Button>
							) : null}
						</>
					) : (
						<>
							<Button
								type="button"
								variant="outline"
								className="w-20"
								disabled={saving}
								onClick={() => onOpenChange(false)}
							>
								{t('ebook.read.thought.cancel')}
							</Button>
							<Button
								type="button"
								className="w-20"
								disabled={!content.trim() || saving}
								onClick={() => void onSave()}
							>
								{t('ebook.read.thought.save')}
							</Button>
						</>
					)}
				</div>
			</div>
		</Model>
	);
}
