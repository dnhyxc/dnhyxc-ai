import { ChevronRight } from 'lucide-react';
import { useI18n } from '@/hooks';
import { cn } from '@/lib/utils';
import type { EbookThought, EbookThoughtClickCluster } from '../types';
import { getThoughtClusterDisplayQuote } from '../utils/epubThoughtCluster';
import type { EpubQuoteActionBarProps } from './EpubQuoteActionBar';
import { EpubThoughtPanelShell } from './EpubThoughtPanelShell';
import { EpubThoughtItemCard, EpubThoughtQuoteCard } from './EpubThoughtParts';

type Props = {
	onClose: () => void;
	cluster: EbookThoughtClickCluster;
	onSelectThought: (thought: EbookThought) => void;
	onOpenThoughtDetail: (thought: EbookThought) => void;
	quoteActions?: EpubQuoteActionBarProps | null;
	onQuoteHighlightClick?: () => void;
};

function truncateQuoteExcerpt(quote: string, maxLen = 24): string {
	const trimmed = quote.trim();
	if (trimmed.length <= maxLen) return trimmed;
	return `${trimmed.slice(0, maxLen)}…`;
}

/** 嵌套选区聚合后的想法列表（引用区默认最外层 quote） */
export function EpubThoughtList({
	onClose,
	cluster,
	onSelectThought,
	onOpenThoughtDetail,
	quoteActions,
	onQuoteHighlightClick,
}: Props) {
	const { t } = useI18n();
	const quote = getThoughtClusterDisplayQuote(cluster);
	const listTitle = t('ebook.read.thought.viewTitle');
	const showGroupHeaders = cluster.quoteGroups.length > 1;
	const selectedThoughtId = cluster.selectedThoughtId;

	return (
		<EpubThoughtPanelShell>
			<EpubThoughtQuoteCard
				quote={quote}
				title={listTitle}
				count={cluster.allThoughts.length}
				onClose={onClose}
				closeMode="view"
				quoteActions={quoteActions}
				onQuoteHighlightClick={onQuoteHighlightClick}
			/>

			{cluster.selectedThoughtId ? (
				<p className="text-textcolor/50 border-theme/10 border-t px-4 py-2 text-xs">
					{t('ebook.read.thought.selectedQuoteHint')}
				</p>
			) : null}

			{showGroupHeaders
				? cluster.quoteGroups.map((group) => (
						<section key={group.cfiRange}>
							<div className="text-textcolor/55 border-theme/10 bg-theme/5 border-t px-4 py-2 text-xs">
								{t('ebook.read.thought.clusterExcerpt', {
									length: group.spanLength,
								})}
								<span className="text-textcolor/40 mx-1">·</span>
								<span className="text-textcolor/65 italic">
									{truncateQuoteExcerpt(group.quote)}
								</span>
							</div>
							{group.thoughts.map((thought) => (
								<EpubThoughtListItem
									key={thought.id}
									thought={thought}
									selected={thought.id === selectedThoughtId}
									onSelectThought={onSelectThought}
									onOpenThoughtDetail={onOpenThoughtDetail}
								/>
							))}
						</section>
					))
				: cluster.allThoughts.map((thought) => (
						<EpubThoughtListItem
							key={thought.id}
							thought={thought}
							selected={thought.id === selectedThoughtId}
							onSelectThought={onSelectThought}
							onOpenThoughtDetail={onOpenThoughtDetail}
						/>
					))}
		</EpubThoughtPanelShell>
	);
}

function EpubThoughtListItem({
	thought,
	selected,
	onSelectThought,
	onOpenThoughtDetail,
}: {
	thought: EbookThought;
	selected: boolean;
	onSelectThought: (thought: EbookThought) => void;
	onOpenThoughtDetail: (thought: EbookThought) => void;
}) {
	const { t } = useI18n();

	return (
		<div className="relative border-t border-theme/10">
			<EpubThoughtItemCard
				username={thought.username || t('ebook.read.thought.unknownUser')}
				avatar={thought.avatar}
				createdAt={thought.createdAt}
				selected={selected}
				onClick={() => onSelectThought(thought)}
				onDoubleClick={() => onOpenThoughtDetail(thought)}
				className={cn('pr-12')}
			>
				<p className="text-textcolor text-sm wrap-break-word">
					{thought.content}
				</p>
			</EpubThoughtItemCard>
			<button
				type="button"
				className="text-textcolor/45 hover:text-textcolor absolute right-3 top-4 flex cursor-pointer items-center gap-0.5 rounded-sm px-1 py-0.5 text-xs transition-colors"
				aria-label={t('ebook.read.thought.viewDetail')}
				onClick={(event) => {
					event.stopPropagation();
					onOpenThoughtDetail(thought);
				}}
			>
				{t('ebook.read.thought.viewDetail')}
				<ChevronRight className="size-3.5" aria-hidden />
			</button>
		</div>
	);
}
