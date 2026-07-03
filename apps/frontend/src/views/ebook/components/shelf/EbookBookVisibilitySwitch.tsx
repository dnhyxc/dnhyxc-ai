import Confirm from '@design/Confirm';
import Tooltip from '@design/Tooltip';
import { Button } from '@ui/index';
import { Toast } from '@ui/sonner';
import { Globe, Lock } from 'lucide-react';
import { useCallback, useState } from 'react';
import { useI18n } from '@/hooks';
import { cn } from '@/lib/utils';
import ebookStore from '@/store/ebook';
import { getRequestErrorMessage } from '@/utils/fetch';
import type { Book } from '../../types';

type Props = {
	book: Book;
	/** 已上云 EPUB 源书才可公开 */
	canToggle?: boolean;
	className?: string;
	/** 书架卡片：仅图标，避免窄列文字溢出 */
	compact?: boolean;
	tooltipSide?: 'top' | 'bottom';
};

/** 书主将 EPUB 设为公开 / 私有 */
export function EbookBookVisibilitySwitch({
	book,
	canToggle = true,
	className,
	compact = false,
	tooltipSide = 'top',
}: Props) {
	const { t } = useI18n();
	const [confirmOpen, setConfirmOpen] = useState(false);
	const [pendingPublic, setPendingPublic] = useState<boolean | null>(null);
	const [busy, setBusy] = useState(false);

	const isPublic = Boolean(book.isPublic);
	const disabled =
		!canToggle || book.fmt !== 'epub' || book.sourceBookId != null || busy;

	const requestToggle = useCallback(
		(next: boolean) => {
			if (disabled) return;
			if (next) {
				setPendingPublic(true);
				setConfirmOpen(true);
				return;
			}
			setPendingPublic(false);
			setConfirmOpen(true);
		},
		[disabled],
	);

	const onConfirm = useCallback(async () => {
		if (pendingPublic == null) return;
		setBusy(true);
		try {
			await ebookStore.setBookPublic(book.id, pendingPublic);
			setConfirmOpen(false);
			setPendingPublic(null);
		} catch (e) {
			Toast({
				type: 'error',
				title: t('ebook.public.visibilityFailed'),
				message: getRequestErrorMessage(e),
			});
		} finally {
			setBusy(false);
		}
	}, [book.id, pendingPublic, t]);

	const label = isPublic
		? t('ebook.public.makePrivate')
		: t('ebook.public.makePublic');

	const tooltipContent =
		!canToggle && book.fmt === 'epub' && !book.sourceBookId
			? t('ebook.public.localCannotShare')
			: disabled && book.fmt !== 'epub'
				? t('ebook.public.epubOnly')
				: label;

	const iconBtn = (
		<Button
			type="button"
			variant="ghost"
			size="icon-sm"
			className={cn(className, disabled && 'opacity-50')}
			disabled={disabled}
			aria-label={tooltipContent}
			onClick={() => requestToggle(!isPublic)}
		>
			{isPublic ? (
				<Globe className="size-4 shrink-0 text-teal-500" aria-hidden />
			) : (
				<Lock className="size-4 shrink-0" aria-hidden />
			)}
		</Button>
	);

	return (
		<>
			<Confirm
				open={confirmOpen}
				onOpenChange={(open) => {
					if (!open) {
						setConfirmOpen(false);
						setPendingPublic(null);
					}
				}}
				title={
					pendingPublic
						? t('ebook.public.confirmPublicTitle')
						: t('ebook.public.confirmPrivateTitle')
				}
				description={
					pendingPublic
						? t('ebook.public.confirmPublicDesc')
						: t('ebook.public.confirmPrivateDesc')
				}
				confirmText={t('common.confirm')}
				cancelText={t('common.cancel')}
				closeOnConfirm={false}
				onConfirm={() => void onConfirm()}
			/>
			{compact ? (
				<Tooltip
					side={tooltipSide}
					sideOffset={tooltipSide === 'bottom' ? 6 : 4}
					delayDuration={tooltipSide === 'bottom' ? 200 : 300}
					shadow
					content={tooltipContent}
				>
					<span className="inline-flex shrink-0">{iconBtn}</span>
				</Tooltip>
			) : (
				<Tooltip
					side="bottom"
					sideOffset={6}
					delayDuration={300}
					shadow
					content={tooltipContent}
				>
					<span className="inline-flex shrink-0">
						<Button
							type="button"
							variant="ghost"
							size="sm"
							className={className}
							disabled={disabled}
							onClick={() => requestToggle(!isPublic)}
						>
							{isPublic ? (
								<Globe className="mr-1.5 size-4 text-teal-500" aria-hidden />
							) : (
								<Lock className="mr-1.5 size-4" aria-hidden />
							)}
							{label}
						</Button>
					</span>
				</Tooltip>
			)}
		</>
	);
}
