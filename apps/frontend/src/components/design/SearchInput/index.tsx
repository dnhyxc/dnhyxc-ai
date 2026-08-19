import { Input } from '@ui/input';
import { memo, type Ref, useEffect, useState } from 'react';

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
	const [draft, setDraft] = useState(committedQuery);

	useEffect(() => {
		setDraft(committedQuery);
	}, [committedQuery]);

	return (
		<Input
			ref={inputRef}
			type="search"
			size={18}
			autoFocus={autoFocus}
			value={draft}
			onChange={(e) => {
				const next = e.target.value;
				setDraft(next);
				// 原生清除图标：清空后立即重置，无需回车
				if (next === '' && committedQuery.trim() !== '') {
					onCommit('');
				}
			}}
			onKeyDown={(e) => {
				if (e.key === 'Escape') {
					e.preventDefault();
					onEscape?.();
					return;
				}
				if (e.key !== 'Enter') return;
				e.preventDefault();
				onCommit(draft);
			}}
			placeholder={placeholder}
			aria-label={placeholder}
			className={className}
		/>
	);
}

export default memo(SearchInput);
