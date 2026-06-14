import Tooltip from '@design/Tooltip';
import { Button } from '@ui/index';
import { BookOpen, FileText, Trash2 } from 'lucide-react';
import { useI18n } from '@/hooks';
import { cn } from '@/lib/utils';
import type { Book, Prog } from '../types';

/** 书架卡片统一高度（图标与书名同行 + 底部进度区） */
const EBOOK_SHELF_CARD_HEIGHT = 'h-[10.5rem]';

export type EbookShelfBookCardProps = {
	book: Book;
	prog?: Prog;
	onOpen: (bookId: string) => void;
	onRemove: (bookId: string) => void;
};

export function EbookShelfBookCard({
	book,
	prog,
	onOpen,
	onRemove,
}: EbookShelfBookCardProps) {
	const { t } = useI18n();
	const pct = prog?.percent;
	const fmtLabel = book.fmt === 'epub' ? 'EPUB' : 'PDF';

	return (
		<div
			className={cn(
				'group flex w-full flex-col rounded-md border border-theme/10 bg-theme/5 p-2.5',
				EBOOK_SHELF_CARD_HEIGHT,
				'transition-colors hover:border-theme/20 hover:bg-theme/10',
			)}
		>
			<div className="flex min-h-0 flex-1 flex-col">
				<div className="flex min-w-0 items-center gap-2">
					<div
						className={cn(
							'flex size-9.5 shrink-0 items-center justify-center rounded-md',
							book.fmt === 'epub'
								? 'bg-green-500/15 text-green-600 dark:text-green-400'
								: 'bg-sky-500/15 text-sky-600 dark:text-sky-400',
						)}
					>
						{book.fmt === 'epub' ? (
							<BookOpen className="size-4" aria-hidden />
						) : (
							<FileText className="size-4" aria-hidden />
						)}
					</div>

					<Tooltip
						side="top"
						sideOffset={6}
						delayDuration={300}
						shadow
						content={book.title}
					>
						<button
							type="button"
							className="min-w-0 flex-1 overflow-hidden text-left text-sm font-medium leading-snug hover:underline"
							onClick={() => onOpen(book.id)}
						>
							<span className="text-textcolor line-clamp-2 wrap-break-word">
								{book.title}
							</span>
						</button>
					</Tooltip>
				</div>

				<div className="flex min-h-0 w-full flex-1 flex-col items-stretch justify-center gap-1.5 py-1">
					<div className="flex w-full items-center justify-between gap-2">
						<span className="text-textcolor/50 rounded bg-theme/10 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide">
							{fmtLabel}
						</span>
						{pct != null ? (
							<span className="text-textcolor/55 text-xs tabular-nums">
								{t('ebook.shelf.progress', { pct })}
							</span>
						) : null}
					</div>

					<div className="h-1.5 w-full shrink-0 rounded-full bg-theme/10">
						{pct != null ? (
							<div
								className="h-full rounded-full bg-teal-500 transition-[width] dark:bg-teal-400"
								style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
							/>
						) : null}
					</div>
				</div>
			</div>

			<div className="flex shrink-0 items-center gap-2">
				<Button
					type="button"
					size="sm"
					variant="secondary"
					className="h-8 min-w-0 flex-1 border-0 bg-teal-600 text-white shadow-none hover:bg-teal-500"
					onClick={() => onOpen(book.id)}
				>
					{prog ? t('ebook.shelf.continue') : t('ebook.shelf.read')}
				</Button>
				<Button
					type="button"
					size="icon-sm"
					variant="secondary"
					className="shrink-0 border-0 bg-teal-600 text-white shadow-none hover:bg-teal-500"
					aria-label={t('common.delete')}
					onClick={() => onRemove(book.id)}
				>
					<Trash2 className="size-4" aria-hidden />
				</Button>
			</div>
		</div>
	);
}
