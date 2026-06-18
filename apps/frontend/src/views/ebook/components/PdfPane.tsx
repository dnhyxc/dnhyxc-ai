import type { RenderTask } from 'pdfjs-dist';
import { useCallback, useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import type { EbookTocItem } from '../types';
import { loadPdfOutlineToc } from '../utils/pdfOutline';
import { DEFAULT_PDF_ZOOM } from '../utils/pdfReaderSettings';
import { attachPdfScrolledEdgeNav } from '../utils/pdfScrolledNav';
import { pdfjs, pdfLoadOptions } from '../utils/pdfSetup';
import { READER_NATIVE_SCROLLBAR } from '../utils/readerScrollbar';

/** 拷贝一份独立字节，避免 pdf.js worker 转移后原 buffer 被 detach */
function cloneBytes(src: ArrayBuffer): Uint8Array {
	return new Uint8Array(src).slice();
}

function isRenderCancelled(err: unknown): boolean {
	if (!(err instanceof Error)) return false;
	return (
		err.name === 'RenderingCancelledException' ||
		err.message.includes('cancelled') ||
		err.message.includes('same canvas')
	);
}

function readContentWidth(el: HTMLElement): number {
	const style = getComputedStyle(el);
	const horizontal =
		parseFloat(style.paddingLeft) + parseFloat(style.paddingRight);
	return Math.max(0, el.clientWidth - horizontal);
}

type PageEnterScroll = 'top' | 'bottom';

type Props = {
	open: ArrayBuffer;
	startPage?: number;
	/** 相对「适应宽度」的倍数，默认 1 */
	zoomMultiplier?: number;
	onPage: (page: number, percent?: number) => void;
	onPageState?: (page: number, total: number) => void;
	onToc?: (items: EbookTocItem[]) => void;
	onReady?: (api: {
		prev: () => void;
		next: () => void;
		go: (page: number) => void;
	}) => void;
};

export function PdfPane({
	open,
	startPage = 0,
	zoomMultiplier = DEFAULT_PDF_ZOOM,
	onPage,
	onPageState,
	onToc,
	onReady,
}: Props) {
	const scrollRef = useRef<HTMLDivElement>(null);
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const docRef = useRef<pdfjs.PDFDocumentProxy | null>(null);
	const activeRenderTaskRef = useRef<RenderTask | null>(null);
	const pageRef = useRef(0);
	const totalRef = useRef(0);
	const pageEnterScrollRef = useRef<PageEnterScroll>('top');
	const suppressEdgeNavRef = useRef(false);
	const onPageRef = useRef(onPage);
	const onPageStateRef = useRef(onPageState);
	const onTocRef = useRef(onToc);
	const onReadyRef = useRef(onReady);
	const [page, setPage] = useState(startPage);
	const [total, setTotal] = useState(0);
	const [layoutWidth, setLayoutWidth] = useState(0);
	const [err, setErr] = useState<string | null>(null);

	pageRef.current = page;
	totalRef.current = total;
	onPageRef.current = onPage;
	onPageStateRef.current = onPageState;
	onTocRef.current = onToc;
	onReadyRef.current = onReady;

	const goToPage = useCallback(
		(target: number, enterScroll: PageEnterScroll) => {
			const clamped = Math.min(
				Math.max(0, target),
				Math.max(0, totalRef.current - 1),
			);
			pageEnterScrollRef.current = enterScroll;
			setPage(clamped);
		},
		[],
	);

	useEffect(() => {
		const el = scrollRef.current;
		if (!el) return;

		const syncWidth = () => setLayoutWidth(readContentWidth(el));
		syncWidth();

		const ro = new ResizeObserver(syncWidth);
		ro.observe(el);
		return () => ro.disconnect();
	}, []);

	useEffect(() => {
		let cancelled = false;
		docRef.current = null;
		setErr(null);
		setTotal(0);

		const initialPage = startPage;
		const data = cloneBytes(open);

		(async () => {
			try {
				const task = pdfjs.getDocument(pdfLoadOptions(data));
				const doc = await task.promise;
				if (cancelled) return;
				docRef.current = doc;
				setTotal(doc.numPages);
				const p = Math.min(Math.max(0, initialPage), doc.numPages - 1);
				pageEnterScrollRef.current = 'top';
				setPage(p);
				const toc = await loadPdfOutlineToc(doc);
				if (!cancelled) onTocRef.current?.(toc);
			} catch (e) {
				if (!cancelled) {
					setErr(e instanceof Error ? e.message : 'PDF 打开失败');
				}
			}
		})();

		return () => {
			cancelled = true;
			activeRenderTaskRef.current?.cancel();
			activeRenderTaskRef.current = null;
			docRef.current = null;
		};
	}, [open]);

	useEffect(() => {
		const doc = docRef.current;
		const canvas = canvasRef.current;
		if (!doc || !canvas || total === 0 || layoutWidth <= 0) return;

		let cancelled = false;
		setErr(null);

		const run = async () => {
			try {
				activeRenderTaskRef.current?.cancel();
				activeRenderTaskRef.current = null;

				const pdfPage = await doc.getPage(page + 1);
				if (cancelled) return;

				const baseVp = pdfPage.getViewport({ scale: 1 });
				const fitScale = layoutWidth / baseVp.width;
				const cssScale = fitScale * zoomMultiplier;
				const pixelRatio = Math.min(2.5, window.devicePixelRatio || 1);
				const renderScale = cssScale * pixelRatio;
				const vp = pdfPage.getViewport({ scale: renderScale });
				const ctx = canvas.getContext('2d');
				if (!ctx) return;

				canvas.width = vp.width;
				canvas.height = vp.height;
				canvas.style.width = `${baseVp.width * cssScale}px`;
				canvas.style.height = `${baseVp.height * cssScale}px`;

				const task = pdfPage.render({
					canvasContext: ctx,
					viewport: vp,
					canvas,
				});
				activeRenderTaskRef.current = task;
				await task.promise;
				if (cancelled) return;
				activeRenderTaskRef.current = null;

				const container = scrollRef.current;
				if (container) {
					const enter = pageEnterScrollRef.current;
					suppressEdgeNavRef.current = true;
					requestAnimationFrame(() => {
						if (enter === 'bottom') {
							container.scrollTop = container.scrollHeight;
						} else {
							container.scrollTop = 0;
						}
						requestAnimationFrame(() => {
							suppressEdgeNavRef.current = false;
						});
					});
				}

				const pct = Math.round(((page + 1) / total) * 100);
				onPageRef.current(page, pct);
			} catch (e) {
				if (cancelled || isRenderCancelled(e)) return;
				setErr(e instanceof Error ? e.message : 'PDF 渲染失败');
			}
		};

		void run();

		return () => {
			cancelled = true;
			activeRenderTaskRef.current?.cancel();
			activeRenderTaskRef.current = null;
		};
	}, [page, total, layoutWidth, zoomMultiplier]);

	useEffect(() => {
		const container = scrollRef.current;
		if (!container || total <= 0) return;

		return attachPdfScrolledEdgeNav(container, {
			canPrev: () => pageRef.current > 0,
			canNext: () => pageRef.current < totalRef.current - 1,
			onPrev: () => goToPage(pageRef.current - 1, 'bottom'),
			onNext: () => goToPage(pageRef.current + 1, 'top'),
			isDisabled: () => suppressEdgeNavRef.current,
		});
	}, [total, goToPage]);

	useEffect(() => {
		if (total <= 0) return;
		onPageStateRef.current?.(page, total);
		onReadyRef.current?.({
			prev: () => goToPage(pageRef.current - 1, 'top'),
			next: () => goToPage(pageRef.current + 1, 'top'),
			go: (target) => goToPage(target, 'top'),
		});
	}, [page, total, goToPage]);

	return (
		<div className="flex h-full min-h-0 flex-col">
			{err ? <p className="text-destructive p-4 text-sm">{err}</p> : null}
			<div
				ref={scrollRef}
				className={cn(
					'flex flex-1 min-h-0 justify-center overflow-auto',
					READER_NATIVE_SCROLLBAR,
				)}
			>
				<canvas ref={canvasRef} className="shrink-0 rounded-b-md" />
			</div>
		</div>
	);
}
