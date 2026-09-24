/**
 * 语句库 / 历史行：导出该集合全部原句为 JSON。
 */
import Tooltip from '@design/Tooltip';
import { Button } from '@ui/button';
import { Toast } from '@ui/sonner';
import { FileJson } from 'lucide-react';
import { type MouseEvent, useState } from 'react';
import { Spinner } from '@/components/ui';
import { useI18n } from '@/hooks';
import { cn } from '@/lib/utils';
import { exportClassicQuotesJson } from '../../utils/exportClassicQuotes';

type ExportProps = {
	source: 'library' | 'pack';
	libraryId?: string;
	streamId?: string;
	title?: string;
	quoteCount?: number;
	disabled?: boolean;
	onBeforeClick?: (e: MouseEvent<HTMLButtonElement>) => void;
};

export function Export({
	source,
	libraryId,
	streamId,
	title,
	quoteCount,
	disabled,
	onBeforeClick,
}: ExportProps) {
	const { t } = useI18n();
	const [busy, setBusy] = useState(false);
	const label = t('englishLearning.classic.exportJson');
	const idOk =
		source === 'library'
			? Boolean(libraryId?.trim())
			: Boolean(streamId?.trim());

	return (
		<Tooltip side="top" content={label}>
			<Button
				type="button"
				variant="ghost"
				size="sm"
				disabled={disabled || busy || !idOk}
				aria-label={label}
				aria-busy={busy}
				className={cn(
					'h-7 w-7 shrink-0 rounded-md p-0 transition-colors',
					'text-textcolor/65 hover:border hover:border-teal-500/15 hover:bg-teal-500/10 hover:text-teal-500',
				)}
				onClick={(e) => {
					onBeforeClick?.(e);
					e.stopPropagation();
					if (busy || !idOk) return;
					const name =
						title?.trim() || t('englishLearning.classic.exportFileFallback');
					setBusy(true);
					void exportClassicQuotesJson(
						source === 'library'
							? {
									source,
									libraryId: libraryId!.trim(),
									title: name,
									quoteCount,
								}
							: {
									source,
									streamId: streamId!.trim(),
									title: name,
									quoteCount,
								},
					)
						.catch((err: unknown) => {
							const empty = err instanceof Error && err.message === 'empty';
							Toast({
								type: 'error',
								title: t(
									empty
										? 'englishLearning.classic.exportEmpty'
										: 'englishLearning.classic.exportFailed',
								),
							});
						})
						.finally(() => setBusy(false));
				}}
			>
				{busy ? (
					<Spinner className="size-3.5 text-textcolor" aria-hidden />
				) : (
					<FileJson className="size-3.5" aria-hidden />
				)}
			</Button>
		</Tooltip>
	);
}
