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
import type { EpubHighlightColorId, EpubHighlightStyle } from '../types';
import { EPUB_HIGHLIGHT_COLOR_OPTIONS } from '../utils/epubUserHighlights';
import {
	EpubQuoteActionBar,
	type EpubQuoteActionBarProps,
} from './EpubQuoteActionBar';

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

function useQuoteExcerptClamp(quote: string) {
	const wrapperRef = useRef<HTMLDivElement>(null);
	const textRef = useRef<HTMLParagraphElement>(null);
	const [expanded, setExpanded] = useState(false);
	const [overflows, setOverflows] = useState(false);

	useEffect(() => {
		setExpanded(false);
	}, [quote]);

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
			clone.classList.remove('line-clamp-3');
			wrapper.appendChild(clone);
			const fullHeight = clone.scrollHeight;
			clone.remove();

			setOverflows(fullHeight > lineHeight * QUOTE_CLAMP_LINES + 1);
		};

		measure();
		const ro = new ResizeObserver(measure);
		ro.observe(wrapper);
		return () => ro.disconnect();
	}, [quote]);

	return { wrapperRef, textRef, expanded, setExpanded, overflows };
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
	onDoubleClick?: () => void;
};

/** 引用卡片顶栏 / 底栏操作条统一行高 */
const quoteCardBarRowClass = 'flex h-[52px] shrink-0 items-center';

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
	const { wrapperRef, textRef, expanded, setExpanded, overflows } =
		useQuoteExcerptClamp(quote);

	const openPopBarAtBook = () => {
		onQuoteHighlightClick?.();
	};

	const drawerQuoteActions = quoteActions;

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
					<div className="flex shrink-0 items-center gap-0.5">
						{overflows && hasQuote ? (
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
									className="text-textcolor/60 hover:text-textcolor shrink-0 cursor-pointer rounded-sm p-1 transition-colors"
									aria-label={
										expanded
											? t('ebook.read.thought.quoteCollapse')
											: t('ebook.read.thought.quoteExpand')
									}
									aria-expanded={expanded}
									onClick={() => setExpanded((v) => !v)}
								>
									{expanded ? (
										<CircleChevronUp className="size-4.5" aria-hidden />
									) : (
										<CircleChevronDown className="size-4.5" aria-hidden />
									)}
								</button>
							</Tooltip>
						) : null}
						{onClose ? (
							<Tooltip
								side="top"
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
									className="text-textcolor/60 hover:text-textcolor -mr-1 shrink-0 cursor-pointer rounded-sm p-1 transition-colors"
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
					ref={wrapperRef}
					className="px-4 pb-3 pt-2"
					aria-label={t('ebook.read.thought.bookExcerpt')}
				>
					<p
						ref={textRef}
						className={cn(
							'text-textcolor/85 font-serif leading-[1.85] wrap-break-word',
							overflows && !expanded && 'line-clamp-3',
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
				</figure>
			) : null}
			{drawerQuoteActions && hasQuote ? (
				<div className={cn(quoteCardBarRowClass, 'border-theme/10 border-t')}>
					<EpubQuoteActionBar
						{...drawerQuoteActions}
						variant="drawer"
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
	onDoubleClick,
}: ThoughtCardProps) {
	const Comp = onClick ? 'button' : 'div';

	return (
		<Comp
			type={onClick ? 'button' : undefined}
			onClick={onClick}
			onDoubleClick={onDoubleClick}
			data-selected={selected ? 'true' : undefined}
			className={cn(
				'p-4 text-left transition-colors border-t border-theme/10',
				onClick &&
					'cursor-pointer hover:bg-theme/10 outline-none focus:outline-none focus-visible:outline-none focus-visible:ring-0',
				selected && 'bg-theme/12',
				className,
			)}
		>
			<ThoughtUserMeta
				username={username}
				avatar={avatar}
				createdAt={createdAt}
			/>
			{children}
		</Comp>
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
			<div className="bg-theme/2 flex h-28 flex-col overflow-hidden">
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
