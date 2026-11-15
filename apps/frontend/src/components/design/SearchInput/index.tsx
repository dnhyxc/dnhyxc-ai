import { Button } from '@ui/index';
import { Input } from '@ui/input';
import { X } from 'lucide-react';
import { memo, type Ref, useEffect, useState } from 'react';
import { useI18n } from '@/hooks';
import { cn } from '@/lib/utils';

export type SearchInputProps = {
	/** 已提交的搜索词（回车 / 清除后由父级更新） */
	committedQuery: string;
	onCommit: (query: string) => void;
	placeholder: string;
	className?: string;
	autoFocus?: boolean;
	inputRef?: Ref<HTMLInputElement>;
	onEscape?: () => void;
};

/**
 * 回车提交搜索；草稿态留在组件内，避免按键拖垮父级列表。
 * 有内容时右侧显示清空，点下去立即提交空关键词。
 */
function SearchInput({
	committedQuery,
	onCommit,
	placeholder,
	className,
	autoFocus,
	inputRef,
	onEscape,
}: SearchInputProps) {
	const { t } = useI18n();
	const [draft, setDraft] = useState(committedQuery);
	const hasDraft = draft !== '';

	useEffect(() => {
		setDraft(committedQuery);
	}, [committedQuery]);

	const clear = () => {
		setDraft('');
		if (committedQuery.trim() !== '') onCommit('');
	};

	return (
		<div className="relative min-w-0">
			<Input
				ref={inputRef}
				type="search"
				size={18}
				autoFocus={autoFocus}
				value={draft}
				onChange={(e) => {
					const next = e.target.value;
					setDraft(next);
					if (next === '' && committedQuery.trim() !== '') onCommit('');
				}}
				onKeyDown={(e) => {
					if (e.key === 'Escape') {
						e.preventDefault();
						onEscape?.();
						return;
					}
					if (e.key !== 'Enter' || e.nativeEvent.isComposing) return;
					e.preventDefault();
					onCommit(draft);
				}}
				placeholder={placeholder}
				aria-label={placeholder}
				className={cn(
					'[&::-webkit-search-cancel-button]:hidden [&::-webkit-search-decoration]:hidden',
					className,
					hasDraft && 'pr-8',
				)}
			/>
			{hasDraft ? (
				<Button
					type="button"
					variant="ghost"
					size="icon-sm"
					aria-label={t('common.clear')}
					className="absolute top-1/2 right-1 size-6 -translate-y-1/2 p-0 text-textcolor/55 hover:text-textcolor"
					onClick={clear}
				>
					<X className="size-3.5" aria-hidden />
				</Button>
			) : null}
		</div>
	);
}

export default memo(SearchInput);
