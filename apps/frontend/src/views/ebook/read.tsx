import Loading from '@design/Loading';
import Tooltip from '@design/Tooltip';
import { Button } from '@ui/index';
import { Toast } from '@ui/sonner';
import {
	Bot,
	ChevronLeft,
	ChevronRight,
	List,
	Minus,
	Plus,
} from 'lucide-react';
import { observer } from 'mobx-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { useI18n } from '@/hooks';
import { cn } from '@/lib/utils';
import ebookStore from '@/store/ebook';
import { copyToClipboard } from '@/utils/clipboard';
import { EbookPageShell } from './components/EbookPageShell';
import { EbookPanelHeader } from './components/EbookPanelHeader';
import { EbookReadSplitLayout } from './components/EbookReadSplitLayout';
import { EbookTocDrawer } from './components/EbookTocDrawer';
import { EpubPane } from './components/EpubPane';
import {
	EpubReaderContextMenu,
	type EpubReaderContextMenuState,
} from './components/EpubReaderContextMenu';
import { EpubReaderSettingsPopover } from './components/EpubReaderSettingsPopover';
import { PdfPane } from './components/PdfPane';
import type { EbookTocItem } from './types';
import {
	buildEpubContextMenuItems,
	type EpubReaderContextActions,
} from './utils/buildEpubContextMenuItems';
import {
	buildPdfContextMenuItems,
	type PdfReaderContextActions,
} from './utils/buildPdfContextMenuItems';
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
import { findActiveTocItemIndex } from './utils/tocActiveIndex';

function EbookReadPage() {
	const { bookId = '' } = useParams();
	const nav = useNavigate();
	const { t } = useI18n();
	const book = ebookStore.bookById(bookId);
	const prog = ebookStore.progOf(bookId);
	const [bookResolving, setBookResolving] = useState(false);

	const [open, setOpen] = useState<ArrayBuffer | null>(null);
	const [openSource, setOpenSource] = useState<EbookOpenSource | null>(null);
	const [tocItems, setTocItems] = useState<EbookTocItem[]>([]);
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
	const [epubSpineIndex, setEpubSpineIndex] = useState<number | undefined>(
		undefined,
	);
	const [pdfZoom, setPdfZoom] = useState(loadPdfZoom);
	const [assistantOpen, setAssistantOpen] = useState(false);
	const [assistantInput, setAssistantInput] = useState('');
	const [focusInputAtEndKey, setFocusInputAtEndKey] = useState(0);
	const [contextMenu, setContextMenu] =
		useState<EpubReaderContextMenuState | null>(null);
	const contextActionsRef = useRef<EpubReaderContextActions | null>(null);
	const pdfContextActionsRef = useRef<PdfReaderContextActions | null>(null);
	const contextPayloadRef = useRef<{
		selectedText: string;
		copySelection: () => void;
	} | null>(null);
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
		setTocItems([]);
		setEpubNavReady(false);
		epubNavRef.current = null;
		pdfNavRef.current = null;
		setPdfNavReady(false);
		setPdfPage(0);
		setPdfTotal(0);
		setEpubSpineIndex(undefined);
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
		(cfi: string, percent?: number, spineIndex?: number) => {
			if (!book) return;
			if (spineIndex != null && Number.isFinite(spineIndex)) {
				setEpubSpineIndex(spineIndex);
			}
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

	const activeTocIndex = useMemo(
		() =>
			findActiveTocItemIndex(
				tocItems,
				book?.fmt === 'pdf' ? { pdfPage } : { epubSpineIndex: epubSpineIndex },
			),
		[tocItems, book?.fmt, pdfPage, epubSpineIndex],
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

	const openAssistant = useCallback((draft?: string) => {
		if (draft?.trim()) {
			setAssistantInput(draft.trim());
		}
		setAssistantOpen(true);
	}, []);

	const toggleAssistant = useCallback(() => {
		setAssistantOpen((prev) => !prev);
	}, []);

	const openAssistantWithSelection = useCallback(
		(selectedText: string) => {
			const quote = selectedText.trim();
			if (!quote) return;
			openAssistant(t('ebook.read.assistant.askSelectionDraft', { quote }));
			setFocusInputAtEndKey((n) => n + 1);
		},
		[openAssistant, t],
	);

	const closeContextMenu = useCallback(() => {
		setContextMenu(null);
		contextPayloadRef.current = null;
	}, []);

	const showReaderContextMenu = useCallback(
		(payload: { clientX: number; clientY: number; hasSelection?: boolean }) => {
			setContextMenu({
				open: true,
				x: payload.clientX,
				y: payload.clientY,
				hasSelection: Boolean(payload.hasSelection),
			});
		},
		[],
	);

	const showEpubContextMenu = useCallback(
		(payload: {
			clientX: number;
			clientY: number;
			selectedText: string;
			copySelection: () => void;
		}) => {
			contextPayloadRef.current = {
				selectedText: payload.selectedText,
				copySelection: payload.copySelection,
			};
			showReaderContextMenu({
				clientX: payload.clientX,
				clientY: payload.clientY,
				hasSelection: Boolean(payload.selectedText.trim()),
			});
		},
		[showReaderContextMenu],
	);

	const onHostContextMenu = useCallback(
		(e: React.MouseEvent<HTMLDivElement>) => {
			if (book?.fmt !== 'epub') return;
			e.preventDefault();
			const selectedText = window.getSelection()?.toString()?.trim() ?? '';
			showEpubContextMenu({
				clientX: e.clientX,
				clientY: e.clientY,
				selectedText,
				copySelection: () => {
					if (!selectedText) return;
					void copyToClipboard(selectedText);
				},
			});
		},
		[book?.fmt, showEpubContextMenu],
	);

	const onPdfContextMenu = useCallback(
		(e: React.MouseEvent<HTMLDivElement>) => {
			if (book?.fmt !== 'pdf') return;
			e.preventDefault();
			showReaderContextMenu({
				clientX: e.clientX,
				clientY: e.clientY,
			});
		},
		[book?.fmt, showReaderContextMenu],
	);

	contextActionsRef.current = {
		copy: () => {
			const payload = contextPayloadRef.current;
			if (!payload?.selectedText.trim()) return;
			void copyToClipboard(payload.selectedText);
		},
		openAssistant: () => openAssistant(),
		askAboutSelection: () => {
			const text = contextPayloadRef.current?.selectedText ?? '';
			// 等 Radix 右键菜单关闭并释放 focus trap 后再打开助手并聚焦输入框
			window.setTimeout(() => openAssistantWithSelection(text), 0);
		},
		openToc: () => setTocOpen(true),
		openSettings: () => setEpubSettingsOpen(true),
		prevPage: () => {
			void epubNavRef.current?.prev();
		},
		nextPage: () => {
			void epubNavRef.current?.next();
		},
		backToShelf: () => nav('/ebook'),
	};

	pdfContextActionsRef.current = {
		openAssistant: () => openAssistant(),
		zoomIn: () => patchPdfZoom(PDF_ZOOM_STEP),
		zoomOut: () => patchPdfZoom(-PDF_ZOOM_STEP),
		prevPage: () => pdfNavRef.current?.prev(),
		nextPage: () => pdfNavRef.current?.next(),
		openToc: () => setTocOpen(true),
	};

	const contextMenuItems = useMemo(() => {
		if (book?.fmt === 'pdf') {
			return buildPdfContextMenuItems({
				actionsRef: pdfContextActionsRef,
				canZoomIn: pdfNavReady && pdfZoom < PDF_ZOOM_MAX,
				canZoomOut: pdfNavReady && pdfZoom > PDF_ZOOM_MIN,
				canPrev: pdfNavReady && pdfPage > 0,
				canNext: pdfNavReady && pdfPage < pdfTotal - 1,
				t,
			});
		}
		return buildEpubContextMenuItems({
			hasSelection: contextMenu?.hasSelection ?? false,
			actionsRef: contextActionsRef,
			t,
		});
	}, [
		book?.fmt,
		contextMenu?.hasSelection,
		pdfNavReady,
		pdfPage,
		pdfTotal,
		pdfZoom,
		t,
	]);

	useEffect(() => {
		if (!book || !open) return;

		const onKeyDown = (e: KeyboardEvent) => {
			if (e.repeat) return;
			if (tocOpen) return;
			if (epubSettingsOpen) return;
			if (assistantOpen) return;

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
	}, [book, open, tocOpen, epubSettingsOpen, assistantOpen]);

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
					content={
						assistantOpen
							? t('ebook.read.assistant.close')
							: t('ebook.read.assistant.open')
					}
				>
					<Button
						type="button"
						variant="ghost"
						size="icon-sm"
						className={cn(
							assistantOpen
								? 'bg-theme/15 text-teal-500'
								: 'text-textcolor/80 hover:text-teal-500',
						)}
						aria-pressed={assistantOpen}
						aria-label={t('ebook.read.assistant.toggleAria')}
						onClick={toggleAssistant}
					>
						<Bot className="size-4.5" />
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
						className="text-textcolor/80 hover:text-teal-500"
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
						className="text-textcolor/80 hover:text-teal-500"
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
						className="text-textcolor/80 hover:text-teal-500"
						onClick={() => setTocOpen(true)}
						aria-label={t('ebook.read.toc')}
					>
						<List className="size-4" />
					</Button>
				</Tooltip>
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
					content={
						assistantOpen
							? t('ebook.read.assistant.close')
							: t('ebook.read.assistant.open')
					}
				>
					<Button
						type="button"
						variant="ghost"
						size="icon-sm"
						className={cn(
							assistantOpen
								? 'bg-theme/15 text-teal-500'
								: 'text-textcolor/80 hover:text-teal-500',
						)}
						aria-pressed={assistantOpen}
						aria-label={t('ebook.read.assistant.toggleAria')}
						onClick={toggleAssistant}
					>
						<Bot className="size-4.5" />
					</Button>
				</Tooltip>
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
						className="text-textcolor/80 hover:text-teal-500"
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
						className="text-textcolor/80 hover:text-teal-500"
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
						className="text-textcolor/80 hover:text-teal-500"
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
						className="text-textcolor/80 hover:text-teal-500"
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
						className="text-textcolor/80 hover:text-teal-500"
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
						<div className="flex min-w-0 flex-1 items-center gap-1.5 overflow-hidden">
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
							<span className="min-w-0 flex-1 truncate">{book.title}</span>
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
					<EbookReadSplitLayout
						assistantOpen={assistantOpen}
						bookId={book.id}
						bookTitle={book.title}
						assistantInput={assistantInput}
						onAssistantInputChange={setAssistantInput}
						focusInputAtEndKey={focusInputAtEndKey}
					>
						<div
							className="flex h-full min-h-0 flex-1 flex-col"
							onContextMenu={onHostContextMenu}
						>
							<EpubPane
								open={open}
								startCfi={prog?.epubCfi}
								readerSettings={epubSettings}
								onCfi={saveCfi}
								onToc={setTocItems}
								onReady={onEpubReady}
								onNavReset={onEpubNavReset}
								keyboardNavEnabled={
									!tocOpen && !epubSettingsOpen && !assistantOpen
								}
								onReaderContextMenu={showEpubContextMenu}
							/>
						</div>
					</EbookReadSplitLayout>
				) : (
					<EbookReadSplitLayout
						assistantOpen={assistantOpen}
						bookId={book.id}
						bookTitle={book.title}
						assistantInput={assistantInput}
						onAssistantInputChange={setAssistantInput}
						focusInputAtEndKey={focusInputAtEndKey}
					>
						<div
							className="flex h-full min-h-0 flex-1 flex-col"
							onContextMenu={onPdfContextMenu}
						>
							<PdfPane
								open={open}
								startPage={prog?.pdfPage ?? 0}
								zoomMultiplier={pdfZoom}
								onPage={savePage}
								onPageState={onPdfPageState}
								onToc={setTocItems}
								onReady={onPdfReady}
							/>
						</div>
					</EbookReadSplitLayout>
				)}
			</div>

			<EbookTocDrawer
				open={tocOpen}
				onOpenChange={setTocOpen}
				items={tocItems}
				activeIndex={activeTocIndex}
				onSelect={(href) => {
					const pdfPage = parsePdfPageHref(href);
					if (pdfPage != null) {
						pdfNavRef.current?.go(pdfPage);
						return;
					}
					void epubNavRef.current?.go(href);
				}}
			/>

			{book.fmt === 'epub' || book.fmt === 'pdf' ? (
				<EpubReaderContextMenu
					state={contextMenu}
					items={contextMenuItems}
					onOpenChange={(open) => {
						if (!open) closeContextMenu();
					}}
				/>
			) : null}
		</EbookPageShell>
	);
}

export default observer(EbookReadPage);
