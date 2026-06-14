import type { Book, Rendition } from 'epubjs';
import ePub from 'epubjs';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { EpubToc } from '../types';

type NavApi = {
	prev: () => Promise<void>;
	next: () => Promise<void>;
	go: (href: string) => Promise<void>;
};

type Props = {
	open: ArrayBuffer;
	startCfi?: string;
	onCfi: (cfi: string, percent?: number) => void;
	onToc?: (items: EpubToc[]) => void;
	onReady?: (api: NavApi) => void;
};

export function EpubPane({ open, startCfi, onCfi, onToc, onReady }: Props) {
	const hostRef = useRef<HTMLDivElement>(null);
	const rendRef = useRef<Rendition | null>(null);
	const readyRef = useRef(false);
	const onTocRef = useRef(onToc);
	const onReadyRef = useRef(onReady);
	const [err, setErr] = useState<string | null>(null);

	onTocRef.current = onToc;
	onReadyRef.current = onReady;

	const relocate = useCallback(
		(loc: { start?: { cfi?: string; percentage?: number } }) => {
			const cfi = loc?.start?.cfi;
			if (!cfi) return;
			const pct =
				typeof loc.start?.percentage === 'number'
					? Math.round(loc.start.percentage * 100)
					: undefined;
			onCfi(cfi, pct);
		},
		[onCfi],
	);

	useEffect(() => {
		const el = hostRef.current;
		if (!el) return;

		let destroyed = false;
		let book: Book | null = null;
		let rend: Rendition | null = null;
		readyRef.current = false;
		rendRef.current = null;
		setErr(null);

		const initialCfi = startCfi;

		(async () => {
			try {
				book = ePub(open, {
					openAs: 'binary',
					replacements: 'blobUrl',
				});
				await book.opened;
				if (destroyed || !book) return;

				const w = Math.max(el.clientWidth, 320) || 640;
				const h = Math.max(el.clientHeight, 320) || 480;

				rend = book.renderTo(el, {
					width: w,
					height: h,
					flow: 'paginated',
					spread: 'none',
					allowScriptedContent: true,
				});
				rendRef.current = rend;
				rend.on('relocated', relocate);

				await rend.display(initialCfi ?? undefined);
				if (destroyed) return;

				await book.ready;
				if (destroyed) return;

				readyRef.current = true;

				onReadyRef.current?.({
					prev: async () => {
						if (!readyRef.current || !rendRef.current) return;
						await rendRef.current.prev();
					},
					next: async () => {
						if (!readyRef.current || !rendRef.current) return;
						await rendRef.current.next();
					},
					go: async (href) => {
						if (!rendRef.current) return;
						await rendRef.current.display(href);
					},
				});

				const nav = await book.loaded.navigation;
				const toc: EpubToc[] = (nav.toc ?? []).map((t) => ({
					label: t.label?.trim() || t.href,
					href: t.href,
				}));
				if (!destroyed) onTocRef.current?.(toc);
			} catch (e) {
				if (!destroyed) {
					setErr(e instanceof Error ? e.message : 'EPUB 打开失败');
				}
			}
		})();

		const ro = new ResizeObserver(() => {
			if (!readyRef.current || !hostRef.current || !rendRef.current) return;
			try {
				rendRef.current.resize(
					hostRef.current.clientWidth,
					hostRef.current.clientHeight,
				);
			} catch {
				// ignore
			}
		});
		ro.observe(el);

		return () => {
			destroyed = true;
			readyRef.current = false;
			ro.disconnect();
			try {
				if (rend) {
					rend.off('relocated', relocate);
					rend.destroy();
				}
				if (book) book.destroy();
			} catch {
				// ignore
			}
			rendRef.current = null;
		};
	}, [open, relocate]);

	return (
		<div className="relative h-full min-h-0 w-full bg-theme/5">
			{err ? <p className="text-destructive p-4 text-sm">{err}</p> : null}
			<div
				ref={hostRef}
				className="h-full min-h-[320px] w-full overflow-hidden rounded-b-md bg-green-100 ring-1 ring-theme/10"
			/>
		</div>
	);
}
