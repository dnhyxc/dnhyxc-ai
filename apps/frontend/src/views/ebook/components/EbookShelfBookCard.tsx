import Tooltip from '@design/Tooltip';
import { Button } from '@ui/index';
import { BookOpen, FileText, Trash2 } from 'lucide-react';
import { useI18n } from '@/hooks';
import { cn } from '@/lib/utils';
import type { Book, Prog } from '../types';

/** 竖版书本比例（宽 : 高 = 3 : 4） */
const EBOOK_SHELF_CARD_ASPECT = 'aspect-[3/4]';

/** 与 aspect-[3/4] 一致的 viewBox，避免非等比拉伸导致圆角错位 */
const BORDER_VIEWBOX_WIDTH = 75;
const BORDER_VIEWBOX_HEIGHT = 100;
/** SVG 描边宽度（viewBox 单位） */
const BORDER_PROGRESS_STROKE = 2;
/** 与 rounded-md（约 6px）在常见卡片宽度下对齐 */
const BORDER_PROGRESS_RX = 3;

/** 圆角矩形描边路径：从左上角圆角起笔，顺时针闭合 */
function roundedRectStrokePath(
	inset: number,
	w: number,
	h: number,
	rx: number,
): string {
	const x = inset;
	const y = inset;
	const r = Math.min(rx, w / 2, h / 2);
	return [
		`M ${x} ${y + r}`,
		`A ${r} ${r} 0 0 1 ${x + r} ${y}`,
		`H ${x + w - r}`,
		`A ${r} ${r} 0 0 1 ${x + w} ${y + r}`,
		`V ${y + h - r}`,
		`A ${r} ${r} 0 0 1 ${x + w - r} ${y + h}`,
		`H ${x + r}`,
		`A ${r} ${r} 0 0 1 ${x} ${y + h - r}`,
		`V ${y + r}`,
		'Z',
	].join(' ');
}

export type EbookShelfBookCardProps = {
	book: Book;
	prog?: Prog;
	onOpen: (bookId: string) => void;
	onRemove: (bookId: string) => void;
};

function cardGradientClass(fmt: Book['fmt']) {
	if (fmt === 'epub') {
		return cn(
			'bg-linear-to-br from-emerald-400/28 via-teal-500/14 to-emerald-400/16',
			'dark:from-emerald-500/32 dark:via-teal-700/18 dark:to-emerald-600/14',
		);
	}
	return cn(
		'bg-linear-to-br from-sky-400/24 via-cyan-500/12 to-sky-400/14',
		'dark:from-sky-500/28 dark:via-cyan-700/16 dark:to-sky-500/12',
	);
}

function borderProgressTrackClass(fmt: Book['fmt']) {
	return cn(
		'transition-colors',
		fmt === 'epub'
			? 'text-teal-900/18 dark:text-emerald-50/28 group-hover:text-teal-900/25 dark:group-hover:text-emerald-50/38'
			: 'text-sky-900/18 dark:text-sky-50/28 group-hover:text-sky-900/25 dark:group-hover:text-sky-50/38',
	);
}

function borderProgressFillClass(fmt: Book['fmt']) {
	return cn(
		'transition-[stroke-dasharray] duration-300',
		fmt === 'epub'
			? 'text-emerald-500 dark:text-emerald-300'
			: 'text-sky-500 dark:text-sky-300',
	);
}

function EbookShelfBorderProgress({
	percent,
	fmt,
}: {
	percent?: number;
	fmt: Book['fmt'];
}) {
	const inset = BORDER_PROGRESS_STROKE / 2;
	const w = BORDER_VIEWBOX_WIDTH - BORDER_PROGRESS_STROKE;
	const h = BORDER_VIEWBOX_HEIGHT - BORDER_PROGRESS_STROKE;
	const strokePath = roundedRectStrokePath(inset, w, h, BORDER_PROGRESS_RX);
	const clamped =
		percent != null ? Math.min(100, Math.max(0, percent)) : undefined;

	return (
		<svg
			className={cn(
				'pointer-events-none absolute inset-0 size-full',
				borderProgressTrackClass(fmt),
			)}
			viewBox={`0 0 ${BORDER_VIEWBOX_WIDTH} ${BORDER_VIEWBOX_HEIGHT}`}
			preserveAspectRatio="none"
			aria-hidden
		>
			<title>阅读进度</title>
			<path
				d={strokePath}
				fill="none"
				stroke="currentColor"
				strokeWidth={BORDER_PROGRESS_STROKE}
				strokeLinecap="round"
				strokeLinejoin="round"
			/>
			{clamped != null && clamped > 0 ? (
				<path
					className={borderProgressFillClass(fmt)}
					d={strokePath}
					fill="none"
					stroke="currentColor"
					strokeWidth={BORDER_PROGRESS_STROKE}
					strokeLinecap="round"
					strokeLinejoin="round"
					pathLength={100}
					strokeDasharray={`${clamped} 100`}
				/>
			) : null}
		</svg>
	);
}

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
				'group relative w-full min-w-0 overflow-hidden rounded-md',
				EBOOK_SHELF_CARD_ASPECT,
				cardGradientClass(book.fmt),
				'shadow-sm shadow-teal-950/5',
			)}
		>
			<EbookShelfBorderProgress percent={pct} fmt={book.fmt} />

			<div className="relative z-1 grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)_auto_auto] gap-y-2 p-3">
				<div
					className={cn(
						'mx-auto flex size-11 shrink-0 items-center justify-center rounded-md',
						book.fmt === 'epub'
							? 'bg-green-500/15 text-green-600 dark:text-green-400'
							: 'bg-sky-500/15 text-sky-600 dark:text-sky-400',
					)}
				>
					{book.fmt === 'epub' ? (
						<BookOpen className="size-5" aria-hidden />
					) : (
						<FileText className="size-5" aria-hidden />
					)}
				</div>

				<div className="min-h-0 overflow-hidden flex items-center justify-center">
					<Tooltip
						side="top"
						sideOffset={6}
						delayDuration={300}
						shadow
						className="max-w-[min(100vw-2rem,16rem)] w-auto whitespace-normal text-left wrap-break-word leading-snug"
						content={book.title}
					>
						<button
							type="button"
							className="block w-full min-h-0 overflow-hidden text-center"
							onClick={() => onOpen(book.id)}
						>
							<span className="text-textcolor line-clamp-2 text-sm font-medium leading-snug wrap-break-word">
								{book.title}
							</span>
						</button>
					</Tooltip>
				</div>

				<div className="flex w-full shrink-0 items-center justify-between gap-2">
					<span className="text-textcolor/80 shrink-0 rounded bg-theme/10 px-1.5 py-0.5 text-xs font-medium uppercase tracking-wide">
						{fmtLabel}
					</span>
					{pct != null ? (
						<span className="text-textcolor/55 shrink-0 text-xs tabular-nums">
							{t('ebook.shelf.progress', { pct })}
						</span>
					) : null}
				</div>

				<div className="flex shrink-0 items-center gap-2">
					<Button
						type="button"
						size="sm"
						variant="secondary"
						className="h-8 min-w-0 flex-1 border-0 bg-teal-600 px-2 text-xs text-white shadow-none hover:bg-teal-500"
						onClick={() => onOpen(book.id)}
					>
						{prog ? t('ebook.shelf.continue') : t('ebook.shelf.read')}
					</Button>
					<Button
						type="button"
						variant="secondary"
						className="size-8 shrink-0 border-0 bg-teal-600 text-white shadow-none hover:bg-teal-500"
						aria-label={t('common.delete')}
						onClick={() => onRemove(book.id)}
					>
						<Trash2 className="size-4" aria-hidden />
					</Button>
				</div>
			</div>
		</div>
	);
}
