import Model from '@design/Model';
import { ScrollArea } from '@ui/index';
import { useI18n } from '@/hooks';
import { cn } from '@/lib/utils';
import type { EbookThought } from '../types';

type Props = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	thoughts: EbookThought[];
	onSelect: (thought: EbookThought) => void;
};

const SCROLL_AREA_EDGE_CLASS =
	'max-h-72 -mx-4.5 min-w-0 w-[calc(100%+2.25rem)]';
const SCROLL_AREA_VIEWPORT_CLASS =
	'min-w-0 max-w-full [&>div]:!min-w-0 [&>div]:!max-w-full [&>div]:min-h-0!';

function formatThoughtTime(iso: string): string {
	try {
		return new Date(iso).toLocaleString();
	} catch {
		return iso;
	}
}

/** 同一段落有多条想法时，先列出再选择查看 */
export function EpubThoughtListDialog({
	open,
	onOpenChange,
	thoughts,
	onSelect,
}: Props) {
	const { t } = useI18n();
	const quote = thoughts[0]?.quote ?? '';
	const listTitle = t('ebook.read.thought.listTitle', {
		count: thoughts.length,
	});

	return (
		<Model
			open={open}
			onOpenChange={onOpenChange}
			title={listTitle}
			width="38rem"
			footer={null}
		>
			<div className="flex min-w-0 flex-col">
				{quote ? (
					<div className="px-0.5">
						<blockquote
							className={cn(
								'border-amber-500/50 bg-amber-500/5 text-textcolor/80',
								'mb-3 border-l-5 py-2 pl-2 pr-2 box-border text-sm leading-relaxed rounded-md',
							)}
						>
							{quote}
						</blockquote>
					</div>
				) : null}

				<ScrollArea
					className={SCROLL_AREA_EDGE_CLASS}
					viewportClassName={SCROLL_AREA_VIEWPORT_CLASS}
				>
					<div className="flex min-w-0 flex-col gap-2 px-4.5 pb-2">
						{thoughts.map((thought) => (
							<button
								key={thought.id}
								type="button"
								className={cn(
									'hover:border-amber-500/40 hover:bg-amber-500/5',
									'border-theme/10 w-full rounded-md border p-3 text-left transition-colors',
									'outline-none focus:outline-none',
								)}
								onClick={() => onSelect(thought)}
							>
								<p className="text-textcolor/50 mb-1 text-xs">
									{thought.username || t('ebook.read.thought.unknownUser')}
									{' · '}
									{formatThoughtTime(thought.updatedAt)}
								</p>
								<p className="text-textcolor line-clamp-3 break-words text-sm leading-relaxed">
									{thought.content}
								</p>
							</button>
						))}
					</div>
				</ScrollArea>
			</div>
		</Model>
	);
}
