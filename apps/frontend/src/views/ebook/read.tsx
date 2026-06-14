import Loading from '@design/Loading';
import Tooltip from '@design/Tooltip';
import { Button } from '@ui/index';
import { Toast } from '@ui/sonner';
import { ChevronLeft, ChevronRight, List } from 'lucide-react';
import { observer } from 'mobx-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { useI18n } from '@/hooks';
import ebookStore from '@/store/ebook';
import { EbookPageShell } from './components/EbookPageShell';
import { EbookPanelHeader } from './components/EbookPanelHeader';
import { EpubPane } from './components/EpubPane';
import { EpubTocDrawer } from './components/EpubTocDrawer';
import { PdfPane } from './components/PdfPane';
import type { EpubToc } from './types';
import { resolveOpen } from './utils/io';

function EbookReadPage() {
	const { bookId = '' } = useParams();
	const nav = useNavigate();
	const { t } = useI18n();
	const book = ebookStore.bookById(bookId);
	const prog = ebookStore.progOf(bookId);

	const [open, setOpen] = useState<ArrayBuffer | null>(null);
	const [toc, setToc] = useState<EpubToc[]>([]);
	const [tocOpen, setTocOpen] = useState(false);
	const epubNavRef = useRef<{
		prev: () => Promise<void>;
		next: () => Promise<void>;
		go: (href: string) => Promise<void>;
	} | null>(null);
	const [epubNavReady, setEpubNavReady] = useState(false);
	const pdfNavRef = useRef<{ prev: () => void; next: () => void } | null>(null);
	const [pdfNavReady, setPdfNavReady] = useState(false);
	const progTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

	useEffect(() => {
		if (!ebookStore.ready) ebookStore.hydrate();
	}, []);

	useEffect(() => {
		if (!book) return;
		let cancelled = false;
		setOpen(null);
		setEpubNavReady(false);
		setPdfNavReady(false);
		epubNavRef.current = null;
		pdfNavRef.current = null;
		(async () => {
			try {
				const data = await resolveOpen(book.src, book.fmt, book.id);
				if (!cancelled) setOpen(data);
			} catch (e) {
				Toast({
					type: 'error',
					title: t('ebook.err.open'),
					message: e instanceof Error ? e.message : String(e),
				});
			}
		})();
		return () => {
			cancelled = true;
		};
	}, [book, t]);

	const saveCfi = useCallback(
		(cfi: string, percent?: number) => {
			if (!book) return;
			if (progTimer.current) clearTimeout(progTimer.current);
			progTimer.current = setTimeout(() => {
				ebookStore.saveProg({
					bookId: book.id,
					epubCfi: cfi,
					percent,
				});
			}, 800);
		},
		[book],
	);

	const savePage = useCallback(
		(page: number, percent?: number) => {
			if (!book) return;
			if (progTimer.current) clearTimeout(progTimer.current);
			progTimer.current = setTimeout(() => {
				ebookStore.saveProg({
					bookId: book.id,
					pdfPage: page,
					percent,
				});
			}, 800);
		},
		[book],
	);

	const onEpubReady = useCallback(
		(api: {
			prev: () => Promise<void>;
			next: () => Promise<void>;
			go: (href: string) => Promise<void>;
		}) => {
			epubNavRef.current = api;
			setEpubNavReady(true);
		},
		[],
	);

	const onPdfReady = useCallback(
		(api: { prev: () => void; next: () => void }) => {
			pdfNavRef.current = api;
			setPdfNavReady(true);
		},
		[],
	);

	useEffect(() => {
		if (!book || !open) return;

		const onKeyDown = (e: KeyboardEvent) => {
			if (e.repeat) return;
			if (tocOpen) return;

			const target = e.target as HTMLElement | null;
			const tag = target?.tagName;
			if (
				tag === 'INPUT' ||
				tag === 'TEXTAREA' ||
				tag === 'SELECT' ||
				target?.isContentEditable
			) {
				return;
			}

			const isPrev = e.key === 'ArrowUp' || e.key === 'ArrowLeft';
			const isNext = e.key === 'ArrowDown' || e.key === 'ArrowRight';
			if (!isPrev && !isNext) return;

			if (book.fmt === 'epub' && epubNavReady && epubNavRef.current) {
				e.preventDefault();
				if (isPrev) void epubNavRef.current.prev();
				else void epubNavRef.current.next();
				return;
			}

			if (book.fmt === 'pdf' && pdfNavReady && pdfNavRef.current) {
				e.preventDefault();
				if (isPrev) pdfNavRef.current.prev();
				else pdfNavRef.current.next();
			}
		};

		window.addEventListener('keydown', onKeyDown);
		return () => window.removeEventListener('keydown', onKeyDown);
	}, [book, open, tocOpen, epubNavReady, pdfNavReady]);

	if (!book) {
		return (
			<EbookPageShell>
				<div className="text-textcolor/60 flex flex-1 flex-col items-center justify-center gap-3 py-12 text-center text-sm">
					<p>{t('ebook.read.missing')}</p>
					<Button
						type="button"
						variant="secondary"
						size="sm"
						onClick={() => nav('/ebook')}
					>
						{t('ebook.read.backShelf')}
					</Button>
				</div>
			</EbookPageShell>
		);
	}

	const epubHeaderTrailing =
		book.fmt === 'epub' ? (
			<>
				<Tooltip
					side="bottom"
					sideOffset={6}
					delayDuration={200}
					shadow
					content={t('ebook.read.prev')}
				>
					<Button
						type="button"
						variant="ghost"
						size="icon-sm"
						className="text-textcolor/80"
						disabled={!epubNavReady}
						aria-label={t('ebook.read.prev')}
						onClick={() => epubNavRef.current?.prev()}
					>
						<ChevronLeft className="size-4" />
					</Button>
				</Tooltip>
				<Tooltip
					side="bottom"
					sideOffset={6}
					delayDuration={200}
					shadow
					content={t('ebook.read.next')}
				>
					<Button
						type="button"
						variant="ghost"
						size="icon-sm"
						className="text-textcolor/80"
						disabled={!epubNavReady}
						aria-label={t('ebook.read.next')}
						onClick={() => epubNavRef.current?.next()}
					>
						<ChevronRight className="size-4" />
					</Button>
				</Tooltip>
				<Tooltip
					side="bottom"
					sideOffset={6}
					delayDuration={200}
					shadow
					content={t('ebook.read.toc')}
				>
					<Button
						type="button"
						variant="ghost"
						size="icon-sm"
						className="text-textcolor/80"
						onClick={() => setTocOpen(true)}
						aria-label={t('ebook.read.toc')}
					>
						<List className="size-4" />
					</Button>
				</Tooltip>
			</>
		) : null;

	return (
		<EbookPageShell
			contentPadding={false}
			header={
				<EbookPanelHeader
					className="pl-4.5 pr-2.5"
					title={book.title}
					trailing={epubHeaderTrailing}
				/>
			}
		>
			<div className="flex min-h-0 flex-1 flex-col">
				{!open ? (
					<div className="text-textcolor/60 flex flex-1 flex-col items-center justify-center py-12 text-sm">
						<Loading text={t('common.loading')} />
					</div>
				) : book.fmt === 'epub' ? (
					<EpubPane
						open={open}
						startCfi={prog?.epubCfi}
						onCfi={saveCfi}
						onToc={setToc}
						onReady={onEpubReady}
					/>
				) : (
					<PdfPane
						open={open}
						startPage={prog?.pdfPage ?? 0}
						onPage={savePage}
						onReady={onPdfReady}
					/>
				)}
			</div>

			<EpubTocDrawer
				open={tocOpen}
				onOpenChange={setTocOpen}
				items={toc}
				onSelect={(href) => epubNavRef.current?.go(href)}
			/>
		</EbookPageShell>
	);
}

export default observer(EbookReadPage);
