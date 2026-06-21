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
import {
	createEbookHighlight,
	createEbookThought,
	deleteEbookHighlight,
	deleteEbookThought,
	fetchEbookHighlights,
	fetchEbookThoughts,
	updateEbookHighlight,
	updateEbookThought,
} from '@/service';
import ebookStore from '@/store/ebook';
import { copyToClipboard } from '@/utils/clipboard';
import { getRequestErrorMessage } from '@/utils/fetch';
import { EbookAssistant } from './components/EbookAssistant';
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
import {
	EpubSelectionPopBar,
	type EpubSelectionPopBarState,
} from './components/EpubSelectionPopBar';
import { EpubThought } from './components/EpubThought';
import { EpubThoughtList } from './components/EpubThoughtList';
import { PdfPane } from './components/PdfPane';
import type {
	EbookThought,
	EbookTocItem,
	EbookUserHighlight,
	EpubHighlightColorId,
	EpubHighlightStyle,
} from './types';
import {
	buildEpubContextMenuItems,
	type EpubReaderContextActions,
} from './utils/buildEpubContextMenuItems';
import {
	buildPdfContextMenuItems,
	type PdfReaderContextActions,
} from './utils/buildPdfContextMenuItems';
import { cfiFromDomRange, trimSelectionRange } from './utils/epubRangeGeometry';
import {
	DEFAULT_EPUB_READER_SETTINGS,
	type EpubReaderSettings,
	loadEpubReaderSettings,
	saveEpubReaderSettings,
} from './utils/epubReaderSettings';
import {
	buildEpubPopBarPayloadFromCfiRange,
	type EpubSelectionPopBarPayload,
	suppressEpubSelectionPopBarDismiss,
} from './utils/epubSelectionToolbarAttach';
import {
	buildMergedHighlightTarget,
	findAllUserHighlightsCoveringCfi,
	findAllUserHighlightsForSelection,
	findHighlightsStrictlyContainedIn,
	findUserHighlightByCfi,
	findUserHighlightCoveringCfi,
	findUserHighlightForSelection,
	isSelectionFullyHighlighted,
	resolveCfiDomRange,
	resolveMergedOverlappingHighlight,
} from './utils/epubUserHighlights';
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
		clearTextSelection: () => void;
		getRendition: () => import('epubjs').Rendition | null;
		syncReadingAnnotations: (nextHighlights?: EbookUserHighlight[]) => void;
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
		cfiRange?: string;
		copySelection: () => void;
	} | null>(null);
	const [thoughts, setThoughts] = useState<EbookThought[]>([]);
	const [thoughtDialogOpen, setThoughtDialogOpen] = useState(false);
	const [thoughtDialogMode, setThoughtDialogMode] = useState<
		'create' | 'view' | 'edit'
	>('create');
	const [thoughtSaving, setThoughtSaving] = useState(false);
	const [thoughtListOpen, setThoughtListOpen] = useState(false);
	const [thoughtListGroup, setThoughtListGroup] = useState<EbookThought[]>([]);
	const [thoughtComposeScrollKey, setThoughtComposeScrollKey] = useState(0);
	const [selectionPopBar, setSelectionPopBar] =
		useState<EpubSelectionPopBarState | null>(null);
	const selectionPopBarRef = useRef<EpubSelectionPopBarPayload | null>(null);
	const [highlights, setHighlights] = useState<EbookUserHighlight[]>([]);
	const [highlightStyle, setHighlightStyle] =
		useState<EpubHighlightStyle>('highlight');
	const [highlightColor, setHighlightColor] =
		useState<EpubHighlightColorId>('pink');
	const highlightsRef = useRef(highlights);
	highlightsRef.current = highlights;
	const returnToListCfiRef = useRef<string | null>(null);
	const [thoughtDraft, setThoughtDraft] = useState({
		id: '',
		quote: '',
		cfiRange: '',
		content: '',
		username: '',
		avatar: '',
		createdAt: '',
		updatedAt: '',
	});
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
		if (!bookId) {
			setThoughts([]);
			return;
		}
		let cancelled = false;
		void fetchEbookThoughts(bookId)
			.then((list) => {
				if (!cancelled) setThoughts(list);
			})
			.catch((e) => {
				if (!cancelled) {
					Toast({
						type: 'error',
						title: t('ebook.read.thought.loadFailed'),
						message: getRequestErrorMessage(e),
					});
				}
			});
		return () => {
			cancelled = true;
		};
	}, [bookId, t]);

	useEffect(() => {
		if (!bookId) {
			setHighlights([]);
			return;
		}
		let cancelled = false;
		void fetchEbookHighlights(bookId)
			.then((list) => {
				if (!cancelled) setHighlights(list);
			})
			.catch((e) => {
				if (!cancelled) {
					Toast({
						type: 'error',
						title: t('ebook.read.highlight.loadFailed'),
						message: getRequestErrorMessage(e),
					});
				}
			});
		return () => {
			cancelled = true;
		};
	}, [bookId, t]);

	const selectionFullyHighlighted = useMemo(() => {
		if (!selectionPopBar?.cfiRange) return false;
		const rend = epubNavRef.current?.getRendition() ?? undefined;
		return isSelectionFullyHighlighted(
			highlights,
			selectionPopBar.cfiRange,
			selectionPopBar.selectedText,
			rend,
		);
	}, [highlights, selectionPopBar, epubNavReady]);

	const upsertHighlightForQuote = useCallback(
		async (
			cfiRange: string,
			quote: string,
			style: EpubHighlightStyle,
			color: EpubHighlightColorId,
		): Promise<EbookUserHighlight | null> => {
			if (!cfiRange || !bookId) return null;

			const rend = epubNavRef.current?.getRendition() ?? undefined;
			let targetCfi = cfiRange;
			let targetQuote = quote;
			const removeIds = new Set<string>();

			if (rend) {
				const resolved = resolveCfiDomRange(rend, cfiRange);
				if (resolved) {
					const normalized = trimSelectionRange(resolved);
					targetCfi = cfiFromDomRange(rend, normalized) ?? cfiRange.trim();
					targetQuote = normalized.toString().trim() || quote.trim();
				}

				const merged = resolveMergedOverlappingHighlight(
					rend,
					targetCfi,
					targetQuote,
					highlightsRef.current,
				);
				targetCfi = merged.cfiRange;
				targetQuote = merged.quote;
				for (const id of merged.removeHighlightIds) {
					removeIds.add(id);
				}
			}

			const superseded = findHighlightsStrictlyContainedIn(
				{ cfiRange: targetCfi, quote: targetQuote },
				highlightsRef.current.filter((h) => !h.id || !removeIds.has(h.id)),
			);
			for (const item of superseded) {
				if (item.id) removeIds.add(item.id);
			}

			// 合并删除仅依赖 DOM 相交/相接（resolveMergedOverlappingHighlight）与严格包含，
			// 不用 quote 子串（如单字「曹」）避免误并 distant 划线
			if (rend && removeIds.size > 0) {
				const mergeTargets = highlightsRef.current.filter(
					(h) => h.id && removeIds.has(h.id),
				);
				const mergedTarget = buildMergedHighlightTarget(
					rend,
					targetCfi,
					targetQuote,
					mergeTargets,
				);
				targetCfi = mergedTarget.cfiRange;
				targetQuote = mergedTarget.quote;
			}

			try {
				if (removeIds.size === 0) {
					const existingExact = findUserHighlightByCfi(
						highlightsRef.current,
						targetCfi,
					);

					const item = existingExact?.id
						? await updateEbookHighlight(existingExact.id, {
								quote: targetQuote,
								style,
								color,
							})
						: await createEbookHighlight({
								bookId,
								cfiRange: targetCfi,
								quote: targetQuote,
								style,
								color,
							});

					const next = [
						...highlightsRef.current.filter((h) => h.id !== item.id),
						item,
					];
					highlightsRef.current = next;
					setHighlights(next);
					return item;
				}

				await Promise.all([...removeIds].map((id) => deleteEbookHighlight(id)));
				const item = await createEbookHighlight({
					bookId,
					cfiRange: targetCfi,
					quote: targetQuote,
					style,
					color,
				});
				const next = [
					...highlightsRef.current.filter((h) => !removeIds.has(h.id)),
					item,
				];
				highlightsRef.current = next;
				setHighlights(next);
				return item;
			} catch (e) {
				Toast({
					type: 'error',
					title: t('ebook.read.highlight.saveFailed'),
					message: getRequestErrorMessage(e),
				});
				return null;
			}
		},
		[bookId, t],
	);

	const upsertSelectionHighlight = useCallback(
		async (style: EpubHighlightStyle, color: EpubHighlightColorId) => {
			const payload = selectionPopBarRef.current;
			if (!payload?.cfiRange) return null;
			const item = await upsertHighlightForQuote(
				payload.cfiRange,
				payload.selectedText,
				style,
				color,
			);
			if (!item) return null;

			const nextPayload: EpubSelectionPopBarPayload = {
				...payload,
				cfiRange: item.cfiRange,
				selectedText: item.quote?.trim() || payload.selectedText,
			};
			selectionPopBarRef.current = nextPayload;
			setHighlightStyle(item.style);
			setHighlightColor(item.color);
			setSelectionPopBar({ ...nextPayload, open: true });
			return item;
		},
		[upsertHighlightForQuote],
	);

	const onApplyHighlight = useCallback(() => {
		void upsertSelectionHighlight(highlightStyle, highlightColor);
	}, [highlightColor, highlightStyle, upsertSelectionHighlight]);

	const removeHighlightsForQuote = useCallback(
		async (cfiRange: string, quote: string) => {
			const rend = epubNavRef.current?.getRendition() ?? undefined;
			const existing = findAllUserHighlightsCoveringCfi(
				highlightsRef.current,
				cfiRange,
				quote,
				rend,
			);
			if (existing.length === 0) return;

			const removeIds = new Set(
				existing.map((item) => item.id).filter(Boolean) as string[],
			);
			try {
				await Promise.all([...removeIds].map((id) => deleteEbookHighlight(id)));
				const next = highlightsRef.current.filter((h) => !removeIds.has(h.id));
				highlightsRef.current = next;
				setHighlights(next);
			} catch (e) {
				Toast({
					type: 'error',
					title: t('ebook.read.highlight.deleteFailed'),
					message: getRequestErrorMessage(e),
				});
			}
		},
		[t],
	);

	const removeHighlightForQuote = removeHighlightsForQuote;

	const onUserHighlightPopBar = useCallback(
		(payload: EpubSelectionPopBarPayload, highlight: EbookUserHighlight) => {
			suppressEpubSelectionPopBarDismiss();
			setAssistantOpen(false);
			selectionPopBarRef.current = payload;
			setHighlightStyle(highlight.style);
			setHighlightColor(highlight.color);
			setSelectionPopBar({ ...payload, open: true });
		},
		[],
	);

	/** 侧栏：定位正文并打开 PopBar；ensureHighlight 为 true 时在无划线时自动创建 */
	const openHighlightPopBarAtBookContent = useCallback(
		(
			cfiRange: string,
			quote: string,
			options?: { ensureHighlight?: boolean },
		) => {
			void (async () => {
				const rend = epubNavRef.current?.getRendition() ?? null;
				if (!rend || !bookId) return;

				if (!resolveCfiDomRange(rend, cfiRange)) {
					try {
						await rend.display(cfiRange);
						await new Promise<void>((resolve) => {
							requestAnimationFrame(() => {
								requestAnimationFrame(() => resolve());
							});
						});
					} catch {
						// 无法定位到该 CFI 时仍尝试用 fallback 锚点
					}
				}

				let highlight = findUserHighlightCoveringCfi(
					highlightsRef.current,
					cfiRange,
					quote,
					rend,
				);

				if (options?.ensureHighlight) {
					const created = await upsertHighlightForQuote(
						cfiRange,
						quote,
						highlightStyle,
						highlightColor,
					);
					if (created) {
						highlight = created;
						await new Promise<void>((resolve) => {
							requestAnimationFrame(() => {
								requestAnimationFrame(() => resolve());
							});
						});
					}
				} else if (highlight) {
					setHighlightStyle(highlight.style);
					setHighlightColor(highlight.color);
				}

				const payload = buildEpubPopBarPayloadFromCfiRange(
					rend,
					highlight?.cfiRange ?? cfiRange,
					highlight?.quote ?? quote,
					resolveCfiDomRange,
				);
				setAssistantOpen(false);
				selectionPopBarRef.current = payload;
				if (highlight) {
					setHighlightStyle(highlight.style);
					setHighlightColor(highlight.color);
				}
				setSelectionPopBar({ ...payload, open: true });
			})();
		},
		[bookId, highlightColor, highlightStyle, upsertHighlightForQuote],
	);

	const onRemoveHighlight = useCallback(async () => {
		const payload = selectionPopBarRef.current;
		if (!payload?.cfiRange) return;
		const rend = epubNavRef.current?.getRendition() ?? undefined;
		const existing = findAllUserHighlightsForSelection(
			highlightsRef.current,
			payload.cfiRange,
			payload.selectedText,
			rend,
		);
		if (existing.length === 0) return;

		const removeIds = new Set(
			existing.map((item) => item.id).filter(Boolean) as string[],
		);
		try {
			await Promise.all([...removeIds].map((id) => deleteEbookHighlight(id)));
			const next = highlightsRef.current.filter((h) => !removeIds.has(h.id));
			highlightsRef.current = next;
			setHighlights(next);
		} catch (e) {
			Toast({
				type: 'error',
				title: t('ebook.read.highlight.deleteFailed'),
				message: getRequestErrorMessage(e),
			});
		}
	}, [t]);

	const onHighlightStyleChange = useCallback(
		(style: EpubHighlightStyle) => {
			setHighlightStyle(style);
			const payload = selectionPopBarRef.current;
			if (!payload?.cfiRange) return;
			const rend = epubNavRef.current?.getRendition() ?? undefined;
			if (
				!isSelectionFullyHighlighted(
					highlightsRef.current,
					payload.cfiRange,
					payload.selectedText,
					rend,
				) &&
				findAllUserHighlightsForSelection(
					highlightsRef.current,
					payload.cfiRange,
					payload.selectedText,
					rend,
				).length === 0
			) {
				return;
			}
			void upsertSelectionHighlight(style, highlightColor);
		},
		[highlightColor, upsertSelectionHighlight],
	);

	const onHighlightColorChange = useCallback(
		(color: EpubHighlightColorId) => {
			setHighlightColor(color);
			const payload = selectionPopBarRef.current;
			if (!payload?.cfiRange) return;
			const rend = epubNavRef.current?.getRendition() ?? undefined;
			if (
				!isSelectionFullyHighlighted(
					highlightsRef.current,
					payload.cfiRange,
					payload.selectedText,
					rend,
				) &&
				findAllUserHighlightsForSelection(
					highlightsRef.current,
					payload.cfiRange,
					payload.selectedText,
					rend,
				).length === 0
			) {
				return;
			}
			void upsertSelectionHighlight(highlightStyle, color);
		},
		[highlightStyle, upsertSelectionHighlight],
	);

	const openViewThought = useCallback(
		(thought: EbookThought, fromList = false) => {
			setAssistantOpen(false);
			if (fromList) {
				returnToListCfiRef.current = thought.cfiRange;
				setThoughtListOpen(false);
			} else {
				returnToListCfiRef.current = null;
			}
			setThoughtDraft({
				id: thought.id,
				quote: thought.quote,
				cfiRange: thought.cfiRange,
				content: thought.content,
				username: thought.username,
				avatar: thought.avatar,
				createdAt: thought.createdAt,
				updatedAt: thought.updatedAt,
			});
			setThoughtDialogMode('view');
			setThoughtDialogOpen(true);
		},
		[],
	);

	useEffect(() => {
		if (thoughtDialogOpen) return;
		const cfiRange = returnToListCfiRef.current;
		if (!cfiRange) return;
		returnToListCfiRef.current = null;
		const next = thoughts.filter((t) => t.cfiRange === cfiRange);
		if (next.length > 0) {
			setThoughtListGroup(next);
			setThoughtListOpen(true);
		}
	}, [thoughtDialogOpen, thoughts]);

	const openCreateThought = useCallback(
		(quote: string, cfiRange?: string) => {
			const trimmed = quote.trim();
			if (!trimmed) return;
			if (!cfiRange) {
				Toast({
					type: 'error',
					title: t('ebook.read.thought.cfiFailed'),
				});
				return;
			}
			setAssistantOpen(false);
			setSelectionPopBar(null);
			selectionPopBarRef.current = null;
			// 发布后 / 关闭写想法页时回到当前引用段落的列表（避免仍显示上一段列表）
			returnToListCfiRef.current = cfiRange;
			setThoughtListOpen(false);
			setThoughtDraft({
				id: '',
				quote: trimmed,
				cfiRange,
				content: '',
				username: '',
				avatar: '',
				createdAt: '',
				updatedAt: '',
			});
			setThoughtDialogMode('create');
			setThoughtDialogOpen(true);
			setThoughtComposeScrollKey((key) => key + 1);
		},
		[t],
	);

	const onSelectionPopBarChange = useCallback(
		(payload: EpubSelectionPopBarPayload | null) => {
			if (!payload) {
				setSelectionPopBar(null);
				selectionPopBarRef.current = null;
				return;
			}
			selectionPopBarRef.current = payload;
			const existing = payload.cfiRange
				? findUserHighlightForSelection(
						highlightsRef.current,
						payload.cfiRange,
						payload.selectedText,
						epubNavRef.current?.getRendition() ?? undefined,
					)
				: undefined;
			if (existing) {
				setHighlightStyle(existing.style);
				setHighlightColor(existing.color);
			} else {
				setHighlightStyle('highlight');
				setHighlightColor('pink');
			}
			setSelectionPopBar({ ...payload, open: true });
		},
		[],
	);

	const onSelectionPopBarWriteThought = useCallback(() => {
		const payload = selectionPopBarRef.current;
		if (!payload) return;
		openCreateThought(payload.selectedText, payload.cfiRange);
	}, [openCreateThought]);

	useEffect(() => {
		if (thoughtDialogOpen || contextMenu?.open) {
			setSelectionPopBar(null);
			selectionPopBarRef.current = null;
		}
	}, [thoughtDialogOpen, contextMenu?.open]);

	const openThoughtGroup = useCallback((group: EbookThought[]) => {
		if (group.length === 0) return;
		setAssistantOpen(false);
		setThoughtListGroup(group);
		setThoughtListOpen(true);
	}, []);

	const saveThought = useCallback(async () => {
		const content = thoughtDraft.content.trim();
		if (!content || !thoughtDraft.cfiRange || !bookId || thoughtSaving) {
			return;
		}
		setThoughtSaving(true);
		try {
			if (thoughtDialogMode === 'create') {
				const item = await createEbookThought({
					bookId,
					cfiRange: thoughtDraft.cfiRange,
					quote: thoughtDraft.quote,
					content,
				});
				setThoughts((prev) => {
					const updated = [item, ...prev];
					setThoughtListGroup(
						updated.filter((thought) => thought.cfiRange === item.cfiRange),
					);
					return updated;
				});
				setThoughtListOpen(true);
				returnToListCfiRef.current = null;
			} else if (thoughtDraft.id) {
				const item = await updateEbookThought(thoughtDraft.id, { content });
				setThoughts((prev) => prev.map((t) => (t.id === item.id ? item : t)));
			}
			setThoughtDialogOpen(false);
		} catch (e) {
			Toast({
				type: 'error',
				title: t('ebook.read.thought.saveFailed'),
				message: getRequestErrorMessage(e),
			});
		} finally {
			setThoughtSaving(false);
		}
	}, [bookId, t, thoughtDialogMode, thoughtDraft, thoughtSaving]);

	const deleteThought = useCallback(async () => {
		if (!thoughtDraft.id || thoughtSaving) return;
		setThoughtSaving(true);
		try {
			await deleteEbookThought(thoughtDraft.id);
			setThoughts((prev) => prev.filter((t) => t.id !== thoughtDraft.id));
			setThoughtDialogOpen(false);
		} catch (e) {
			Toast({
				type: 'error',
				title: t('ebook.read.thought.deleteFailed'),
				message: getRequestErrorMessage(e),
			});
		} finally {
			setThoughtSaving(false);
		}
	}, [t, thoughtDraft.id, thoughtSaving]);

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
			clearTextSelection: () => void;
			getRendition: () => import('epubjs').Rendition | null;
			syncReadingAnnotations: (nextHighlights?: EbookUserHighlight[]) => void;
		}) => {
			epubNavRef.current = api;
			setEpubNavReady(true);
		},
		[],
	);

	const clearEpubSelection = useCallback(() => {
		epubNavRef.current?.clearTextSelection();
		setSelectionPopBar(null);
		selectionPopBarRef.current = null;
	}, []);

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
		setThoughtListOpen(false);
		setThoughtDialogOpen(false);
		if (draft?.trim()) {
			setAssistantInput(draft.trim());
		}
		setAssistantOpen(true);
	}, []);

	const toggleAssistant = useCallback(() => {
		setAssistantOpen((prev) => {
			if (!prev) {
				setThoughtListOpen(false);
				setThoughtDialogOpen(false);
			}
			return !prev;
		});
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

	const onSelectionPopBarCopy = useCallback(() => {
		const payload = selectionPopBarRef.current;
		if (!payload?.selectedText.trim()) return;
		void copyToClipboard(payload.selectedText);
		setSelectionPopBar(null);
		selectionPopBarRef.current = null;
	}, []);

	const onSelectionPopBarAskBook = useCallback(() => {
		const payload = selectionPopBarRef.current;
		const text = payload?.selectedText ?? '';
		setSelectionPopBar(null);
		selectionPopBarRef.current = null;
		window.setTimeout(() => openAssistantWithSelection(text), 0);
	}, [openAssistantWithSelection]);

	const selectionPopBarLabels = useMemo(
		() => ({
			copy: t('ebook.read.contextMenu.copy'),
			copied: t('chat.codeToolbar.copied'),
			underline: t('ebook.read.selectionPop.underline'),
			removeUnderline: t('ebook.read.selectionPop.removeUnderline'),
			writeThought: t('ebook.read.contextMenu.addThought'),
			share: t('ebook.read.selectionPop.share'),
			askBook: t('ebook.read.selectionPop.askBook'),
			listen: t('ebook.read.selectionPop.listen'),
			styleHighlight: t('ebook.read.selectionPop.styleHighlight'),
			styleUnderline: t('ebook.read.selectionPop.styleUnderline'),
			styleWavy: t('ebook.read.selectionPop.styleWavy'),
			colorPrefix: t('ebook.read.selectionPop.colorPrefix'),
		}),
		[t],
	);

	const thoughtDrawerLabels = useMemo(
		() => ({
			...selectionPopBarLabels,
			share: t('ebook.read.selectionPop.shareShort'),
		}),
		[selectionPopBarLabels, t],
	);

	const thoughtListQuoteActions = useMemo(() => {
		const first = thoughtListGroup[0];
		if (!first?.quote.trim()) return null;
		const quote = first.quote;
		const cfiRange = first.cfiRange;
		const rend = epubNavRef.current?.getRendition() ?? undefined;
		const highlight = findUserHighlightCoveringCfi(
			highlights,
			cfiRange,
			quote,
			rend,
		);
		return {
			labels: thoughtDrawerLabels,
			hasHighlight: Boolean(highlight),
			onCopy: () => void copyToClipboard(quote),
			onUnderline: () =>
				openHighlightPopBarAtBookContent(cfiRange, quote, {
					ensureHighlight: true,
				}),
			onRemoveUnderline: () => void removeHighlightForQuote(cfiRange, quote),
			onWriteThought: () => {
				returnToListCfiRef.current = cfiRange;
				setThoughtListOpen(false);
				openCreateThought(quote, cfiRange);
			},
			onAskBook: () => {
				setThoughtListOpen(false);
				window.setTimeout(() => openAssistantWithSelection(quote), 0);
			},
		};
	}, [
		thoughtListGroup,
		highlights,
		epubNavReady,
		thoughtDrawerLabels,
		openCreateThought,
		openAssistantWithSelection,
		removeHighlightForQuote,
		openHighlightPopBarAtBookContent,
	]);

	const thoughtDialogQuoteActions = useMemo(() => {
		const quote = thoughtDraft.quote.trim();
		if (!quote) return null;
		const cfiRange = thoughtDraft.cfiRange;
		const rend = epubNavRef.current?.getRendition() ?? undefined;
		const highlight = findUserHighlightCoveringCfi(
			highlights,
			cfiRange,
			thoughtDraft.quote,
			rend,
		);
		return {
			labels: thoughtDrawerLabels,
			hasHighlight: Boolean(highlight),
			onCopy: () => void copyToClipboard(thoughtDraft.quote),
			onUnderline: () =>
				openHighlightPopBarAtBookContent(cfiRange, thoughtDraft.quote, {
					ensureHighlight: true,
				}),
			onRemoveUnderline: () =>
				void removeHighlightForQuote(cfiRange, thoughtDraft.quote),
			onWriteThought: () => {
				if (thoughtDialogOpen && thoughtDialogMode === 'create') {
					setThoughtComposeScrollKey((key) => key + 1);
					return;
				}
				setThoughtDialogOpen(false);
				openCreateThought(thoughtDraft.quote, thoughtDraft.cfiRange);
			},
			onAskBook: () => {
				setThoughtDialogOpen(false);
				window.setTimeout(
					() => openAssistantWithSelection(thoughtDraft.quote),
					0,
				);
			},
		};
	}, [
		thoughtDraft.quote,
		thoughtDraft.cfiRange,
		highlights,
		epubNavReady,
		thoughtDialogMode,
		thoughtDialogOpen,
		thoughtDrawerLabels,
		openCreateThought,
		openAssistantWithSelection,
		removeHighlightForQuote,
		openHighlightPopBarAtBookContent,
	]);

	const thoughtPanelOpen = thoughtListOpen || thoughtDialogOpen;
	const sidePanelOpen = assistantOpen || thoughtPanelOpen;

	const closeThoughtDialog = useCallback(() => {
		setThoughtDialogOpen(false);
	}, []);

	const closeThoughtList = useCallback(() => {
		setThoughtListOpen(false);
	}, []);

	const sidePanel = useMemo(() => {
		if (!book) return null;
		if (assistantOpen) {
			return (
				<EbookAssistant
					bookId={book.id}
					bookTitle={book.title}
					input={assistantInput}
					onInputChange={setAssistantInput}
					focusInputAtEndKey={focusInputAtEndKey}
				/>
			);
		}
		if (thoughtDialogOpen) {
			return (
				<EpubThought
					onClose={closeThoughtDialog}
					mode={thoughtDialogMode}
					scrollToComposeKey={thoughtComposeScrollKey}
					quote={thoughtDraft.quote}
					content={thoughtDraft.content}
					username={thoughtDraft.username}
					avatar={thoughtDraft.avatar}
					createdAt={thoughtDraft.createdAt}
					updatedAt={thoughtDraft.updatedAt}
					quoteActions={thoughtDialogQuoteActions}
					onQuoteHighlightClick={() =>
						openHighlightPopBarAtBookContent(
							thoughtDraft.cfiRange,
							thoughtDraft.quote,
						)
					}
					onContentChange={(content) =>
						setThoughtDraft((d) => ({ ...d, content }))
					}
					onSave={saveThought}
					onDelete={thoughtDialogMode !== 'create' ? deleteThought : undefined}
					onEdit={
						thoughtDialogMode === 'view'
							? () => setThoughtDialogMode('edit')
							: undefined
					}
					saving={thoughtSaving}
				/>
			);
		}
		if (thoughtListOpen) {
			return (
				<EpubThoughtList
					onClose={closeThoughtList}
					thoughts={thoughtListGroup}
					onSelect={(thought) => openViewThought(thought, true)}
					quoteActions={thoughtListQuoteActions}
					onQuoteHighlightClick={() => {
						const first = thoughtListGroup[0];
						if (!first) return;
						openHighlightPopBarAtBookContent(first.cfiRange, first.quote);
					}}
				/>
			);
		}
		return null;
	}, [
		book,
		assistantOpen,
		assistantInput,
		closeThoughtDialog,
		closeThoughtList,
		deleteThought,
		focusInputAtEndKey,
		openViewThought,
		saveThought,
		thoughtComposeScrollKey,
		thoughtDialogMode,
		thoughtDialogOpen,
		thoughtDialogQuoteActions,
		thoughtDraft,
		thoughtListGroup,
		thoughtListOpen,
		thoughtListQuoteActions,
		openHighlightPopBarAtBookContent,
		thoughtSaving,
	]);

	const closeContextMenu = useCallback(() => {
		setContextMenu(null);
	}, []);

	const showReaderContextMenu = useCallback(
		(payload: { clientX: number; clientY: number; hasSelection?: boolean }) => {
			setSelectionPopBar(null);
			selectionPopBarRef.current = null;
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
			cfiRange?: string;
			copySelection: () => void;
		}) => {
			const hasSelection = Boolean(payload.selectedText.trim());
			contextPayloadRef.current = {
				selectedText: payload.selectedText,
				cfiRange: payload.cfiRange,
				copySelection: payload.copySelection,
			};
			showReaderContextMenu({
				clientX: payload.clientX,
				clientY: payload.clientY,
				hasSelection,
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
			clearEpubSelection();
		},
		addThought: () => {
			const payload = contextPayloadRef.current;
			const quote = payload?.selectedText.trim() ?? '';
			const cfiRange = payload?.cfiRange;
			if (!quote) return;
			clearEpubSelection();
			window.setTimeout(() => {
				openCreateThought(quote, cfiRange);
			}, 0);
		},
		openAssistant: () => {
			clearEpubSelection();
			openAssistant();
		},
		askAboutSelection: () => {
			const text = contextPayloadRef.current?.selectedText ?? '';
			clearEpubSelection();
			window.setTimeout(() => openAssistantWithSelection(text), 0);
		},
		openToc: () => {
			clearEpubSelection();
			setTocOpen(true);
		},
		openSettings: () => {
			clearEpubSelection();
			setEpubSettingsOpen(true);
		},
		prevPage: () => {
			clearEpubSelection();
			void epubNavRef.current?.prev();
		},
		nextPage: () => {
			clearEpubSelection();
			void epubNavRef.current?.next();
		},
		backToShelf: () => {
			clearEpubSelection();
			nav('/ebook');
		},
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
			if (assistantOpen || thoughtPanelOpen) return;

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
	}, [book, open, tocOpen, epubSettingsOpen, assistantOpen, thoughtPanelOpen]);

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
						sidePanelOpen={sidePanelOpen}
						sidePanel={sidePanel}
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
									!tocOpen && !epubSettingsOpen && !sidePanelOpen
								}
								onReaderContextMenu={showEpubContextMenu}
								onSelectionPopBar={onSelectionPopBarChange}
								thoughts={thoughts}
								highlights={highlights}
								onThoughtClick={openViewThought}
								onThoughtGroupClick={openThoughtGroup}
								onUserHighlightPopBar={onUserHighlightPopBar}
							/>
						</div>
					</EbookReadSplitLayout>
				) : (
					<EbookReadSplitLayout
						sidePanelOpen={assistantOpen}
						sidePanel={
							assistantOpen ? (
								<EbookAssistant
									bookId={book.id}
									bookTitle={book.title}
									input={assistantInput}
									onInputChange={setAssistantInput}
									focusInputAtEndKey={focusInputAtEndKey}
								/>
							) : null
						}
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

			{book.fmt === 'epub' ? (
				<EpubSelectionPopBar
					state={selectionPopBar}
					labels={selectionPopBarLabels}
					selectionFullyHighlighted={selectionFullyHighlighted}
					highlightStyle={highlightStyle}
					highlightColor={highlightColor}
					onHighlightStyleChange={onHighlightStyleChange}
					onHighlightColorChange={onHighlightColorChange}
					onCopy={onSelectionPopBarCopy}
					onApplyHighlight={onApplyHighlight}
					onRemoveHighlight={onRemoveHighlight}
					onWriteThought={onSelectionPopBarWriteThought}
					onAskBook={onSelectionPopBarAskBook}
					onClearSelection={clearEpubSelection}
				/>
			) : null}
		</EbookPageShell>
	);
}

export default observer(EbookReadPage);
