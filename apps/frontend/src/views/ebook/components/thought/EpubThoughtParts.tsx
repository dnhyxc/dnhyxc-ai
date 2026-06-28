import Tooltip from '@design/Tooltip';
import { CircleChevronDown, CircleChevronUp, CircleX } from 'lucide-react';
import {
	type ReactNode,
	useEffect,
	useLayoutEffect,
	useRef,
	useState,
} from 'react';
import ICON from '@/assets/icon.png';
import { useI18n } from '@/hooks';
import { cn } from '@/lib/utils';
import { formatDate, resolveCosUrlForWebDisplay } from '@/utils';
import type { EpubHighlightColorId, EpubHighlightStyle } from '../../types';
import { EPUB_HIGHLIGHT_COLOR_OPTIONS } from '../../utils/epub/mark/epubUserHighlights';
import {
	epubReaderSurfaceFadeFromClass,
	epubReaderSurfaceHoverClass,
	epubReaderSurfaceSelectedClass,
} from '../../utils/epub/reader/epubReaderSettings';
import {
	EpubQuoteActionBar,
	type EpubQuoteActionBarProps,
} from '../selection/EpubQuoteActionBar';

const COLOR_BY_ID = Object.fromEntries(
	EPUB_HIGHLIGHT_COLOR_OPTIONS.map((item) => [item.id, item]),
) as Record<
	EpubHighlightColorId,
	(typeof EPUB_HIGHLIGHT_COLOR_OPTIONS)[number]
>;

function EpubHighlightedQuoteText({
	quote,
	highlight,
	onHighlightClick,
}: {
	quote: string;
	highlight?: { style: EpubHighlightStyle; color: EpubHighlightColorId } | null;
	onHighlightClick?: () => void;
}) {
	const palette = highlight ? COLOR_BY_ID[highlight.color] : undefined;
	const interactive = Boolean(onHighlightClick);
	const showHighlightVisual = Boolean(highlight && palette);

	return (
		<span
			role={interactive ? 'button' : undefined}
			tabIndex={interactive ? 0 : undefined}
			onClick={interactive ? onHighlightClick : undefined}
			onKeyDown={
				interactive
					? (e) => {
							if (e.key === 'Enter' || e.key === ' ') {
								e.preventDefault();
								onHighlightClick?.();
							}
						}
					: undefined
			}
			className={cn(
				showHighlightVisual && 'rounded-sm transition-colors',
				showHighlightVisual && highlight?.style === 'highlight' && 'px-0.5',
				showHighlightVisual &&
					highlight?.style === 'underline' &&
					'underline decoration-2 underline-offset-[5px]',
				showHighlightVisual &&
					highlight?.style === 'wavy' &&
					'underline decoration-wavy decoration-2 underline-offset-[5px]',
				interactive && 'cursor-pointer hover:opacity-90',
			)}
			style={{
				backgroundColor:
					showHighlightVisual && highlight?.style === 'highlight'
						? palette?.fill
						: undefined,
				textDecorationColor:
					showHighlightVisual && highlight?.style !== 'highlight'
						? palette?.stroke
						: undefined,
			}}
		>
			{quote}
		</span>
	);
}

const QUOTE_CLAMP_LINES = 3;

function lineClampClass(clampLines: number) {
	return clampLines === 1 ? 'line-clamp-1' : 'line-clamp-3';
}

function useQuoteExcerptClamp(
	resetKey: string,
	clampLines = QUOTE_CLAMP_LINES,
) {
	const wrapperRef = useRef<HTMLDivElement>(null);
	const textRef = useRef<HTMLParagraphElement>(null);
	const [expanded, setExpanded] = useState(false);
	const [overflows, setOverflows] = useState(false);
	const clampClass = lineClampClass(clampLines);

	useEffect(() => {
		setExpanded(false);
	}, [resetKey]);

	useLayoutEffect(() => {
		const wrapper = wrapperRef.current;
		const textEl = textRef.current;
		if (!wrapper || !textEl) return;

		const measure = () => {
			const width = wrapper.clientWidth;
			if (width <= 0) return;

			const lineHeight = Number.parseFloat(getComputedStyle(textEl).lineHeight);
			if (!Number.isFinite(lineHeight) || lineHeight <= 0) return;

			const clone = textEl.cloneNode(true) as HTMLParagraphElement;
			clone.style.cssText =
				'position:absolute;visibility:hidden;pointer-events:none;height:auto;max-height:none;overflow:visible;display:block;-webkit-line-clamp:unset;';
			clone.style.width = `${width}px`;
			clone.classList.remove('line-clamp-1', 'line-clamp-3');
			wrapper.appendChild(clone);
			const fullHeight = clone.scrollHeight;
			clone.remove();

			setOverflows(fullHeight > lineHeight * clampLines + 1);
		};

		measure();
		const ro = new ResizeObserver(measure);
		ro.observe(wrapper);
		return () => ro.disconnect();
	}, [resetKey, clampLines]);

	return { wrapperRef, textRef, expanded, setExpanded, overflows, clampClass };
}

/** 顶部引用区：底部文字展开/收起 */
function EpubExcerptExpandLink({
	expanded,
	onToggle,
	className,
}: {
	expanded: boolean;
	onToggle: () => void;
	className?: string;
}) {
	const { t } = useI18n();

	return (
		<button
			type="button"
			className={cn(
				'bg-transparent text-textcolor/45 hover:text-textcolor/75 cursor-pointer text-xs',
				className,
			)}
			aria-expanded={expanded}
			onClick={onToggle}
		>
			{expanded
				? t('ebook.read.thought.quoteCollapse')
				: t('ebook.read.thought.quoteExpand')}
		</button>
	);
}

/** 折叠时在末尾叠加渐变，提示下方还有内容（仅顶部引用区） */
function EpubExcerptClampFade({ fromClassName }: { fromClassName: string }) {
	return (
		<div
			aria-hidden
			className={cn(
				'pointer-events-none absolute inset-x-0 bottom-0 h-7 bg-linear-to-t to-transparent',
				fromClassName,
			)}
		/>
	);
}

/** 分组摘录：圆形展开/收起 */
function EpubExcerptExpandToggle({
	expanded,
	onToggle,
	className,
}: {
	expanded: boolean;
	onToggle: () => void;
	className?: string;
}) {
	const { t } = useI18n();

	return (
		<Tooltip
			side="top"
			sideOffset={6}
			delayDuration={200}
			shadow
			content={
				expanded
					? t('ebook.read.thought.quoteCollapse')
					: t('ebook.read.thought.quoteExpand')
			}
		>
			<button
				type="button"
				className={cn(
					'-mr-2 text-textcolor/45 hover:text-textcolor shrink-0 cursor-pointer rounded-sm p-1 transition-colors',
					className,
				)}
				aria-label={
					expanded
						? t('ebook.read.thought.quoteCollapse')
						: t('ebook.read.thought.quoteExpand')
				}
				aria-expanded={expanded}
				onClick={onToggle}
			>
				{expanded ? (
					<CircleChevronUp className="size-4.5" aria-hidden />
				) : (
					<CircleChevronDown className="size-4.5" aria-hidden />
				)}
			</button>
		</Tooltip>
	);
}

/** 想法列表分组摘录：单行省略，右侧展开/收起 */
export function EpubThoughtClusterExcerpt({
	spanLength,
	quote,
}: {
	spanLength: number;
	quote: string;
}) {
	const { t } = useI18n();
	const resetKey = `${spanLength}:${quote}`;
	const { wrapperRef, textRef, expanded, setExpanded, overflows, clampClass } =
		useQuoteExcerptClamp(resetKey, 1);

	return (
		<div className="text-textcolor/55 border-theme/10 flex items-center gap-0.5 border-t px-4 py-2 text-xs">
			<div ref={wrapperRef} className="min-w-0 flex-1">
				<p
					ref={textRef}
					className={cn('min-h-lh leading-normal', !expanded && clampClass)}
				>
					{t('ebook.read.thought.clusterExcerpt', { length: spanLength })}
					<span className="text-textcolor/40 mx-1">·</span>
					<span className="text-textcolor/65 italic">{quote}</span>
				</p>
			</div>
			<div className="flex w-[26px] shrink-0 items-center justify-center">
				{overflows ? (
					<EpubExcerptExpandToggle
						expanded={expanded}
						onToggle={() => setExpanded((value) => !value)}
					/>
				) : (
					<span className="size-[26px] shrink-0" aria-hidden />
				)}
			</div>
		</div>
	);
}

type QuoteCardProps = {
	quote: string;
	quoteActions?: EpubQuoteActionBarProps | null;
	/** 在书中对应正文上方打开 PopBar */
	onQuoteHighlightClick?: () => void;
	title?: string;
	count?: number;
	onClose?: () => void;
	/** 关闭按钮 tooltip：view=关闭读书想法，edit=关闭想法编辑 */
	closeMode?: 'view' | 'edit';
	className?: string;
};

type ThoughtCardProps = {
	username: string;
	avatar?: string;
	createdAt?: string;
	children: ReactNode;
	className?: string;
	selected?: boolean;
	onClick?: () => void;
};

/** 引用卡片顶栏 / 底栏操作条统一行高 */
const quoteCardBarRowClass = 'flex h-[50px] shrink-0 items-center';

export function ThoughtUserAvatar({
	avatar,
	name,
}: {
	avatar?: string;
	name: string;
}) {
	const src = avatar ? resolveCosUrlForWebDisplay(avatar) : ICON;

	return (
		<img
			src={src}
			alt={name}
			className="size-7 shrink-0 rounded-full object-cover"
			onError={(e) => {
				e.currentTarget.onerror = null;
				e.currentTarget.src = ICON;
			}}
		/>
	);
}

function ThoughtUserMeta({
	username,
	avatar,
	createdAt,
	mode,
}: {
	username: string;
	avatar?: string;
	createdAt?: string;
	mode?: 'create' | 'edit';
}) {
	const publishedAt = formatDate(createdAt ?? '');

	return (
		<div
			className={cn(
				'mb-3 flex min-w-0 items-center gap-2',
				mode === 'edit' ? 'px-4' : undefined,
			)}
		>
			<ThoughtUserAvatar avatar={avatar} name={username} />
			<div className="flex min-w-0 flex-1 items-center gap-2">
				<span className="text-textcolor/55 truncate text-sm">{username}</span>
				{publishedAt ? (
					<span className="text-textcolor/35 shrink-0 text-xs tabular-nums">
						{publishedAt}
					</span>
				) : null}
			</div>
		</div>
	);
}

/** 段落引用 + 操作条；标题与关闭钮在卡片顶栏 */
export function EpubThoughtQuoteCard({
	quote,
	quoteActions,
	onQuoteHighlightClick,
	title,
	count,
	onClose,
	closeMode = 'view',
	className,
}: QuoteCardProps) {
	const { t } = useI18n();
	const hasQuote = Boolean(quote.trim());
	const showHeader = Boolean(title || onClose);
	const { wrapperRef, textRef, expanded, setExpanded, overflows, clampClass } =
		useQuoteExcerptClamp(quote);

	const openPopBarAtBook = () => {
		onQuoteHighlightClick?.();
	};

	const panelQuoteActions = quoteActions;

	if (!hasQuote && !showHeader) return null;

	return (
		<div className={cn('shrink-0 overflow-hidden', className)}>
			{showHeader ? (
				<div
					className={cn(
						quoteCardBarRowClass,
						'border-theme/10 justify-between gap-3 border-b px-4',
					)}
				>
					<div className="flex min-w-0 flex-1 items-baseline gap-2">
						{title ? (
							<h2 className="text-textcolor truncate text-base font-semibold">
								{title}
							</h2>
						) : null}
						{count != null ? (
							<span className="text-textcolor/50 shrink-0 text-sm tabular-nums">
								{t('ebook.read.thought.totalCount', { count })}
							</span>
						) : null}
					</div>
					<div className="flex shrink-0 items-center">
						{onClose ? (
							<Tooltip
								side="left"
								sideOffset={6}
								delayDuration={200}
								shadow
								content={
									closeMode === 'edit'
										? t('ebook.read.thought.closeEdit')
										: t('ebook.read.thought.closeView')
								}
							>
								<button
									type="button"
									className="text-textcolor/45 hover:text-textcolor -mr-1 shrink-0 cursor-pointer rounded-sm p-1 transition-colors"
									onClick={onClose}
									aria-label={
										closeMode === 'edit'
											? t('ebook.read.thought.closeEdit')
											: t('ebook.read.thought.closeView')
									}
								>
									<CircleX className="size-4.5" />
								</button>
							</Tooltip>
						) : null}
					</div>
				</div>
			) : null}
			{hasQuote ? (
				<figure
					className="px-4 pb-3 pt-2"
					aria-label={t('ebook.read.thought.bookExcerpt')}
				>
					<div ref={wrapperRef} className="min-w-0">
						<div className="relative">
							<p
								ref={textRef}
								className={cn(
									'text-textcolor/85 font-serif leading-[1.85] wrap-break-word',
									overflows && !expanded && clampClass,
								)}
							>
								<span
									aria-hidden
									className="text-textcolor/35 font-bold select-none"
								>
									『
								</span>
								<EpubHighlightedQuoteText
									quote={quote}
									onHighlightClick={
										onQuoteHighlightClick ? openPopBarAtBook : undefined
									}
								/>
								<span
									aria-hidden
									className="text-textcolor/35 font-bold select-none"
								>
									』
								</span>
							</p>
							{overflows && !expanded ? (
								<EpubExcerptClampFade
									fromClassName={epubReaderSurfaceFadeFromClass}
								/>
							) : null}
						</div>
						{overflows ? (
							<div className="flex justify-end pt-1">
								<EpubExcerptExpandLink
									expanded={expanded}
									onToggle={() => setExpanded((value) => !value)}
								/>
							</div>
						) : null}
					</div>
				</figure>
			) : null}
			{panelQuoteActions && hasQuote ? (
				<div
					className={cn(
						'flex h-[51px] shrink-0 items-center border-theme/10 border-t pb-0.5',
					)}
				>
					<EpubQuoteActionBar
						{...panelQuoteActions}
						variant="panel"
						className="min-w-0 flex-1"
					/>
				</div>
			) : null}
		</div>
	);
}

/** 单条想法卡片：头像 + 用户名 + 发布日期 + 正文 */
export function EpubThoughtItemCard({
	username,
	avatar,
	createdAt,
	children,
	className,
	selected,
	onClick,
}: ThoughtCardProps) {
	return (
		<div
			onClick={onClick}
			data-selected={selected ? 'true' : undefined}
			className={cn(
				'p-4 text-left transition-colors border-t border-theme/10',
				onClick && cn('cursor-pointer', epubReaderSurfaceHoverClass),
				selected && epubReaderSurfaceSelectedClass,
				className,
			)}
		>
			<ThoughtUserMeta
				username={username}
				avatar={avatar}
				createdAt={createdAt}
			/>
			{children}
		</div>
	);
}

/** 抽屉内输入卡片（新建/编辑） */
export function EpubThoughtComposeCard({
	mode,
	username,
	avatar,
	createdAt,
	children,
	actions,
	className,
}: {
	mode?: 'create' | 'edit';
	username?: string;
	avatar?: string;
	createdAt?: string;
	children: ReactNode;
	/** 输入框内底栏操作（对齐 ChatEntry 取消/发送布局） */
	actions?: ReactNode;
	className?: string;
}) {
	return (
		<div className={className}>
			{username ? (
				<ThoughtUserMeta
					username={username}
					avatar={avatar}
					createdAt={createdAt}
					mode={mode}
				/>
			) : null}
			<div className="flex h-28 flex-col overflow-hidden">
				<div className="min-h-0 flex-1">{children}</div>
				{actions ? (
					<div className="mb-1 flex shrink-0 items-center justify-end gap-2 p-2.5">
						{actions}
					</div>
				) : null}
			</div>
		</div>
	);
}
