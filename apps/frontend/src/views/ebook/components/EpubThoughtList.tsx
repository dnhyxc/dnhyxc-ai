import { useI18n } from '@/hooks';
import type { EbookThought } from '../types';
import type { EpubQuoteActionBarProps } from './EpubQuoteActionBar';
import { EpubThoughtPanelShell } from './EpubThoughtPanelShell';
import { EpubThoughtItemCard, EpubThoughtQuoteCard } from './EpubThoughtParts';

type Props = {
	onClose: () => void;
	thoughts: EbookThought[];
	onSelect: (thought: EbookThought) => void;
	quoteActions?: EpubQuoteActionBarProps | null;
};

/** 同一段落有多条想法时，右侧分栏列表 */
export function EpubThoughtList({
	onClose,
	thoughts,
	onSelect,
	quoteActions,
}: Props) {
	const { t } = useI18n();
	const quote = thoughts[0]?.quote ?? '';
	const listTitle = t('ebook.read.thought.viewTitle');

	return (
		<EpubThoughtPanelShell>
			<EpubThoughtQuoteCard
				quote={quote}
				title={listTitle}
				count={thoughts.length}
				onClose={onClose}
				closeMode="view"
				quoteActions={quoteActions}
			/>

			{thoughts.map((thought) => (
				<EpubThoughtItemCard
					key={thought.id}
					username={thought.username || t('ebook.read.thought.unknownUser')}
					avatar={thought.avatar}
					createdAt={thought.createdAt}
					onClick={() => onSelect(thought)}
				>
					<p className="text-textcolor text-sm wrap-break-word">
						{thought.content}
					</p>
				</EpubThoughtItemCard>
			))}
		</EpubThoughtPanelShell>
	);
}
