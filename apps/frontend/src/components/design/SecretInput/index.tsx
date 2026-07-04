import { Button } from '@ui/button';
import { Input } from '@ui/index';
import { Eye, EyeOff } from 'lucide-react';
import { useCallback, useState } from 'react';
import { useI18n } from '@/hooks';
import { cn } from '@/lib/utils';

export type SecretInputProps = Omit<
	React.ComponentProps<'input'>,
	'type' | 'autoComplete'
> & {
	/** 外层 relative 容器 */
	wrapperClassName?: string;
	/** 是否显示明文切换按钮，默认 true */
	revealable?: boolean;
	/** 无值时禁用切换按钮，默认 true */
	disableToggleWhenEmpty?: boolean;
	showLabel?: string;
	hideLabel?: string;
	autoComplete?: string;
	/** 受控明文状态；不传则组件内部管理 */
	revealed?: boolean;
	onRevealedChange?: (revealed: boolean) => void;
	defaultRevealed?: boolean;
};

function SecretInput({
	className,
	wrapperClassName,
	revealable = true,
	disableToggleWhenEmpty = true,
	showLabel,
	hideLabel,
	autoComplete = 'new-password',
	revealed: revealedProp,
	onRevealedChange,
	defaultRevealed = false,
	disabled,
	value,
	...props
}: SecretInputProps) {
	const { t } = useI18n();
	const [internalRevealed, setInternalRevealed] = useState(defaultRevealed);
	const revealed = revealedProp ?? internalRevealed;

	const setRevealed = useCallback(
		(next: boolean | ((prev: boolean) => boolean)) => {
			const resolved =
				typeof next === 'function'
					? next(revealedProp ?? internalRevealed)
					: next;
			onRevealedChange?.(resolved);
			if (revealedProp === undefined) {
				setInternalRevealed(resolved);
			}
		},
		[internalRevealed, onRevealedChange, revealedProp],
	);

	const hasValue = value != null && String(value).length > 0;
	const toggleDisabled = disabled || (disableToggleWhenEmpty && !hasValue);
	const showAriaLabel = showLabel ?? t('setting.llm.showApiKey');
	const hideAriaLabel = hideLabel ?? t('setting.llm.hideApiKey');
	const inputType = revealable && !revealed ? 'password' : 'text';

	return (
		<div className={cn('relative w-full', wrapperClassName)}>
			<Input
				type={inputType}
				value={value}
				disabled={disabled}
				autoComplete={autoComplete}
				className={cn(revealable && 'pr-10', className)}
				{...props}
			/>
			{revealable ? (
				<Button
					type="button"
					variant="ghost"
					size="icon"
					tabIndex={-1}
					className="absolute top-1/2 right-1.5 size-6 -translate-y-1/2 text-textcolor/55 hover:text-textcolor"
					disabled={toggleDisabled}
					aria-label={revealed ? hideAriaLabel : showAriaLabel}
					onClick={() => setRevealed((v) => !v)}
				>
					{revealed ? (
						<EyeOff className="size-4" aria-hidden />
					) : (
						<Eye className="size-4" aria-hidden />
					)}
				</Button>
			) : null}
		</div>
	);
}

export default SecretInput;
