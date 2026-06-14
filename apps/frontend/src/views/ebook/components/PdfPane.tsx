import { Button } from '@ui/index';
import { useEffect, useRef, useState } from 'react';
import { useI18n } from '@/hooks';
import { pdfjs, pdfLoadOptions } from '../utils/pdfSetup';

/** 拷贝一份独立字节，避免 pdf.js worker 转移后原 buffer 被 detach */
function cloneBytes(src: ArrayBuffer): Uint8Array {
	return new Uint8Array(src).slice();
}

type Props = {
	open: ArrayBuffer;
	startPage?: number;
	onPage: (page: number, percent?: number) => void;
	onReady?: (api: { prev: () => void; next: () => void }) => void;
};

export function PdfPane({ open, startPage = 0, onPage, onReady }: Props) {
	const { t } = useI18n();
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const docRef = useRef<pdfjs.PDFDocumentProxy | null>(null);
	const onPageRef = useRef(onPage);
	const onReadyRef = useRef(onReady);
	const [page, setPage] = useState(startPage);
	const [total, setTotal] = useState(0);
	const [err, setErr] = useState<string | null>(null);

	onPageRef.current = onPage;
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
			} catch (e) {
				if (!cancelled) {
					setErr(e instanceof Error ? e.message : 'PDF 打开失败');
				}
			}
		})();

		return () => {
			cancelled = true;
			docRef.current = null;
		};
	}, [open]);

	useEffect(() => {
		const doc = docRef.current;
		const canvas = canvasRef.current;
		if (!doc || !canvas || total === 0) return;

		let cancelled = false;

		(async () => {
			try {
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
				await pdfPage.render({
					canvasContext: ctx,
					viewport: vp,
					canvas,
				}).promise;
				const pct = Math.round(((page + 1) / total) * 100);
				onPageRef.current(page, pct);
			} catch (e) {
				if (!cancelled) {
					setErr(e instanceof Error ? e.message : 'PDF 渲染失败');
				}
			}
		})();

		return () => {
			cancelled = true;
		};
	}, [page, total]);

	useEffect(() => {
		if (total <= 0) return;
		onReadyRef.current?.({
			prev: () => setPage((p) => Math.max(0, p - 1)),
			next: () => setPage((p) => Math.min(total - 1, p + 1)),
		});
	}, [total]);

	return (
		<div className="flex h-full min-h-0 flex-col">
			{err ? <p className="text-destructive p-4 text-sm">{err}</p> : null}
			<div className="bg-theme/5 flex flex-1 justify-center overflow-auto p-4">
				<canvas
					ref={canvasRef}
					className="max-w-full rounded-md bg-white shadow-sm ring-1 ring-theme/10"
				/>
			</div>
			<div className="flex shrink-0 items-center justify-center gap-2 border-t border-theme/10 px-4 py-2.5 text-sm">
				<Button
					type="button"
					size="sm"
					variant="secondary"
					disabled={page <= 0}
					onClick={() => setPage((p) => Math.max(0, p - 1))}
				>
					{t('ebook.read.prev')}
				</Button>
				<span className="text-textcolor/55 tabular-nums text-xs">
					{total > 0 ? `${page + 1} / ${total}` : '—'}
				</span>
				<Button
					type="button"
					size="sm"
					variant="secondary"
					disabled={page >= total - 1}
					onClick={() => setPage((p) => Math.min(total - 1, p + 1))}
				>
					{t('ebook.read.next')}
				</Button>
			</div>
		</div>
	);
}
