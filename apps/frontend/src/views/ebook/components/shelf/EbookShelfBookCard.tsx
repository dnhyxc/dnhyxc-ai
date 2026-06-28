import Tooltip from '@design/Tooltip';
import {
	Input,
	Popover,
	PopoverContent,
	PopoverTrigger,
	ScrollArea,
	Spinner,
} from '@ui/index';
import {
	BookOpen,
	FileText,
	FolderInput,
	ImagePlus,
	Play,
	Trash2,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useI18n } from '@/hooks';
import { cn } from '@/lib/utils';
import { resolveUploadedFileUrl } from '@/utils/upload-file-url';
import type { Book, EbookCategory, Prog } from '../../types';

function byFmt<T>(fmt: Book['fmt'], epub: T, pdf: T): T {
	return fmt === 'epub' ? epub : pdf;
}

/** 圆角矩形描边路径（viewBox 单位，顺时针闭合） */
function roundedRectStrokePath(
	inset: number,
	w: number,
	h: number,
	rx: number,
): string {
	const r = Math.min(rx, w / 2, h / 2);
	return [
		`M ${inset} ${inset + r}`,
		`A ${r} ${r} 0 0 1 ${inset + r} ${inset}`,
		`H ${inset + w - r}`,
		`A ${r} ${r} 0 0 1 ${inset + w} ${inset + r}`,
		`V ${inset + h - r}`,
		`A ${r} ${r} 0 0 1 ${inset + w - r} ${inset + h}`,
		`H ${inset + r}`,
		`A ${r} ${r} 0 0 1 ${inset} ${inset + h - r}`,
		`V ${inset + r}`,
		'Z',
	].join(' ');
}

export type EbookShelfBookCardProps = {
	book: Book;
	prog?: Prog;
	categories?: EbookCategory[];
	onOpen: (bookId: string) => void;
	onRemove: (bookId: string) => void;
	onSetCover?: (bookId: string, file: File) => Promise<void>;
	onUpdateTitle?: (bookId: string, title: string) => Promise<void>;
	onMoveCategory?: (bookId: string, categoryId: string | null) => Promise<void>;
};

const SHELF_HOVER_FADE = cn(
	'opacity-0 transition-opacity duration-200 ease-out',
	'group-hover:opacity-100 group-focus-within:opacity-100',
);

const SHELF_HOVER_BAR = 'flex items-center justify-between gap-2';

const SHELF_META_CHIP = cn(
	'inline-flex h-6 shrink-0 items-center whitespace-nowrap rounded-full px-2.5',
	'bg-theme-background/40 backdrop-blur-md ring-1 ring-theme/10',
	'text-xs font-medium leading-none tabular-nums',
);

function shelfCornerBtnClass(danger?: boolean) {
	return cn(
		'cursor-pointer flex size-7 shrink-0 items-center justify-center rounded-full',
		'bg-theme-background/40 backdrop-blur-md ring-1 ring-theme/10',
		'text-textcolor/60 transition-[background-color,color,box-shadow] duration-150',
		danger
			? 'hover:bg-destructive/12 hover:text-destructive hover:ring-destructive/25'
			: 'hover:bg-theme-background/60 hover:text-textcolor hover:ring-theme/18',
	);
}

function shelfTitleActionBtnClass(disabled?: boolean, hoverColor?: boolean) {
	return cn(
		'inline-flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-md',
		'text-textcolor/70 transition-colors hover:bg-transparent hover:text-textcolor',
		disabled && 'pointer-events-none opacity-50',
		hoverColor && 'hover:text-teal-500',
	);
}

function categoryMenuItemClass(active?: boolean): string {
	return cn(
		'flex min-w-0 w-full cursor-pointer items-center rounded-sm px-2 py-1.5 text-left text-sm transition-colors',
		'hover:bg-theme/5 focus-visible:bg-theme/5 focus-visible:outline-none',
		active && 'pointer-events-none opacity-50',
	);
}

function EbookShelfBorderProgress({
	percent,
	fmt,
}: {
	percent?: number;
	fmt: Book['fmt'];
}) {
	const stroke = 2;
	const viewW = 75;
	const viewH = 100;
	const rx = 3;
	const inset = stroke / 2;
	const w = viewW - stroke;
	const h = viewH - stroke;
	const strokePath = roundedRectStrokePath(inset, w, h, rx);
	const clamped =
		percent != null ? Math.min(100, Math.max(0, percent)) : undefined;

	return (
		<svg
			className={cn(
				'pointer-events-none absolute inset-0 size-full transition-colors',
				byFmt(
					fmt,
					'text-teal-900/18 dark:text-emerald-50/28 group-hover:text-teal-900/25 dark:group-hover:text-emerald-50/38',
					'text-sky-900/18 dark:text-sky-50/28 group-hover:text-sky-900/25 dark:group-hover:text-sky-50/38',
				),
			)}
			viewBox={`0 0 ${viewW} ${viewH}`}
			preserveAspectRatio="none"
			aria-hidden
		>
			<title>阅读进度</title>
			<path
				d={strokePath}
				fill="none"
				stroke="currentColor"
				strokeWidth={stroke}
				strokeLinecap="round"
				strokeLinejoin="round"
			/>
			{clamped != null && clamped > 0 ? (
				<path
					className={cn(
						'transition-[stroke-dasharray] duration-300',
						byFmt(fmt, 'text-emerald-500', 'text-sky-500'),
					)}
					d={strokePath}
					fill="none"
					stroke="currentColor"
					strokeWidth={stroke}
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
	categories = [],
	onOpen,
	onRemove,
	onSetCover,
	onUpdateTitle,
	onMoveCategory,
}: EbookShelfBookCardProps) {
	const { t } = useI18n();
	const coverInputRef = useRef<HTMLInputElement>(null);
	const titleCommittingRef = useRef(false);
	const [coverBusy, setCoverBusy] = useState(false);
	const [editingTitle, setEditingTitle] = useState(false);
	const [titleDraft, setTitleDraft] = useState(book.title);
	const [titleSaving, setTitleSaving] = useState(false);
	const [categoryBusy, setCategoryBusy] = useState(false);
	const [categoryMenuOpen, setCategoryMenuOpen] = useState(false);
	const pct = prog?.percent;
	const fmtLabel = book.fmt === 'epub' ? 'EPUB' : 'PDF';
	const openLabel = prog ? t('ebook.shelf.continue') : t('ebook.shelf.read');

	const onCoverFile = async (list: FileList | null) => {
		const file = list?.[0];
		if (!file || !onSetCover) return;
		setCoverBusy(true);
		try {
			await onSetCover(book.id, file);
		} finally {
			setCoverBusy(false);
			if (coverInputRef.current) coverInputRef.current.value = '';
		}
	};

	useEffect(() => {
		if (!editingTitle) setTitleDraft(book.title);
	}, [book.title, editingTitle]);

	const cancelTitleEdit = () => {
		setTitleDraft(book.title);
		setEditingTitle(false);
	};

	const commitTitleEdit = async () => {
		if (!onUpdateTitle || titleSaving) return;
		const next = titleDraft.trim();
		if (!next || next === book.title) {
			cancelTitleEdit();
			return;
		}
		setTitleSaving(true);
		try {
			await onUpdateTitle(book.id, next);
			setEditingTitle(false);
		} finally {
			setTitleSaving(false);
			titleCommittingRef.current = false;
		}
	};

	const startTitleEdit = () => {
		if (!onUpdateTitle || titleSaving) return;
		setTitleDraft(book.title);
		setEditingTitle(true);
	};

	const handleCategoryMenuWheel = useCallback(
		(event: React.WheelEvent<HTMLDivElement>) => {
			event.stopPropagation();
			event.currentTarget.scrollTop += event.deltaY;
		},
		[],
	);

	const handleCategoryMenuWheelCapture = useCallback(
		(event: React.WheelEvent<HTMLDivElement>) => {
			event.stopPropagation();
		},
		[],
	);

	const assignCategory = (categoryId: string | null) => {
		if (!onMoveCategory || categoryBusy) return;
		setCategoryMenuOpen(false);
		setCategoryBusy(true);
		void onMoveCategory(book.id, categoryId).finally(() =>
			setCategoryBusy(false),
		);
	};

	const showMoveCategory = Boolean(onMoveCategory && categories.length > 0);

	const moveCategoryMenu = showMoveCategory ? (
		<Popover open={categoryMenuOpen} onOpenChange={setCategoryMenuOpen}>
			<Tooltip
				side="top"
				sideOffset={4}
				delayDuration={200}
				shadow
				content={t('ebook.shelf.category.move')}
			>
				<PopoverTrigger asChild>
					<button
						type="button"
						className={shelfTitleActionBtnClass(categoryBusy, !categoryBusy)}
						aria-label={t('ebook.shelf.category.move')}
						aria-expanded={categoryMenuOpen}
						disabled={categoryBusy}
						onClick={(e) => e.stopPropagation()}
					>
						{categoryBusy ? (
							<Spinner className="size-3.5 text-textcolor -mr-1" aria-hidden />
						) : (
							<FolderInput className="size-4.5 -mr-1" aria-hidden />
						)}
					</button>
				</PopoverTrigger>
			</Tooltip>
			<PopoverContent
				align="end"
				side="bottom"
				sideOffset={6}
				className="w-48 overflow-hidden p-0"
			>
				<p className="border-theme/10 text-textcolor border-b px-3 py-3.5 text-xs font-medium">
					{t('ebook.shelf.category.move')}
				</p>
				<ScrollArea
					className="max-h-56 w-full"
					viewportClassName="max-h-56 [&>div]:min-h-0!"
					onWheel={handleCategoryMenuWheel}
					onWheelCapture={handleCategoryMenuWheelCapture}
				>
					<div className="flex min-w-0 flex-col gap-0.5 p-1 pb-2">
						{categories.map((cat) => {
							const selected = book.categoryId === cat.id;
							return (
								<button
									key={cat.id}
									type="button"
									className={categoryMenuItemClass(selected)}
									disabled={selected}
									onClick={() => assignCategory(cat.id)}
								>
									<span className="min-w-0 truncate">{cat.name}</span>
								</button>
							);
						})}
						<div className="bg-theme/10 my-1 h-px" aria-hidden />
						<button
							type="button"
							className={categoryMenuItemClass(book.categoryId == null)}
							disabled={book.categoryId == null}
							onClick={() => assignCategory(null)}
						>
							<span className="min-w-0 truncate">
								{t('ebook.shelf.category.uncategorized')}
							</span>
						</button>
					</div>
				</ScrollArea>
			</PopoverContent>
		</Popover>
	) : null;

	return (
		<div className="flex w-full min-w-0 flex-col gap-1.5">
			<div
				className={cn(
					'group relative aspect-3/4 w-full min-w-0 overflow-hidden rounded-md',
					!book.coverUrl &&
						byFmt(
							book.fmt,
							cn(
								'bg-linear-to-br from-emerald-400/28 via-teal-500/14 to-emerald-400/16',
								'dark:from-emerald-500/32 dark:via-teal-700/18 dark:to-emerald-600/14',
							),
							cn(
								'bg-linear-to-br from-sky-400/24 via-cyan-500/12 to-sky-400/14',
								'dark:from-sky-500/28 dark:via-cyan-700/16 dark:to-sky-500/12',
							),
						),
					'shadow-sm shadow-teal-950/5 transition-shadow duration-200',
					'hover:shadow-md hover:shadow-teal-950/10',
				)}
			>
				{book.coverUrl ? (
					<>
						<div className="absolute inset-0 flex items-center justify-center overflow-hidden">
							<img
								src={resolveUploadedFileUrl(book.coverUrl)}
								alt=""
								className="min-h-full min-w-full object-cover object-center"
								draggable={false}
							/>
						</div>
						<div
							className="pointer-events-none absolute inset-0 bg-linear-to-t from-black/30 via-black/5 to-black/15"
							aria-hidden
						/>
					</>
				) : null}

				<EbookShelfBorderProgress percent={pct} fmt={book.fmt} />

				{!book.coverUrl ? (
					<div
						className={cn(
							'relative z-1 flex h-full min-h-0 flex-col items-center justify-center gap-3 p-3',
							'group-hover:pointer-events-none group-focus-within:pointer-events-none',
						)}
					>
						<div
							className={cn(
								'flex size-11 shrink-0 items-center justify-center rounded-md',
								byFmt(
									book.fmt,
									'bg-green-500/15 text-green-600',
									'bg-sky-500/15 text-sky-600',
								),
							)}
						>
							{book.fmt === 'epub' ? (
								<BookOpen className="size-5" aria-hidden />
							) : (
								<FileText className="size-5" aria-hidden />
							)}
						</div>

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
								<span className="text-textcolor line-clamp-3 text-sm font-medium leading-snug wrap-break-word">
									{book.title}
								</span>
							</button>
						</Tooltip>
					</div>
				) : null}

				<div
					className={cn(
						'absolute inset-0 z-2 bg-theme-background/12 backdrop-blur-md backdrop-saturate-150 rounded-md',
						SHELF_HOVER_FADE,
						'pointer-events-none group-hover:pointer-events-auto group-focus-within:pointer-events-auto',
					)}
					aria-hidden
				/>
				<div
					className={cn(
						'pointer-events-none absolute inset-x-0 top-0 z-2 h-10',
						'bg-linear-to-b from-black/18 via-black/6 to-transparent',
						SHELF_HOVER_FADE,
					)}
					aria-hidden
				/>
				<div
					className={cn(
						'pointer-events-none absolute inset-x-0 bottom-0 z-2 h-10',
						'bg-linear-to-t from-black/22 via-black/8 to-transparent',
						SHELF_HOVER_FADE,
					)}
					aria-hidden
				/>

				<div
					className={cn(
						'absolute inset-0 z-3 p-2',
						SHELF_HOVER_FADE,
						'pointer-events-none group-hover:pointer-events-auto group-focus-within:pointer-events-auto',
					)}
				>
					<div className="grid size-full grid-rows-[auto_1fr_auto]">
						<div className={SHELF_HOVER_BAR}>
							<span
								className={cn(
									SHELF_META_CHIP,
									'uppercase tracking-wider text-textcolor/75',
								)}
							>
								{fmtLabel}
							</span>
							<div className="flex items-center gap-1">
								<Tooltip
									side="bottom"
									sideOffset={6}
									delayDuration={200}
									shadow
									content={t('common.delete')}
								>
									<button
										type="button"
										className={shelfCornerBtnClass(true)}
										aria-label={t('common.delete')}
										onClick={() => onRemove(book.id)}
									>
										<Trash2 className="size-3.5" aria-hidden />
									</button>
								</Tooltip>
							</div>
						</div>

						<div className="flex min-h-0 items-center justify-center">
							<button
								type="button"
								className={cn(
									'group/open flex cursor-pointer flex-col items-center gap-1.5',
									byFmt(
										book.fmt,
										cn('text-green-600', 'group-hover/open:text-emerald-500'),
										cn('text-sky-600', 'group-hover/open:text-sky-500'),
									),
								)}
								aria-label={openLabel}
								onClick={() => onOpen(book.id)}
							>
								<span
									className={cn(
										'flex size-11 shrink-0 items-center justify-center rounded-full shadow-md ring-1 transition-[background-color,box-shadow] duration-200 ease-out',
										byFmt(
											book.fmt,
											cn(
												'bg-emerald-500/18 ring-emerald-600/30',
												'group-hover/open:bg-emerald-400/24 group-hover/open:ring-emerald-500/40',
												'group-hover/open:shadow-md group-hover/open:shadow-emerald-950/15',
											),
											cn(
												'bg-sky-500/18 ring-sky-600/30',
												'group-hover/open:bg-sky-400/24 group-hover/open:ring-sky-500/40',
												'group-hover/open:shadow-md group-hover/open:shadow-sky-950/15',
											),
										),
									)}
								>
									{prog ? (
										<Play
											className="size-5 shrink-0 fill-current"
											aria-hidden
										/>
									) : (
										<BookOpen className="size-5 shrink-0" aria-hidden />
									)}
								</span>
								<span className="mt-1 whitespace-nowrap text-sm font-medium leading-none">
									{openLabel}
								</span>
							</button>
						</div>

						<div className={SHELF_HOVER_BAR}>
							{onSetCover ? (
								<>
									<input
										ref={coverInputRef}
										type="file"
										accept="image/jpeg,image/png,image/webp"
										className="hidden"
										onChange={(e) => void onCoverFile(e.target.files)}
									/>
									<Tooltip
										side="top"
										sideOffset={6}
										delayDuration={200}
										shadow
										content={t('ebook.shelf.coverSetting')}
									>
										<button
											type="button"
											className={cn(
												shelfCornerBtnClass(),
												coverBusy && 'pointer-events-none',
											)}
											aria-label={t('ebook.shelf.coverSetting')}
											disabled={coverBusy}
											onClick={(e) => {
												e.stopPropagation();
												coverInputRef.current?.click();
											}}
										>
											{coverBusy ? (
												<Spinner
													className="size-3.5 text-textcolor/55"
													aria-hidden
												/>
											) : (
												<ImagePlus className="size-3.5" aria-hidden />
											)}
										</button>
									</Tooltip>
								</>
							) : (
								<span className="size-7 shrink-0" aria-hidden />
							)}
							{pct != null ? (
								<span
									className={cn(SHELF_META_CHIP, 'text-textcolor/75 pb-0.5')}
								>
									{t('ebook.shelf.progress', { pct })}
								</span>
							) : (
								<span className="size-7 shrink-0" aria-hidden />
							)}
						</div>
					</div>
				</div>
			</div>

			<div className="flex h-7 w-full min-w-0 items-center gap-1">
				{editingTitle ? (
					<Input
						autoFocus
						value={titleDraft}
						disabled={titleSaving}
						maxLength={100}
						className={cn(
							'h-full min-h-0 min-w-0 flex-1 rounded px-1.5 py-0 text-sm leading-none shadow-none',
							'border-theme/5 bg-theme/5 focus-visible:border-theme/10 focus-visible:ring-0',
						)}
						aria-label={t('ebook.shelf.editTitle')}
						onChange={(e) => setTitleDraft(e.target.value)}
						onKeyDown={(e) => {
							if (e.key === 'Enter') {
								e.preventDefault();
								titleCommittingRef.current = true;
								void commitTitleEdit();
							}
							if (e.key === 'Escape') {
								e.preventDefault();
								cancelTitleEdit();
							}
						}}
						onBlur={() => {
							if (titleCommittingRef.current) return;
							cancelTitleEdit();
						}}
					/>
				) : (
					<>
						<Tooltip
							side="top"
							sideOffset={4}
							delayDuration={300}
							shadow
							className="max-w-[min(100vw-2rem,16rem)] w-auto whitespace-normal text-left wrap-break-word leading-snug"
							content={
								onUpdateTitle
									? t('ebook.shelf.editTitleHint', { title: book.title })
									: book.title
							}
						>
							<button
								type="button"
								className={cn(
									'flex h-full min-w-0 flex-1 items-center px-0.5 text-left',
									onUpdateTitle && 'cursor-text hover:text-textcolor',
								)}
								disabled={!onUpdateTitle}
								onClick={startTitleEdit}
							>
								<span className="text-textcolor/85 block min-w-0 truncate text-sm font-medium leading-none">
									{book.title}
								</span>
							</button>
						</Tooltip>
						{moveCategoryMenu}
					</>
				)}
			</div>
		</div>
	);
}
