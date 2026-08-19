import SearchInput from '@design/SearchInput';
import Tooltip from '@design/Tooltip';
import { Button } from '@ui/index';
import { Search } from 'lucide-react';
import { observer } from 'mobx-react';
import { useEffect, useRef, useState } from 'react';
import { useI18n } from '@/hooks';
import { cn } from '@/lib/utils';
import ebookStore from '@/store/ebook';

function EbookShelfSearch() {
	const { t } = useI18n();
	const [open, setOpen] = useState(false);
	const inputRef = useRef<HTMLInputElement>(null);
	const actionLabel = open
		? t('ebook.shelf.searchClose')
		: t('ebook.shelf.search');

	useEffect(() => {
		if (!open) return;
		const timer = window.setTimeout(() => inputRef.current?.focus(), 200);
		return () => window.clearTimeout(timer);
	}, [open]);

	const closeSearch = () => {
		setOpen(false);
		if (ebookStore.titleKeyword.trim()) {
			void ebookStore.refreshList('');
		}
	};

	return (
		<div
			className={cn(
				'flex min-w-0 items-center',
				open && 'h-8 overflow-hidden rounded-md border border-theme/15',
			)}
		>
			<div
				className={cn(
					'grid min-w-0 transition-[grid-template-columns] duration-200 ease-out',
					open ? 'grid-cols-[1fr]' : 'grid-cols-[0fr]',
				)}
			>
				<div className="min-w-0 overflow-hidden">
					<div className="w-52">
						<SearchInput
							inputRef={inputRef}
							committedQuery={ebookStore.titleKeyword}
							onCommit={(q) => void ebookStore.refreshList(q)}
							onEscape={closeSearch}
							placeholder={t('ebook.shelf.searchPlaceholder')}
							className="h-8 rounded-none border-0! bg-transparent px-2.5 shadow-none text-textcolor placeholder:text-sm placeholder:text-textcolor/60 focus-visible:border-0! focus-visible:ring-0!"
						/>
					</div>
				</div>
			</div>
			<Tooltip
				side="top"
				sideOffset={6}
				delayDuration={300}
				shadow
				content={actionLabel}
			>
				<Button
					type="button"
					variant="link"
					size="sm"
					className={cn(
						'h-8 shrink-0 gap-1.5',
						open ? 'rounded-l-none border-theme/10 border-l px-2.5' : 'px-0!',
					)}
					aria-label={actionLabel}
					aria-expanded={open}
					onClick={() => {
						if (open) closeSearch();
						else setOpen(true);
					}}
				>
					<Search className="size-4" aria-hidden />
					<span>{actionLabel}</span>
				</Button>
			</Tooltip>
		</div>
	);
}

export default observer(EbookShelfSearch);
