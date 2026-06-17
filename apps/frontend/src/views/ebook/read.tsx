import Loading from '@design/Loading';
import Tooltip from '@design/Tooltip';
import { Button } from '@ui/index';
import { Toast } from '@ui/sonner';
import { ChevronLeft, ChevronRight, List, Minus, Plus } from 'lucide-react';
import { observer } from 'mobx-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { useI18n } from '@/hooks';
import { cn } from '@/lib/utils';
import ebookStore from '@/store/ebook';
import { EbookPageShell } from './components/EbookPageShell';
import { EbookPanelHeader } from './components/EbookPanelHeader';
import { EpubPane } from './components/EpubPane';
import { EpubReaderSettingsPopover } from './components/EpubReaderSettingsPopover';
import { EpubTocDrawer } from './components/EpubTocDrawer';
import { PdfPane } from './components/PdfPane';
import type { EpubToc } from './types';
import {
	DEFAULT_EPUB_READER_SETTINGS,
	type EpubReaderSettings,
	loadEpubReaderSettings,
	saveEpubReaderSettings,
} from './utils/epubReaderSettings';
import { type EbookOpenSource, resolveOpen } from './utils/io';
import { parsePdfPageHref } from './utils/pdfOutline';
import {
	loadPdfZoom,
	PDF_ZOOM_MAX,
	PDF_ZOOM_MIN,
	PDF_ZOOM_STEP,
	savePdfZoom,
	stepPdfZoom,
} from './utils/pdfReaderSettings';

function EbookReadPage() {
	const { bookId = '' } = useParams();
	const nav = useNavigate();
	const { t } = useI18n();
	const book = ebookStore.bookById(bookId);
	const prog = ebookStore.progOf(bookId);
	const [bookResolving, setBookResolving] = useState(false);

	const [open, setOpen] = useState<ArrayBuffer | null>(null);
	const [openSource, setOpenSource] = useState<EbookOpenSource | null>(null);
	const [toc, setToc] = useState<EpubToc[]>([]);
	const [tocOpen, setTocOpen] = useState(false);
	const [epubSettingsOpen, setEpubSettingsOpen] = useState(false);
	const [epubSettings, setEpubSettings] = useState<EpubReaderSettings>(
		loadEpubReaderSettings,
	);
	const epubNavRef = useRef<{
		prev: () => Promise<void>;
		next: () => Promise<void>;
		go: (href: string) => Promise<void>;
	} | null>(null);
	const [epubNavReady, setEpubNavReady] = useState(false);
	const pdfNavRef = useRef<{
		prev: () => void;
		next: () => void;
		go: (page: number) => void;
	} | null>(null);
	const [pdfNavReady, setPdfNavReady] = useState(false);
	const [pdfPage, setPdfPage] = useState(0);
	const [pdfTotal, setPdfTotal] = useState(0);
	const [pdfZoom, setPdfZoom] = useState(loadPdfZoom);
	const progTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

	useEffect(() => {
		if (!bookId) return;
		let cancelled = false;
		void (async () => {
			if (!ebookStore.ready) {
				await ebookStore.hydrate();
			}
			if (cancelled || ebookStore.bookById(bookId)) return;
			setBookResolving(true);
			try {
				await ebookStore.fetchBookIfMissing(bookId);
			} finally {
				if (!cancelled) setBookResolving(false);
			}
		})();
		return () => {
			cancelled = true;
		};
	}, [bookId]);

	useEffect(() => {
		if (!book) return;
		let cancelled = false;
		setOpen(null);
		setOpenSource(null);
		setToc([]);
		setEpubNavReady(false);
		epubNavRef.current = null;
		pdfNavRef.current = null;
		setPdfNavReady(false);
		setPdfPage(0);
		setPdfTotal(0);
		(async () => {
			try {
				const result = await resolveOpen(book.src, book.fmt, book.id);
				if (!cancelled) {
					setOpen(result.data);
					setOpenSource(result.source);
				}
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
	}, [book]);

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

	const onEpubNavReset = useCallback(() => {
		epubNavRef.current = null;
		setEpubNavReady(false);
	}, []);

	const onPdfReady = useCallback(
		(api: {
			prev: () => void;
			next: () => void;
			go: (page: number) => void;
		}) => {
			pdfNavRef.current = api;
		},
		[],
	);

	const onPdfPageState = useCallback((page: number, total: number) => {
		setPdfPage(page);
		setPdfTotal(total);
		setPdfNavReady(total > 0);
	}, []);

	const patchEpubSettings = useCallback(
		(patch: Partial<EpubReaderSettings>) => {
			setEpubSettings((prev) => {
				const next = { ...prev, ...patch };
				saveEpubReaderSettings(next);
				return next;
			});
		},
		[],
	);

	const resetEpubSettings = useCallback(() => {
		setEpubSettings(DEFAULT_EPUB_READER_SETTINGS);
		saveEpubReaderSettings(DEFAULT_EPUB_READER_SETTINGS);
	}, []);

	const patchPdfZoom = useCallback((delta: number) => {
		setPdfZoom((prev) => {
			const next = stepPdfZoom(prev, delta);
			savePdfZoom(next);
			return next;
		});
	}, []);

	useEffect(() => {
		if (!book || !open) return;

		const onKeyDown = (e: KeyboardEvent) => {
			if (e.repeat) return;
			if (tocOpen) return;
			if (epubSettingsOpen) return;

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

			if (book.fmt === 'epub' && epubNavRef.current) {
				e.preventDefault();
				if (isPrev) void epubNavRef.current.prev();
				else void epubNavRef.current.next();
				return;
			}

			if (book.fmt === 'pdf' && pdfNavRef.current) {
				e.preventDefault();
				if (isPrev) pdfNavRef.current.prev();
				else pdfNavRef.current.next();
			}
		};

		window.addEventListener('keydown', onKeyDown, true);
		return () => window.removeEventListener('keydown', onKeyDown, true);
	}, [book, open, tocOpen, epubSettingsOpen]);

	if (!book) {
		if (bookResolving || !ebookStore.ready) {
			return (
				<EbookPageShell>
					<div className="text-textcolor/60 flex flex-1 flex-col items-center justify-center py-12 text-center text-sm">
						<Loading text={t('common.loading')} />
					</div>
				</EbookPageShell>
			);
		}
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
				<EpubReaderSettingsPopover
					settings={epubSettings}
					onChange={patchEpubSettings}
					onReset={resetEpubSettings}
					open={epubSettingsOpen}
					onOpenChange={setEpubSettingsOpen}
					disabled={!epubNavReady}
				/>
			</>
		) : null;

	const pdfZoomLabel = `${Math.round(pdfZoom * 100)}%`;

	const pdfHeaderTrailing =
		book.fmt === 'pdf' ? (
			<>
				<Tooltip
					side="bottom"
					sideOffset={6}
					delayDuration={200}
					shadow
					content={t('ebook.read.pdfZoomOut')}
				>
					<Button
						type="button"
						variant="ghost"
						size="icon-sm"
						className="text-textcolor/80"
						disabled={!pdfNavReady || pdfZoom <= PDF_ZOOM_MIN}
						aria-label={t('ebook.read.pdfZoomOut')}
						onClick={() => patchPdfZoom(-PDF_ZOOM_STEP)}
					>
						<Minus className="size-4" />
					</Button>
				</Tooltip>
				<span
					className="text-textcolor/55 min-w-10 text-center tabular-nums text-xs"
					title={t('ebook.read.pdfZoomHint')}
				>
					{pdfZoomLabel}
				</span>
				<Tooltip
					side="bottom"
					sideOffset={6}
					delayDuration={200}
					shadow
					content={t('ebook.read.pdfZoomIn')}
				>
					<Button
						type="button"
						variant="ghost"
						size="icon-sm"
						className="text-textcolor/80"
						disabled={!pdfNavReady || pdfZoom >= PDF_ZOOM_MAX}
						aria-label={t('ebook.read.pdfZoomIn')}
						onClick={() => patchPdfZoom(PDF_ZOOM_STEP)}
					>
						<Plus className="size-4" />
					</Button>
				</Tooltip>
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
						disabled={!pdfNavReady || pdfPage <= 0}
						aria-label={t('ebook.read.prev')}
						onClick={() => pdfNavRef.current?.prev()}
					>
						<ChevronLeft className="size-4" />
					</Button>
				</Tooltip>
				<span className="text-textcolor/55 min-w-14 text-center tabular-nums text-xs">
					{pdfTotal > 0 ? `${pdfPage + 1} / ${pdfTotal}` : '—'}
				</span>
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
						disabled={!pdfNavReady || pdfPage >= pdfTotal - 1}
						aria-label={t('ebook.read.next')}
						onClick={() => pdfNavRef.current?.next()}
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
						disabled={!pdfNavReady}
						onClick={() => setTocOpen(true)}
						aria-label={t('ebook.read.toc')}
					>
						<List className="size-4" />
					</Button>
				</Tooltip>
			</>
		) : null;

	const headerTrailing = epubHeaderTrailing ?? pdfHeaderTrailing;

	return (
		<EbookPageShell
			contentPadding={false}
			header={
				<EbookPanelHeader
					className="pl-5 pr-2.5"
					title={
						<div className="flex items-center gap-1.5">
							{openSource ? (
								<span
									className={cn(
										'shrink-0 rounded px-1.5 h-5.5 pb-px mt-px flex items-center justify-center text-xs font-medium leading-none',
										openSource === 'local'
											? 'bg-emerald-500/15 text-emerald-600'
											: 'bg-sky-500/15 text-sky-600',
									)}
								>
									{openSource === 'local'
										? t('ebook.read.sourceLocal')
										: t('ebook.read.sourceOnline')}
								</span>
							) : null}
							<span className="min-w-0 truncate">{book.title}</span>
						</div>
					}
					trailing={headerTrailing}
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
						readerSettings={epubSettings}
						onCfi={saveCfi}
						onToc={setToc}
						onReady={onEpubReady}
						onNavReset={onEpubNavReset}
						keyboardNavEnabled={!tocOpen && !epubSettingsOpen}
					/>
				) : (
					<PdfPane
						open={open}
						startPage={prog?.pdfPage ?? 0}
						zoomMultiplier={pdfZoom}
						onPage={savePage}
						onPageState={onPdfPageState}
						onToc={setToc}
						onReady={onPdfReady}
					/>
				)}
			</div>

			<EpubTocDrawer
				open={tocOpen}
				onOpenChange={setTocOpen}
				items={toc}
				onSelect={(href) => {
					const pdfPage = parsePdfPageHref(href);
					if (pdfPage != null) {
						pdfNavRef.current?.go(pdfPage);
						return;
					}
					void epubNavRef.current?.go(href);
				}}
			/>
		</EbookPageShell>
	);
}

export default observer(EbookReadPage);
