/**
 * 听写 / 拼写练习入口（通用）
 *
 * - 组件：`EnglishPracticeEntry`（link / button / text / icon）
 * - 逻辑：`openEnglishPractice`、`useOpenEnglishPractice`
 */
import Tooltip from '@design/Tooltip';
import { Button } from '@ui/index';
import { Headphones } from 'lucide-react';
import {
	type ComponentPropsWithoutRef,
	type MouseEvent,
	type ReactNode,
	useCallback,
} from 'react';
import { type NavigateFunction, useNavigate } from 'react-router';
import { useI18n } from '@/hooks';
import { cn } from '@/lib/utils';
import {
	resolveEnglishPracticePoolKey,
	setEnglishPracticePoolMeta,
} from '@/store/englishPracticePool';
import type { BuildEnglishPracticeSearchParamsInput } from '../practice/types';
import { englishPracticeUrl } from '../practice/utils/paths';

export type OpenEnglishPracticeOptions = {
	/** 跳转前写入词表池元数据（total / title），默认 true */
	syncPoolMeta?: boolean;
};

export function openEnglishPractice(
	navigate: NavigateFunction,
	practice: BuildEnglishPracticeSearchParamsInput,
	options?: OpenEnglishPracticeOptions,
): void {
	if (options?.syncPoolMeta !== false) {
		const key = resolveEnglishPracticePoolKey({
			contentKind: practice.contentKind,
			source: practice.source,
			libraryId: practice.libraryId,
			streamId: practice.streamId,
		});
		if (key) {
			setEnglishPracticePoolMeta(key, {
				total: practice.poolTotal,
				title: practice.sourceTitle,
			});
		}
	}
	navigate(englishPracticeUrl(practice));
}

export function normalizePracticePoolTotal(
	poolTotal: number | undefined,
): number | undefined {
	return poolTotal != null && poolTotal > 0 ? poolTotal : undefined;
}

export type EnglishPracticeEntryVariant = 'link' | 'button' | 'text' | 'icon';

export type EnglishPracticeEntryProps = {
	/** 练习页 query 参数（source 必填，其余按入口传入） */
	practice: BuildEnglishPracticeSearchParamsInput;
	syncPoolMeta?: boolean;
	disabled?: boolean;
	variant?: EnglishPracticeEntryVariant;
	className?: string;
	iconClassName?: string;
	/** 是否在文案旁显示耳机图标；footer 等纯文字按钮传 false */
	showIcon?: boolean;
	/** 覆盖默认 i18n 文案；icon 变体同时作为 aria-label */
	label?: string;
	children?: ReactNode;
	/** icon 变体：悬停提示（未传则用 label 或默认 entry 文案） */
	tooltip?: string;
	onBeforeNavigate?: (event: MouseEvent<HTMLButtonElement>) => void;
	onClick?: ComponentPropsWithoutRef<'button'>['onClick'];
} & Omit<
	ComponentPropsWithoutRef<'button'>,
	'children' | 'onClick' | 'disabled'
>;

export function useOpenEnglishPractice() {
	const navigate = useNavigate();
	return useCallback(
		(
			practice: BuildEnglishPracticeSearchParamsInput,
			options?: OpenEnglishPracticeOptions,
		) => {
			openEnglishPractice(navigate, practice, options);
		},
		[navigate],
	);
}

const VARIANT_ICON_SIZE: Record<EnglishPracticeEntryVariant, string> = {
	link: 'size-3.5',
	button: 'size-3.5',
	text: 'size-4',
	icon: 'size-3.5',
};

export function EnglishPracticeEntry({
	practice,
	syncPoolMeta = true,
	disabled = false,
	variant = 'link',
	className,
	iconClassName,
	showIcon = true,
	label,
	children,
	tooltip,
	onBeforeNavigate,
	onClick,
	type = 'button',
	...rest
}: EnglishPracticeEntryProps) {
	const { t } = useI18n();
	const navigate = useNavigate();

	const entryLabel = label ?? t('englishLearning.practice.entry');
	const ariaLabel = rest['aria-label'] ?? entryLabel;

	const handleClick = useCallback(
		(event: MouseEvent<HTMLButtonElement>) => {
			onBeforeNavigate?.(event);
			if (event.defaultPrevented) return;
			onClick?.(event);
			if (disabled) return;
			openEnglishPractice(
				navigate,
				{
					...practice,
					poolTotal: normalizePracticePoolTotal(practice.poolTotal),
				},
				{ syncPoolMeta },
			);
		},
		[disabled, navigate, onBeforeNavigate, onClick, practice, syncPoolMeta],
	);

	const icon = showIcon ? (
		<Headphones
			className={cn(VARIANT_ICON_SIZE[variant], iconClassName)}
			aria-hidden
		/>
	) : null;

	const withLabel = variant !== 'icon';
	const content =
		children ??
		(variant === 'icon' ? (
			icon
		) : (
			<>
				{icon}
				{withLabel ? entryLabel : null}
			</>
		));
	const iconGap = showIcon && withLabel ? 'gap-1' : undefined;

	if (variant === 'text') {
		return (
			<button
				type={type}
				disabled={disabled}
				aria-label={ariaLabel}
				className={cn(
					'flex items-center text-sm text-teal-500 hover:text-teal-400',
					iconGap,
					disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer',
					className,
				)}
				onClick={handleClick}
				{...rest}
			>
				{content}
			</button>
		);
	}

	if (variant === 'icon') {
		const iconButton = (
			<Button
				type={type}
				variant="ghost"
				size="sm"
				disabled={disabled}
				aria-label={ariaLabel}
				className={cn(
					'h-7 w-7 shrink-0 rounded-md p-0 transition-colors',
					'text-textcolor/65 hover:border hover:border-theme/20 hover:bg-theme/10 hover:text-teal-600 dark:hover:text-teal-400',
					className,
				)}
				onClick={handleClick}
				{...rest}
			>
				{content}
			</Button>
		);
		const tip = tooltip ?? entryLabel;
		if (tip) {
			return (
				<Tooltip content={tip} side="left" disableHoverableContent>
					{iconButton}
				</Tooltip>
			);
		}
		return iconButton;
	}

	if (variant === 'button') {
		return (
			<Button
				type={type}
				size="sm"
				disabled={disabled}
				aria-label={ariaLabel}
				className={cn(
					'shrink-0 text-white bg-teal-500 hover:bg-teal-600',
					iconGap,
					className,
				)}
				onClick={handleClick}
				{...rest}
			>
				{content}
			</Button>
		);
	}

	return (
		<Button
			type={type}
			variant="link"
			disabled={disabled}
			aria-label={ariaLabel}
			className={cn(
				'shrink-0 px-0! text-teal-500 hover:text-teal-400',
				iconGap,
				className,
			)}
			onClick={handleClick}
			{...rest}
		>
			{content}
		</Button>
	);
}
