import Model from '@design/Model';
import { Button, ScrollArea } from '@ui/index';
import { Toast } from '@ui/sonner';
import { CheckCircle } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useI18n } from '@/hooks';
import { downloadBlob } from '@/utils';
import { copyCanvasToClipboard } from '@/utils/clipboard';
import { renderQuoteShareCard } from '../utils/epubQuoteShareCard';
import type { QuoteShareRun } from '../utils/epubQuoteShareStyled';

type Props = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	quote: string;
	quoteSegments?: QuoteShareRun[];
	bookTitle: string;
	author?: string;
};

/** 预览区固定高度，避免生成前后弹窗高度跳动 */
const PREVIEW_BOX_CLASS = 'h-[min(calc(75vh-10rem),600px)]';

function quoteShareFileName(bookTitle: string): string {
	const safe = bookTitle
		.replace(/[\\/:*?"<>|]/g, '_')
		.replace(/\s+/g, '_')
		.slice(0, 48);
	return `书摘-${safe || 'share'}.png`;
}

export function EpubQuoteShareDialog({
	open,
	onOpenChange,
	quote,
	quoteSegments,
	bookTitle,
	author,
}: Props) {
	const { t, locale } = useI18n();
	const [previewUrl, setPreviewUrl] = useState<string | null>(null);
	const [canvas, setCanvas] = useState<HTMLCanvasElement | null>(null);
	const [loading, setLoading] = useState(false);
	const [copying, setCopying] = useState(false);
	const [downloading, setDownloading] = useState(false);
	const [copied, setCopied] = useState(false);
	const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	useEffect(() => {
		if (!open) {
			setPreviewUrl(null);
			setCanvas(null);
			setCopied(false);
			setCopying(false);
			setDownloading(false);
			return;
		}

		let cancelled = false;
		setLoading(true);
		setPreviewUrl(null);
		setCanvas(null);

		void renderQuoteShareCard({
			quote,
			quoteSegments,
			bookTitle,
			author,
			brand: t('ebook.read.quoteShare.brand'),
			locale,
		})
			.then((result) => {
				if (cancelled) return;
				setPreviewUrl(result.dataUrl);
				setCanvas(result.canvas);
			})
			.catch(() => {
				if (cancelled) return;
				Toast({
					type: 'error',
					title: t('ebook.read.quoteShare.generateFailed'),
				});
				onOpenChange(false);
			})
			.finally(() => {
				if (!cancelled) setLoading(false);
			});

		return () => {
			cancelled = true;
		};
	}, [open, quote, quoteSegments, bookTitle, author, locale, t, onOpenChange]);

	useEffect(() => {
		return () => {
			if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
		};
	}, []);

	const onCopyImage = useCallback(() => {
		if (!canvas || copying) return;
		setCopying(true);
		copyCanvasToClipboard(canvas)
			.then(() => {
				setCopied(true);
				if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
				copyTimerRef.current = setTimeout(() => setCopied(false), 1500);
				Toast({
					type: 'success',
					title: t('ebook.read.quoteShare.copySuccess'),
				});
			})
			.catch(() => {
				Toast({
					type: 'error',
					title: t('ebook.read.quoteShare.copyFailed'),
				});
			})
			.finally(() => setCopying(false));
	}, [canvas, copying, t]);

	const onDownloadImage = useCallback(() => {
		if (!canvas || downloading) return;
		setDownloading(true);
		canvas.toBlob((blob) => {
			if (!blob) {
				setDownloading(false);
				Toast({
					type: 'error',
					title: t('ebook.read.quoteShare.downloadFailed'),
				});
				return;
			}
			void downloadBlob(
				{
					file_name: quoteShareFileName(bookTitle),
					id: 'ebook-quote-share',
				},
				blob,
			)
				.catch(() => {
					Toast({
						type: 'error',
						title: t('ebook.read.quoteShare.downloadFailed'),
					});
				})
				.finally(() => setDownloading(false));
		}, 'image/png');
	}, [canvas, downloading, bookTitle, t]);

	return (
		<Model
			open={open}
			onOpenChange={onOpenChange}
			title={t('ebook.read.quoteShare.title')}
			description={t('ebook.read.quoteShare.hint')}
			width="400px"
			showFooter={false}
			footer={null}
		>
			<div
				className={`flex min-h-0 flex-col overflow-hidden rounded-md border border-theme/10 bg-[#F7F7F7] ${PREVIEW_BOX_CLASS}`}
			>
				<ScrollArea
					className="min-h-0 flex-1 -mx-4.5 min-w-0 w-[calc(100%+2.25rem)] rounded-[inherit]"
					viewportClassName="min-w-0 max-w-full rounded-[inherit] [&>div]:!block [&>div]:!min-h-0"
				>
					<div className="px-4.5">
						{loading ? (
							<div
								className={`flex w-full min-h-[min(calc(75vh-10rem),600px)] items-center justify-center text-sm text-textcolor/50`}
							>
								{t('ebook.read.quoteShare.generating')}
							</div>
						) : previewUrl ? (
							<div className="overflow-hidden rounded-md">
								<img
									src={previewUrl}
									alt={t('ebook.read.quoteShare.previewAlt')}
									className="block w-full"
								/>
							</div>
						) : null}
					</div>
				</ScrollArea>
			</div>

			<div className="grid shrink-0 grid-cols-2 gap-4 pt-0.5">
				<Button
					type="button"
					className="min-w-0 w-full cursor-pointer"
					disabled={loading || copying || downloading || !canvas}
					onClick={onCopyImage}
				>
					{copied ? (
						<span
							className="inline-flex size-4 shrink-0 items-center justify-center"
							aria-hidden
						>
							<CheckCircle className="size-4" />
						</span>
					) : null}
					{copied
						? t('ebook.read.quoteShare.copied')
						: t('ebook.read.quoteShare.copyImage')}
				</Button>
				<Button
					type="button"
					className="min-w-0 w-full cursor-pointer"
					disabled={loading || copying || downloading || !canvas}
					onClick={onDownloadImage}
				>
					{t('common.download')}
				</Button>
			</div>
		</Model>
	);
}
