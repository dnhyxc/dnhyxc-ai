import type { RenderTask } from 'pdfjs-dist';
import { useEffect, useRef, useState } from 'react';
import type { EpubToc } from '../types';
import { loadPdfOutlineToc } from '../utils/pdfOutline';
import { pdfjs, pdfLoadOptions } from '../utils/pdfSetup';

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

type Props = {
	open: ArrayBuffer;
	startPage?: number;
	onPage: (page: number, percent?: number) => void;
	onPageState?: (page: number, total: number) => void;
	onToc?: (items: EpubToc[]) => void;
	onReady?: (api: {
		prev: () => void;
		next: () => void;
		go: (page: number) => void;
	}) => void;
};

export function PdfPane({
	open,
	startPage = 0,
	onPage,
	onPageState,
	onToc,
	onReady,
}: Props) {
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const docRef = useRef<pdfjs.PDFDocumentProxy | null>(null);
	const activeRenderTaskRef = useRef<RenderTask | null>(null);
	const onPageRef = useRef(onPage);
	const onPageStateRef = useRef(onPageState);
	const onTocRef = useRef(onToc);
	const onReadyRef = useRef(onReady);
	const [page, setPage] = useState(startPage);
	const [total, setTotal] = useState(0);
	const [err, setErr] = useState<string | null>(null);

	onPageRef.current = onPage;
	onPageStateRef.current = onPageState;
	onTocRef.current = onToc;
	onReadyRef.current = onReady;

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
		if (!doc || !canvas || total === 0) return;

		let cancelled = false;
		setErr(null);

		const run = async () => {
			try {
				activeRenderTaskRef.current?.cancel();
				activeRenderTaskRef.current = null;

				const pdfPage = await doc.getPage(page + 1);
				if (cancelled) return;

				const scale = Math.min(2, Math.max(1, window.devicePixelRatio || 1));
				const vp = pdfPage.getViewport({ scale });
				const ctx = canvas.getContext('2d');
				if (!ctx) return;

				canvas.width = vp.width;
				canvas.height = vp.height;
				canvas.style.width = `${vp.width / scale}px`;
				canvas.style.height = `${vp.height / scale}px`;

				const task = pdfPage.render({
					canvasContext: ctx,
					viewport: vp,
					canvas,
				});
				activeRenderTaskRef.current = task;
				await task.promise;
				if (cancelled) return;
				activeRenderTaskRef.current = null;

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
	}, [page, total]);

	useEffect(() => {
		if (total <= 0) return;
		onPageStateRef.current?.(page, total);
		onReadyRef.current?.({
			prev: () => setPage((p) => Math.max(0, p - 1)),
			next: () => setPage((p) => Math.min(total - 1, p + 1)),
			go: (target) => setPage(Math.min(Math.max(0, target), total - 1)),
		});
	}, [page, total]);

	return (
		<div className="flex h-full min-h-0 flex-col">
			{err ? <p className="text-destructive p-4 text-sm">{err}</p> : null}
			<div className="bg-theme/5 flex flex-1 min-h-0 justify-center overflow-auto p-4">
				<canvas
					ref={canvasRef}
					className="max-w-full rounded-md bg-white shadow-sm ring-1 ring-theme/10"
				/>
			</div>
		</div>
	);
}
