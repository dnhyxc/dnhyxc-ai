import { useI18n } from '@/hooks';
import { cn } from '@/lib/utils';
import type { EbookThought, EbookThoughtClickCluster } from '../../types';
import { getThoughtClusterDisplayQuote } from '../../utils/epub/mark/epubThoughtCluster';
import { epubReaderChromeBorderColorClass } from '../../utils/epub/reader/epubReaderSettings';
import type { EpubQuoteActionBarProps } from '../selection/EpubQuoteActionBar';
import { EpubThoughtPanelShell } from './EpubThoughtPanelShell';
import {
	EpubThoughtClusterExcerpt,
	EpubThoughtItemCard,
	EpubThoughtQuoteCard,
} from './EpubThoughtParts';

type Props = {
	onClose: () => void;
	cluster: EbookThoughtClickCluster;
	onOpenThoughtDetail: (thought: EbookThought) => void;
	quoteActions?: EpubQuoteActionBarProps | null;
};

/** 嵌套选区聚合后的想法列表（引用区默认最外层 quote） */
export function EpubThoughtList({
	onClose,
	cluster,
	onOpenThoughtDetail,
	quoteActions,
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
			/>

			{cluster.selectedThoughtId ? (
				<p
					className={cn(
						'text-textcolor/50 border-t px-4 py-2 text-xs',
						epubReaderChromeBorderColorClass,
					)}
				>
					{t('ebook.read.thought.selectedQuoteHint')}
				</p>
			) : null}

			{showGroupHeaders
				? cluster.quoteGroups.map((group) => (
						<section key={group.cfiRange}>
							<EpubThoughtClusterExcerpt
								spanLength={group.spanLength}
								quote={group.quote}
							/>
							{group.thoughts.map((thought) => (
								<EpubThoughtListItem
									key={thought.id}
									thought={thought}
									selected={thought.id === selectedThoughtId}
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
							onOpenThoughtDetail={onOpenThoughtDetail}
						/>
					))}
		</EpubThoughtPanelShell>
	);
}

function EpubThoughtListItem({
	thought,
	selected,
	onOpenThoughtDetail,
}: {
	thought: EbookThought;
	selected: boolean;
	onOpenThoughtDetail: (thought: EbookThought) => void;
}) {
	const { t } = useI18n();

	return (
		<EpubThoughtItemCard
			username={thought.username || t('ebook.read.thought.unknownUser')}
			avatar={thought.avatar}
			createdAt={thought.createdAt}
			selected={selected}
			onClick={() => onOpenThoughtDetail(thought)}
		>
			<p className="text-textcolor text-sm wrap-break-word">
				{thought.content}
			</p>
		</EpubThoughtItemCard>
	);
}
