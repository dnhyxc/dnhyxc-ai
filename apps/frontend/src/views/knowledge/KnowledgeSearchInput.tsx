import { Input } from '@ui/input';
import { memo, useEffect, useState } from 'react';

type Props = {
	/** 已提交的搜索词（回车 / 清除后由父级更新） */
	committedQuery: string;
	onCommit: (query: string) => void;
	placeholder: string;
	className?: string;
};

/**
 * 搜索草稿态留在本组件内，避免每次按键触发父级（含列表）重渲导致输入卡顿。
 */
function KnowledgeSearchInput({
	committedQuery,
	onCommit,
	placeholder,
	className,
}: Props) {
	const [draft, setDraft] = useState(committedQuery);

	useEffect(() => {
		setDraft(committedQuery);
	}, [committedQuery]);

	return (
		<Input
			type="search"
			size={18}
			value={draft}
			onChange={(e) => {
				const next = e.target.value;
				setDraft(next);
				// 原生清除图标：清空后立即重置列表，无需回车
				if (next === '' && committedQuery.trim() !== '') {
					onCommit('');
				}
			}}
			onKeyDown={(e) => {
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

export default memo(KnowledgeSearchInput);
