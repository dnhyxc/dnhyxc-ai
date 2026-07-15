import Loading from '@design/Loading';
import Tooltip from '@design/Tooltip';
import { Button } from '@ui/index';
import { Toast } from '@ui/sonner';
import {
	Bot,
	ChevronLeft,
	ChevronRight,
	Headphones,
	List,
	Minus,
	Plus,
} from 'lucide-react';
import { observer } from 'mobx-react';
import {
	startTransition,
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
} from 'react';
import { useNavigate, useParams } from 'react-router';
import { useI18n, useTheme } from '@/hooks';
import { cn } from '@/lib/utils';
import {
	createEbookHighlight,
	createEbookThought,
	deleteEbookHighlight,
	deleteEbookThought,
	fetchEbookHighlights,
	updateEbookHighlight,
	updateEbookThought,
} from '@/service';
import useStore from '@/store';
import ebookStore from '@/store/ebook';
import { copyToClipboard } from '@/utils/clipboard';
import { primeEnglishPlaybackForUserGesture } from '@/utils/englishTts';
import { getRequestErrorMessage } from '@/utils/fetch';
import { EbookPageShell } from './components/layout/EbookPageShell';
import { EbookPanelHeader } from './components/layout/EbookPanelHeader';
import { EbookReadSplitLayout } from './components/layout/EbookReadSplitLayout';
import { EbookTocDrawer } from './components/layout/EbookTocDrawer';
import { EpubListenFollowFab } from './components/listen/EpubListenFollowFab';
import { EpubListenPlayerBar } from './components/listen/EpubListenPlayerBar';
import { EbookAssistant } from './components/reader/EbookAssistant';
import { EpubPane } from './components/reader/EpubPane';
import {
	EpubReaderContextMenu,
	type EpubReaderContextMenuState,
} from './components/reader/EpubReaderContextMenu';
import { EpubReaderSettingsPopover } from './components/reader/EpubReaderSettingsPopover';
import { PdfPane } from './components/reader/PdfPane';
import {
	EpubSelectionPopBar,
	type EpubSelectionPopBarState,
} from './components/selection/EpubSelectionPopBar';
import { EpubQuoteShareDialog } from './components/share/EpubQuoteShareDialog';
import { EbookBookVisibilitySwitch } from './components/shelf/EbookBookVisibilitySwitch';
import { EpubThought } from './components/thought/EpubThought';
import { EpubThoughtList } from './components/thought/EpubThoughtList';
import { useEbookQuoteListen, useEpubChapterListen } from './hooks';
import { useEbookThoughtLoader } from './hooks/useEbookThoughtLoader';
import { usePublicEbookThoughtSync } from './hooks/usePublicEbookThoughtSync';
import type {
	EbookThought,
	EbookThoughtClickCluster,
	EbookTocItem,
	EbookUserHighlight,
	EpubHighlightColorId,
	EpubHighlightStyle,
} from './types';
import { subscribeEbookSplitPanelResizeEnd } from './utils/common/ebookSplitResize';
import { type EbookOpenSource, resolveOpen } from './utils/common/io';
import { findActiveTocItemIndex } from './utils/common/tocActiveIndex';
import { getRememberedEpubPopBarSelectionRange } from './utils/epub/listen/epubListenSegmentOverlay';
import {
	cfiFromDomRange,
	trimSelectionRange,
} from './utils/epub/mark/epubRangeGeometry';
import { ephemeralPinThoughtCfis } from './utils/epub/mark/epubThoughtAnnotations';
import {
	buildSingleCfiCluster,
	expandClusterFromMarkSeed,
	extractCfiSpineHint,
	getThoughtClusterHighlightSubject,
	invalidateThoughtClusterConnectivityCache,
	reconcileThoughtClickCluster,
} from './utils/epub/mark/epubThoughtCluster';
import { isSharedEbookThoughtContext } from './utils/epub/mark/epubThoughtSync';
import {
	buildMergedHighlightTarget,
	findAllUserHighlightsCoveringCfi,
	findAllUserHighlightsForSelection,
	findHighlightsStrictlyContainedIn,
	findUserHighlightByCfi,
	findUserHighlightCoveringCfi,
	findUserHighlightForSelection,
	isCustomHighlightColor,
	isSelectionFullyHighlighted,
	resolveCfiDomRange,
	resolveMergedOverlappingHighlight,
	resolveSelectionHighlightCoverage,
	saveEpubHighlightCustomColor,
} from './utils/epub/mark/epubUserHighlights';
import {
	buildEpubContextMenuItems,
	type EpubReaderContextActions,
} from './utils/epub/reader/buildEpubContextMenuItems';
import {
	extractQuoteSegmentsFromRange,
	type QuoteShareRun,
} from './utils/epub/reader/epubQuoteShareStyled';
import {
	DEFAULT_EPUB_READER_SETTINGS,
	type EpubReaderSettings,
	epubReaderSurfaceBgClass,
	getEpubReaderChromeCssVars,
	loadEpubReaderSettings,
	saveEpubReaderSettings,
} from './utils/epub/reader/epubReaderSettings';
import { scrollEpubCfiIntoView } from './utils/epub/reader/epubScrolledNav';
import {
	buildEpubPopBarPayloadFromCfiRange,
	type EpubSelectionPopBarPayload,
	suppressEpubSelectionPopBarDismiss,
} from './utils/epub/reader/epubSelectionToolbarAttach';
import {
	buildPdfContextMenuItems,
	type PdfReaderContextActions,
} from './utils/pdf/buildPdfContextMenuItems';
import { parsePdfPageHref } from './utils/pdf/pdfOutline';
import {
	loadPdfZoom,
	PDF_ZOOM_MAX,
	PDF_ZOOM_MIN,
	PDF_ZOOM_STEP,
	savePdfZoom,
	stepPdfZoom,
} from './utils/pdf/pdfReaderSettings';

function EbookReadPage() {
	const { t } = useI18n();
	const { theme: appTheme } = useTheme();
	const { userStore } = useStore();
	const currentUserId = Number(userStore.userInfo?.id) || 0;
	const { bookId = '' } = useParams();
	const nav = useNavigate();
	const [bookResolving, setBookResolving] = useState(false);
	/** ensureBookForRead 完成后才判定源书是否下架（仅进书/刷新时拉一次详情） */
	const [bookDetailReady, setBookDetailReady] = useState(false);
	const book = ebookStore.bookById(bookId);
	const prog = ebookStore.progOf(bookId);
	const publicSource = ebookStore.publicSourceOf(bookId);
	const publicSourceRevoked =
		bookDetailReady &&
		Boolean(book?.sourceBookId && !publicSource?.isStillPublic);
	const isOwnerSourceBook =
		book != null && !book.sourceBookId && book.fmt === 'epub';
	const canSetPublic = isOwnerSourceBook && book?.src.kind === 'store';
	const currentEpubCfiRef = useRef(prog?.epubCfi ?? '');
	const epubSpineIndexRef = useRef<number | undefined>(undefined);

	const epubNavRef = useRef<{
		prev: () => Promise<void>;
		next: () => Promise<void>;
		go: (href: string) => Promise<string | undefined>;
		clearTextSelection: () => void;
		getRendition: () => import('epubjs').Rendition | null;
		getBook: () => import('epubjs').Book | null;
		syncReadingAnnotations: (nextHighlights?: EbookUserHighlight[]) => void;
	} | null>(null);

	const [open, setOpen] = useState<ArrayBuffer | null>(null);
	const [openSource, setOpenSource] = useState<EbookOpenSource | null>(null);
	const [tocItems, setTocItems] = useState<EbookTocItem[]>([]);
	const [tocOpen, setTocOpen] = useState(false);
	const [epubSettingsOpen, setEpubSettingsOpen] = useState(false);
	const [listenSentenceMenuOpen, setListenSentenceMenuOpen] = useState(false);
	const [listenRateMenuOpen, setListenRateMenuOpen] = useState(false);
	const epubSettingsOpenRef = useRef(epubSettingsOpen);
	epubSettingsOpenRef.current = epubSettingsOpen;
	const listenSentenceMenuOpenRef = useRef(listenSentenceMenuOpen);
	listenSentenceMenuOpenRef.current = listenSentenceMenuOpen;
	const listenRateMenuOpenRef = useRef(listenRateMenuOpen);
	listenRateMenuOpenRef.current = listenRateMenuOpen;
	const [epubSettings, setEpubSettings] = useState<EpubReaderSettings>(
		loadEpubReaderSettings,
	);
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
	/** 目录高亮：同 spine 多锚点时需随 CFI 更新，不能只跟 spineIndex */
	const [readingCfi, setReadingCfi] = useState('');

	const chapterListen = useEpubChapterListen(
		t,
		() => epubNavRef.current?.getRendition() ?? null,
		() => currentEpubCfiRef.current || prog?.epubCfi,
		() => epubNavRef.current?.syncReadingAnnotations(),
		() => epubSpineIndexRef.current ?? epubSpineIndex,
	);
	const chapterListenRef = useRef(chapterListen);
	chapterListenRef.current = chapterListen;

	const { toggleListen, listenLabel, ...quoteListen } = useEbookQuoteListen(
		t,
		() => epubNavRef.current?.getRendition() ?? null,
		() => epubNavRef.current?.syncReadingAnnotations(),
		() => epubSpineIndexRef.current ?? epubSpineIndex,
	);

	const epubListenBar = chapterListen.isActive
		? chapterListen
		: quoteListen.isActive
			? quoteListen
			: chapterListen;

	const [pdfZoom, setPdfZoom] = useState(loadPdfZoom);
	const [assistantOpen, setAssistantOpen] = useState(false);
	const [assistantInput, setAssistantInput] = useState('');
	const [focusInputAtEndKey, setFocusInputAtEndKey] = useState(0);
	const [contextMenu, setContextMenu] =
		useState<EpubReaderContextMenuState | null>(null);
	const contextMenuOpenRef = useRef(false);
	const contextActionsRef = useRef<EpubReaderContextActions | null>(null);
	const pdfContextActionsRef = useRef<PdfReaderContextActions | null>(null);
	const contextPayloadRef = useRef<{
		selectedText: string;
		cfiRange?: string;
		copySelection: () => void;
	} | null>(null);
	const [thoughtListCluster, setThoughtListCluster] =
		useState<EbookThoughtClickCluster | null>(null);
	const thoughtListClusterRef = useRef<EbookThoughtClickCluster | null>(null);
	thoughtListClusterRef.current = thoughtListCluster;
	const [thoughtDialogOpen, setThoughtDialogOpen] = useState(false);
	const [thoughtDialogMode, setThoughtDialogMode] = useState<
		'create' | 'view' | 'edit'
	>('create');
	const [thoughtSaving, setThoughtSaving] = useState(false);
	const [thoughtListOpen, setThoughtListOpen] = useState(false);
	const [thoughtComposeScrollKey, setThoughtComposeScrollKey] = useState(0);
	const [selectionPopBar, setSelectionPopBar] =
		useState<EpubSelectionPopBarState | null>(null);
	const selectionPopBarRef = useRef<EpubSelectionPopBarPayload | null>(null);
	const [quoteShareOpen, setQuoteShareOpen] = useState(false);
	const quoteShareOpenRef = useRef(false);
	const [quoteShareText, setQuoteShareText] = useState('');
	const [quoteShareSegments, setQuoteShareSegments] = useState<
		QuoteShareRun[] | undefined
	>();
	const [highlights, setHighlights] = useState<EbookUserHighlight[]>([]);
	const [highlightStyle, setHighlightStyle] =
		useState<EpubHighlightStyle>('highlight');
	const [highlightColor, setHighlightColor] =
		useState<EpubHighlightColorId>('pink');
	const highlightsRef = useRef(highlights);
	highlightsRef.current = highlights;
	/** 串行化划线 upsert，避免 ColorPicker 连续提交并发删改同一 id */
	const highlightUpsertQueueRef = useRef(
		Promise.resolve(null as EbookUserHighlight | null),
	);
	const returnToListClusterRef = useRef<EbookThoughtClickCluster | null>(null);
	/** 想法侧栏开合时保持左侧引用段落在视口内（分栏 resize 后回滚） */
	const thoughtQuoteAnchorCfiRef = useRef<string | undefined>(undefined);
	const [thoughtDraft, setThoughtDraft] = useState({
		id: '',
		userId: 0,
		quote: '',
		cfiRange: '',
		content: '',
		username: '',
		avatar: '',
		createdAt: '',
		updatedAt: '',
		isPublic: true,
	});
	const progTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
	const pendingEpubProgRef = useRef<{
		cfi: string;
		percent?: number;
	} | null>(null);
	const pendingPdfProgRef = useRef<{
		page: number;
		percent?: number;
	} | null>(null);

	useEffect(() => {
		quoteShareOpenRef.current = quoteShareOpen;
	}, [quoteShareOpen]);

	useEffect(() => {
		if (!bookId) return;
		let cancelled = false;
		setBookDetailReady(false);
		void (async () => {
			if (!ebookStore.bookById(bookId)) {
				setBookResolving(true);
			}
			try {
				await ebookStore.ensureBookForRead(bookId);
			} finally {
				if (!cancelled) {
					setBookResolving(false);
					setBookDetailReady(true);
				}
			}
		})();
		return () => {
			cancelled = true;
		};
	}, [bookId]);

	useEffect(() => {
		invalidateThoughtClusterConnectivityCache();
	}, [bookId]);

	const getEpubRendition = useCallback(
		() => epubNavRef.current?.getRendition() ?? null,
		[],
	);

	const onThoughtLoadError = useCallback(
		(error: unknown) => {
			Toast({
				type: 'error',
				title: t('ebook.read.thought.loadFailed'),
				message: getRequestErrorMessage(error),
			});
		},
		[t],
	);

	const { thoughts, setThoughts, ensureLoadedSpineThoughts } =
		useEbookThoughtLoader({
			bookId: bookId || undefined,
			bookFmt: book?.fmt,
			epubNavReady,
			getRendition: getEpubRendition,
			onLoadError: onThoughtLoadError,
		});
	const thoughtsRef = useRef(thoughts);
	thoughtsRef.current = thoughts;

	const { scheduleSync: schedulePublicThoughtSync, refreshThoughtsNow } =
		usePublicEbookThoughtSync({
			bookId,
			book,
			publicSource,
			thoughts,
			setThoughts,
			onMerged: invalidateThoughtClusterConnectivityCache,
		});
	const publicThoughtSyncEnabledRef = useRef(false);
	publicThoughtSyncEnabledRef.current = isSharedEbookThoughtContext(
		book,
		publicSource,
	);

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

	const selectionHighlightCoverage = useMemo(() => {
		if (!selectionPopBar?.cfiRange) return 'none' as const;
		const rend = epubNavRef.current?.getRendition() ?? undefined;
		return resolveSelectionHighlightCoverage(
			highlights,
			selectionPopBar.cfiRange,
			selectionPopBar.selectedText,
			rend,
		);
	}, [highlights, selectionPopBar, epubNavReady]);

	const selectionFullyHighlighted = selectionHighlightCoverage === 'full';
	const selectionHasHighlight = selectionHighlightCoverage !== 'none';

	/**
	 * 针对指定 cfiRange + quote 的选区，执行高亮的新增/合并/更新流程，保证无重叠、无重复、最精确划线
	 * - 支持合并相邻、重叠、被包含的划线，高亮文本自动规范化
	 * - 支持重叠划线的合并删除（先删后建），避免同一区域保留多条无意义划线
	 *
	 * @param cfiRange - 本次高亮的选区 CFI 字符串（唯一定位选区）
	 * @param quote - 选区原始文本
	 * @param style - 高亮样式（荧光、下划线等）
	 * @param color - 高亮颜色 ID
	 * @returns 新建/更新的高亮对象，失败时返回 null
	 */
	const upsertHighlightForQuote = useCallback(
		async (
			cfiRange: string,
			quote: string,
			style: EpubHighlightStyle,
			color: EpubHighlightColorId,
		): Promise<EbookUserHighlight | null> => {
			const execute = async (): Promise<EbookUserHighlight | null> => {
				// 基本校验，无选区或无 bookId 不处理
				if (!cfiRange || !bookId) return null;

				// 当前 epub 渲染器实例（如存在）
				const rend = epubNavRef.current?.getRendition() ?? undefined;
				// 存储本次最终确定的 cfi & quote
				let targetCfi = cfiRange;
				let targetQuote = quote;
				// 需删除的重叠高亮 id 集合
				const removeIds = new Set<string>();

				// -------（1）标准化选区 + 查找 DOM 重叠/合并 -------
				if (rend) {
					// 尝试解析当前 cfiRange 对应 domRange
					const resolved = resolveCfiDomRange(rend, cfiRange);
					if (resolved) {
						// 对 domRange 归一化，去除多余空白等
						const normalized = trimSelectionRange(resolved);
						// 重新计算 CFI，保证与实际 dom 对齐，避免多余重叠
						targetCfi = cfiFromDomRange(rend, normalized) ?? cfiRange.trim();
						// 取标准文本
						targetQuote = normalized.toString().trim() || quote.trim();
					}

					// 查找所有与当前 CFI/quote 重叠、相接的高亮（用于合并连片的选择）
					const merged = resolveMergedOverlappingHighlight(
						rend,
						targetCfi,
						targetQuote,
						highlightsRef.current,
					);
					// 更新合并后的目标 cfi/quote，准备实际保存
					targetCfi = merged.cfiRange;
					targetQuote = merged.quote;
					// 合并目标中需删除的旧高亮收集
					for (const id of merged.removeHighlightIds) {
						removeIds.add(id);
					}
				}

				// -------（2）查找被完全包含于此次选区的旧高亮，也一并移除 -------
				const superseded = findHighlightsStrictlyContainedIn(
					{ cfiRange: targetCfi, quote: targetQuote },
					// 已确定将要被删除的先排除避免重复
					highlightsRef.current.filter((h) => !h.id || !removeIds.has(h.id)),
				);
				for (const item of superseded) {
					if (item.id) removeIds.add(item.id);
				}

				// -------（3）如有合并并删除多个高亮，根据新一组目标再次归一化 cfi/quote -------
				// 仅依赖 DOM 合并和严格包含（不比对 quote 子串，避免选错）
				if (rend && removeIds.size > 0) {
					// 获取所有待合并的高亮对象
					const mergeTargets = highlightsRef.current.filter(
						(h) => h.id && removeIds.has(h.id),
					);
					// 使用所有合并对象重新计算合并目标（位置更准）
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
					// -------（4）无重叠（只需新增或更新一个高亮） -------
					if (removeIds.size === 0) {
						// 检查是不是当前 cfi 已有同样的高亮（完全覆盖）
						const existingExact = findUserHighlightByCfi(
							highlightsRef.current,
							targetCfi,
						);

						const item = existingExact?.id
							? // 已有则直接更新内容/样式/颜色
								await updateEbookHighlight(existingExact.id, {
									quote: targetQuote,
									style,
									color,
								})
							: // 没有则直接新建
								await createEbookHighlight({
									bookId,
									cfiRange: targetCfi,
									quote: targetQuote,
									style,
									color,
								});

						// 刷新本地高亮缓存并触发界面刷新
						const next = [
							...highlightsRef.current.filter((h) => h.id !== item.id),
							item,
						];
						highlightsRef.current = next;
						setHighlights(next);
						return item;
					}

					// -------（5）如需清理（即有多余重叠/包裹的高亮）先删除再新建 -------
					await Promise.all(
						[...removeIds].map((id) => deleteEbookHighlight(id)),
					);
					const item = await createEbookHighlight({
						bookId,
						cfiRange: targetCfi,
						quote: targetQuote,
						style,
						color,
					});
					// 刷新高亮缓存及列表：移除删除目标，加入新高亮
					const next = [
						...highlightsRef.current.filter((h) => !removeIds.has(h.id)),
						item,
					];
					highlightsRef.current = next;
					setHighlights(next);
					return item;
				} catch (e) {
					// 错误处理，弹窗提示
					Toast({
						type: 'error',
						title: t('ebook.read.highlight.saveFailed'),
						message: getRequestErrorMessage(e),
					});
					return null;
				}
			};

			const result = highlightUpsertQueueRef.current.then(execute, execute);
			highlightUpsertQueueRef.current = result.catch(() => null);
			return result;
		},
		[bookId, t],
	);

	/**
	 * 针对当前选区（selectionPopBarRef 所指内容）执行高亮「新增/更新」操作。
	 * - 若已存在该选区的划线，则覆盖其 style/color，否则新建高亮
	 * - 完成后刷新界面划线状态，更新 PopBar，并同步最新高亮文本（去除首尾空白）
	 *
	 * @param style - 用户选定的高亮类型（如荧光/下划线）
	 * @param color - 高亮颜色 ID
	 * @returns 新增或更新的高亮对象（失败返回 null）
	 */
	const upsertSelectionHighlight = useCallback(
		async (style: EpubHighlightStyle, color: EpubHighlightColorId) => {
			// 1. 拿到当前 PopBar 的 payload（包含选区 cfiRange、原始文本等）
			const payload = selectionPopBarRef.current;
			if (!payload?.cfiRange) return null; // 没有选区（异常情况），直接退出

			// 2. 执行高亮 upsert（即根据 cfi + 选中文本覆盖/新增高亮）
			const item = await upsertHighlightForQuote(
				payload.cfiRange,
				payload.selectedText,
				style,
				color,
			);
			if (!item) return null; // 失败直接退出

			// 3. 抑制 PopBar「自动关闭」机制，避免界面跳动
			suppressEpubSelectionPopBarDismiss();
			// 4. 清除 Webview 选区（高亮后默认取消实际文本反选）
			epubNavRef.current?.clearTextSelection();

			// 5. 生成最新 PopBar payload：使用高亮实际返回的 cfiRange/quote 修正内容
			const nextPayload: EpubSelectionPopBarPayload = {
				...payload,
				cfiRange: item.cfiRange,
				selectedText: item.quote?.trim() || payload.selectedText,
			};
			// 6. 全面刷新当前界面「高亮状态」及 PopBar
			selectionPopBarRef.current = nextPayload;
			setHighlightStyle(item.style);
			setHighlightColor(item.color);
			setSelectionPopBar({ ...nextPayload, open: true });
			// 7. 返回新增/更新后的高亮对象
			return item;
		},
		[upsertHighlightForQuote],
	);

	const onApplyHighlight = useCallback(() => {
		void upsertSelectionHighlight(highlightStyle, highlightColor);
	}, [highlightColor, highlightStyle, upsertSelectionHighlight]);

	/** 引用 CFI 已渲染并滚入左侧阅读视口（侧栏划线/删线、分栏 resize 后复用） */
	const ensureQuoteCfiInViewport = useCallback(
		async (cfiRange: string) => {
			if (book?.fmt !== 'epub') return;
			const cfi = cfiRange.trim();
			if (!cfi) return;
			const rend = epubNavRef.current?.getRendition();
			if (!rend) return;
			if (!resolveCfiDomRange(rend, cfi)) {
				try {
					await rend.display(cfi);
					await new Promise<void>((resolve) => {
						requestAnimationFrame(() => {
							requestAnimationFrame(() => resolve());
						});
					});
				} catch {
					// 定位失败时 scroll 为 no-op
				}
			}
			scrollEpubCfiIntoView(rend, cfi);
		},
		[book?.fmt, epubNavReady],
	);

	const removeHighlightsForQuote = useCallback(
		async (cfiRange: string, quote: string) => {
			await ensureQuoteCfiInViewport(cfiRange);
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
		[t, ensureQuoteCfiInViewport],
	);

	const removeHighlightForQuote = removeHighlightsForQuote;

	/**
	 * 用户点击高亮时，弹出 PopBar 工具栏并设置对应状态
	 *
	 * 1. 抑制 PopBar 自动消失，避免交互过程中被关闭
	 * 2. 保存当前 PopBar payload 到 ref，便于后续操作使用
	 * 3. 恢复当前高亮的样式和颜色（高亮按钮和面板需依赖）
	 * 4. 设置 PopBar 状态为打开，并传递 payload
	 *
	 * @param payload PopBar 展示所需的基本定位/文本参数
	 * @param highlight 当前用户的高亮对象（含样式/颜色）
	 */
	const onUserHighlightPopBar = useCallback(
		(payload: EpubSelectionPopBarPayload, highlight: EbookUserHighlight) => {
			suppressEpubSelectionPopBarDismiss(); // 1. 抑制自动消失
			selectionPopBarRef.current = payload; // 2. 存ref
			setHighlightStyle(highlight.style); // 3. 设置样式
			setHighlightColor(highlight.color); // 3. 设置颜色
			setSelectionPopBar({ ...payload, open: true }); // 4. PopBar 开启
		},
		[],
	);

	/**
	 * 在正文指定 cfiRange 及 quote 处打开高亮 PopBar 工具栏。
	 *
	 * 功能说明：
	 * - 定位到指定 cfiRange，如当前未渲染则先跳转、强制刷新视图；
	 * - 如目标处已有高亮，则恢复高亮样式和颜色；
	 * - 如 options.ensureHighlight 为 true 且没高亮，则自动创建高亮并应用默认样式；
	 * - 始终构造 PopBar payload 并显示弹窗，便于后续操控。
	 *
	 * 重要流程：
	 * 1. 若页面未渲染到相应位置，先异步跳转并等待页面准备完成；
	 * 2. 查找当前位置是否已经有用户高亮（通过 cfi + quote 匹配）；
	 * 3. 若需要则自动创建高亮，完成后等待高亮渲染完毕（保证样式正确）；
	 * 4. 始终构造并显示 PopBar，selection 状态写入 ref 并弹出工具栏。
	 * 5. 若命中高亮，则 PopBar 弹出时样式同步为当前高亮样式。
	 *
	 * @param cfiRange 定位的内容片段范围（EPUB CFI）
	 * @param quote    高亮对应的文本内容
	 * @param options  可选参数，如 ensureHighlight：无高亮时是否自动创建
	 */
	const openHighlightPopBarAtBookContent = useCallback(
		(
			cfiRange: string,
			quote: string,
			options?: { ensureHighlight?: boolean },
		) => {
			void (async () => {
				// 获取 epub 渲染器，如果未挂载或无 bookId 则直接返回
				const rend = epubNavRef.current?.getRendition() ?? null;
				if (!rend || !bookId) return;

				await ensureQuoteCfiInViewport(cfiRange);

				// 检查当前位置是否已经有用户高亮（通过 cfi 和 quote 匹配）
				let highlight = findUserHighlightCoveringCfi(
					highlightsRef.current,
					cfiRange,
					quote,
					rend,
				);

				// 如果需要保证有高亮：无高亮时自动创建一个，并等待渲染完成
				if (options?.ensureHighlight) {
					const created = await upsertHighlightForQuote(
						cfiRange,
						quote,
						highlightStyle,
						highlightColor,
					);
					if (created) {
						highlight = created;
						// 等待渲染同步，确保高亮已成功渲染
						await new Promise<void>((resolve) => {
							requestAnimationFrame(() => {
								requestAnimationFrame(() => resolve());
							});
						});
					}
				}
				// 如果已有高亮，则恢复其样式与颜色
				else if (highlight) {
					setHighlightStyle(highlight.style);
					setHighlightColor(highlight.color);
				}

				// 生成 PopBar 的展示定位 payload，优先用（新）高亮的 cfi/quote
				const payload = buildEpubPopBarPayloadFromCfiRange(
					rend,
					highlight?.cfiRange ?? cfiRange,
					highlight?.quote ?? quote,
					resolveCfiDomRange,
				);
				// 记录当前 PopBar 的 payload 到 ref
				selectionPopBarRef.current = payload;
				// 再次同步样式（保险多次，兼容 ensureHighlight 和已存在高亮两种场景）
				if (highlight) {
					setHighlightStyle(highlight.style);
					setHighlightColor(highlight.color);
				}
				const targetCfi = highlight?.cfiRange ?? cfiRange;
				scrollEpubCfiIntoView(rend, targetCfi);
				// 打开 PopBar，展示工具栏
				setSelectionPopBar({ ...payload, open: true });
			})();
		},
		[
			bookId,
			highlightColor,
			highlightStyle,
			upsertHighlightForQuote,
			ensureQuoteCfiInViewport,
		],
	);

	// 用于移除当前选中的高亮内容
	const onRemoveHighlight = useCallback(async () => {
		// 获取当前 PopBar 的 payload，包含高亮的 cfiRange 及选中文本信息
		const payload = selectionPopBarRef.current;
		// 若没有 cfiRange，说明没有可删除的高亮，直接返回
		if (!payload?.cfiRange) return;
		// 获取当前 epub 的 rendition 实例，如果还没有则为 undefined
		const rend = epubNavRef.current?.getRendition() ?? undefined;
		// 查找所有与当前选区相关的用户高亮（可能存在多个重叠的高亮）
		const existing = findAllUserHighlightsForSelection(
			highlightsRef.current,
			payload.cfiRange,
			payload.selectedText,
			rend,
		);
		// 如果没有相关高亮，直接返回
		if (existing.length === 0) return;

		// 收集所有找到的高亮 id，准备批量删除
		const removeIds = new Set(
			existing.map((item) => item.id).filter(Boolean) as string[],
		);
		try {
			// 并发删除所有高亮（请求后端），如果有任何一个失败会被 catch 捕获
			await Promise.all([...removeIds].map((id) => deleteEbookHighlight(id)));
			// 过滤掉已删除的高亮，构造下一步保留的高亮数组
			const next = highlightsRef.current.filter((h) => !removeIds.has(h.id));
			// 更新高亮 ref 和状态
			highlightsRef.current = next;
			setHighlights(next);
		} catch (e) {
			// 删除失败时弹出错误提示，显示本地化的失败信息和具体的错误内容
			Toast({
				type: 'error',
				title: t('ebook.read.highlight.deleteFailed'),
				message: getRequestErrorMessage(e),
			});
		}
	}, [t]);

	// 用于处理高亮样式切换（例如更改为下划线、背景等），会在弹出操作栏中触发
	const onHighlightStyleChange = useCallback(
		(style: EpubHighlightStyle) => {
			// 更新当前选中高亮样式到状态（React 状态，一般用于渲染和后续操作）
			setHighlightStyle(style);
			// 获取弹出栏当前的 payload，其中包含当前用户选中的 CFI 区间和选中文本
			const payload = selectionPopBarRef.current;
			// 如果没有 cfiRange，说明当前没有可变更样式的高亮，直接返回
			if (!payload?.cfiRange) return;
			// 尝试获取 epub 的 rendition 实例（用于后续高亮定位、查找等操作）
			const rend = epubNavRef.current?.getRendition() ?? undefined;
			// 判断当前选区是否"完全高亮"（即选区内所有内容是否都被高亮）
			// 若不是全部高亮，并且查找不到任何与当前选区匹配的用户高亮，则无需操作，直接返回
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
			// 如果存在高亮，或当前选区已完全高亮，则调用方法更新高亮样式
			// upsertSelectionHighlight 会异步提交样式变化，可以用 void 忽略返回值（无须等待结束）
			void upsertSelectionHighlight(style, highlightColor);
		},
		// 依赖项中包含高亮颜色和处理高亮变更的逻辑
		[highlightColor, upsertSelectionHighlight],
	);

	// 用于处理高亮颜色的变更（如切换黄/粉/蓝/紫标注色），通常在高亮弹出栏中点击颜色按钮触发
	const onHighlightColorChange = useCallback(
		(color: EpubHighlightColorId) => {
			setHighlightColor(color);
			if (isCustomHighlightColor(color)) {
				saveEpubHighlightCustomColor(color);
			}

			// 获取当前弹出栏的 payload 信息，包括用户所选区域的 cfiRange 和相关文本
			const payload = selectionPopBarRef.current;

			// 如果当前 selection 没有 cfiRange，说明未选中文本，不做任何处理直接返回
			if (!payload?.cfiRange) return;

			// 获取 epub 的 rendition 实例（用于检查高亮、定位等）
			const rend = epubNavRef.current?.getRendition() ?? undefined;

			// 判断当前选区是否为「完全高亮」，
			// 若不是，并且在当前选区找不到任何用户高亮，则说明用户操作无效，直接返回
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

			// 若选区有高亮或已完全高亮，则实际调用高亮更新方法，
			// 传入当前的高亮样式和要设置的新颜色。upsertSelectionHighlight 返回 Promise，这里直接忽略（无需等待）。
			void upsertSelectionHighlight(highlightStyle, color);
		},
		// 依赖于当前高亮样式、upsertSelectionHighlight 函数
		[highlightStyle, upsertSelectionHighlight],
	);

	// 用于打开「想法详情」弹窗的回调方法。思路：设定弹窗内容，关闭侧栏（如有），准备后续还原快照等动作
	const openViewThought = useCallback(
		// thought: 当前要查看的想法对象；fromList: 是否由列表跳转（默认为 false）
		(thought: EbookThought, fromList = false) => {
			// 打开想法详情时总是关闭助手侧栏
			setAssistantOpen(false);

			// 如果是通过列表点击跳转到详情，则需要保存当前列表快照以便后续返回
			if (fromList) {
				if (thoughtListClusterRef.current) {
					returnToListClusterRef.current = thoughtListClusterRef.current;
				}
				setThoughtListOpen(false);
				setThoughtListCluster(null);
			} else {
				// 非从列表跳转进入时，重置还原列表快照记录
				returnToListClusterRef.current = null;
			}

			// 在状态中准备当前要查看的想法草稿，用于弹窗内容显示
			setThoughtDraft({
				id: thought.id, // 想法唯一 id
				userId: thought.userId,
				quote: thought.quote, // 被标注引用的文本内容
				cfiRange: thought.cfiRange, // CFI 定位范围，用于定位电子书位置
				content: thought.content, // 想法正文内容
				username: thought.username, // 用户名
				avatar: thought.avatar, // 用户头像
				createdAt: thought.createdAt, // 创建时间
				updatedAt: thought.updatedAt, // 更新时间
				isPublic: thought.isPublic !== false,
			});
			// 将弹窗模式设为「查看」模式，后续可切换为编辑、创建等其它模式
			setThoughtDialogMode('view');
			// 打开想法详情弹窗（展示/渲染）
			setThoughtDialogOpen(true);
		},
		[], // 没有外部依赖，函数只在首次渲染时生成一次
	);

	/** 从列表快照恢复侧栏；按列表「共 N 条」判断，无数据则收起 */
	const restoreThoughtListFromSnapshot = useCallback(
		(snapshot: EbookThoughtClickCluster, nextThoughts: EbookThought[]) => {
			const rend = epubNavRef.current?.getRendition() ?? undefined;
			const reconciled = reconcileThoughtClickCluster(
				snapshot,
				nextThoughts,
				rend,
			);
			if (reconciled && reconciled.allThoughts.length > 0) {
				setThoughtListCluster(reconciled);
				setThoughtListOpen(true);
				return true;
			}
			setThoughtListCluster(null);
			setThoughtListOpen(false);
			return false;
		},
		[],
	);

	useEffect(() => {
		if (thoughtDialogOpen) return;
		const snapshot = returnToListClusterRef.current;
		if (!snapshot) return;
		returnToListClusterRef.current = null;
		restoreThoughtListFromSnapshot(snapshot, thoughts);
	}, [
		thoughtDialogOpen,
		thoughts,
		epubNavReady,
		restoreThoughtListFromSnapshot,
	]);

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
			thoughtQuoteAnchorCfiRef.current = cfiRange.trim();
			setAssistantOpen(false);
			setSelectionPopBar(null);
			selectionPopBarRef.current = null;
			if (thoughtListClusterRef.current) {
				returnToListClusterRef.current = thoughtListClusterRef.current;
			}
			setThoughtListOpen(false);
			setThoughtDraft({
				id: '',
				userId: currentUserId,
				quote: trimmed,
				cfiRange,
				content: '',
				username: '',
				avatar: '',
				createdAt: '',
				updatedAt: '',
				isPublic: true,
			});
			setThoughtDialogMode('create');
			setThoughtDialogOpen(true);
			setThoughtComposeScrollKey((key) => key + 1);
		},
		[t, currentUserId],
	);

	const onSelectionPopBarChange = useCallback(
		(payload: EpubSelectionPopBarPayload | null) => {
			if (!payload) {
				// 分享弹窗打开时 iframe 选区会失焦，勿误关 PopBar
				if (quoteShareOpenRef.current) return;
				setSelectionPopBar(null);
				selectionPopBarRef.current = null;
				return;
			}
			if (contextMenuOpenRef.current) return;
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

	const openThoughtCluster = useCallback(
		(cluster: EbookThoughtClickCluster) => {
			if (cluster.allThoughts.length === 0) return;
			const seedCluster = { ...cluster, selectedThoughtId: undefined };

			void (async () => {
				const rend = epubNavRef.current?.getRendition() ?? undefined;
				const fresh = await refreshThoughtsNow();
				const allThoughts = fresh ?? thoughtsRef.current;

				invalidateThoughtClusterConnectivityCache();
				const reconciled = rend
					? expandClusterFromMarkSeed(
							rend,
							allThoughts,
							seedCluster.allThoughts,
						)
					: reconcileThoughtClickCluster(seedCluster, allThoughts, rend);
				if (!reconciled || reconciled.allThoughts.length === 0) return;

				const { cfiRange } = getThoughtClusterHighlightSubject(
					reconciled,
					rend,
				);
				if (cfiRange.trim()) {
					thoughtQuoteAnchorCfiRef.current = cfiRange.trim();
				}

				startTransition(() => {
					setAssistantOpen(false);
					setThoughtListCluster(reconciled);
					setThoughtListOpen(true);
				});
			})();
		},
		[refreshThoughtsNow],
	);

	const saveThought = useCallback(
		async (isPublic: boolean) => {
			const content = thoughtDraft.content.trim();
			if (!content || !thoughtDraft.cfiRange || !bookId || thoughtSaving) {
				return;
			}
			setThoughtSaving(true);
			try {
				let cfiRange = thoughtDraft.cfiRange;
				let quote = thoughtDraft.quote;
				const rend = epubNavRef.current?.getRendition();
				if (rend) {
					const resolved = resolveCfiDomRange(rend, cfiRange);
					if (resolved) {
						const normalized = trimSelectionRange(resolved);
						cfiRange = cfiFromDomRange(rend, normalized) ?? cfiRange.trim();
						quote = normalized.toString().trim() || quote.trim();
					}
				}
				if (thoughtDialogMode === 'create') {
					const item = await createEbookThought({
						bookId,
						cfiRange,
						quote,
						content,
						isPublic,
					});
					ephemeralPinThoughtCfis([cfiRange]);
					setThoughts((prev) => {
						const updated = [item, ...prev];
						const snapshot = returnToListClusterRef.current;
						const clusterCfis = snapshot
							? new Set(snapshot.quoteGroups.map((group) => group.cfiRange))
							: null;
						if (clusterCfis?.has(item.cfiRange)) {
							const reconciled = reconcileThoughtClickCluster(
								snapshot!,
								updated,
								epubNavRef.current?.getRendition() ?? undefined,
							);
							if (reconciled) {
								setThoughtListCluster(reconciled);
							}
						} else {
							setThoughtListCluster(
								buildSingleCfiCluster(updated, item.cfiRange) ?? null,
							);
						}
						return updated;
					});
					setThoughtListOpen(true);
					returnToListClusterRef.current = null;
				} else if (thoughtDraft.id) {
					const item = await updateEbookThought(thoughtDraft.id, {
						content,
						isPublic,
					});
					ephemeralPinThoughtCfis([item.cfiRange]);
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
		},
		[bookId, t, thoughtDialogMode, thoughtDraft, thoughtSaving],
	);

	// 删除读书想法的回调函数，使用useCallback保证依赖变化时更新
	const deleteThought = useCallback(async () => {
		// 若当前没有选中的想法id或正在保存中，则终止操作
		if (!thoughtDraft.id || thoughtSaving) return;
		// 标记正在进行保存操作，避免并发
		setThoughtSaving(true);
		try {
			// 调用删除API删除当前想法
			await deleteEbookThought(thoughtDraft.id);
			// 过滤掉刚删除的想法，得到新的想法列表
			const nextThoughts = thoughts.filter((t) => t.id !== thoughtDraft.id);
			// 获取用来还原列表聚合快照的引用，如果returnToListClusterRef没有快照则用当前聚合快照
			const listSnapshot =
				returnToListClusterRef.current ?? thoughtListClusterRef.current;
			returnToListClusterRef.current = null;
			if (listSnapshot) {
				restoreThoughtListFromSnapshot(listSnapshot, nextThoughts);
			} else {
				setThoughtListCluster(null);
				setThoughtListOpen(false);
			}
			setThoughts(nextThoughts);
			setThoughtDialogOpen(false);
		} catch (e) {
			// 捕获异常，弹出错误提示
			Toast({
				type: 'error',
				title: t('ebook.read.thought.deleteFailed'),
				message: getRequestErrorMessage(e),
			});
		} finally {
			// 不论成功或失败，均重置保存状态
			setThoughtSaving(false);
		}
		// 依赖项：翻译函数、选中想法id、保存状态、想法列表、快照还原函数
	}, [
		t,
		thoughtDraft.id,
		thoughtSaving,
		thoughts,
		restoreThoughtListFromSnapshot,
	]);

	useEffect(() => {
		if (!book || !bookDetailReady || publicSourceRevoked) return;
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
		setReadingCfi('');
		(async () => {
			try {
				const result = await resolveOpen(book.src, book.fmt, book.id);
				if (!cancelled) {
					setOpen(result.data);
					setOpenSource(result.source);
				}
			} catch (e) {
				setOpen(new ArrayBuffer(0));
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
		// ponytail: 仅进书/换书时开文件；不轮询 publicSource，阅读中不踢出
	}, [book?.id, book?.fmt, bookDetailReady, publicSourceRevoked, t]);

	const saveCfi = useCallback(
		(cfi: string, percent?: number, spineIndex?: number) => {
			if (!book) return;
			if (cfi.trim()) {
				currentEpubCfiRef.current = cfi;
				setReadingCfi(cfi);
			}
			if (
				spineIndex != null &&
				Number.isFinite(spineIndex) &&
				epubSpineIndexRef.current !== spineIndex
			) {
				epubSpineIndexRef.current = spineIndex;
				setEpubSpineIndex(spineIndex);
			}
			pendingEpubProgRef.current = { cfi, percent };
			if (progTimer.current) clearTimeout(progTimer.current);
			progTimer.current = setTimeout(() => {
				pendingEpubProgRef.current = null;
				ebookStore.saveProg({
					bookId: book.id,
					epubCfi: cfi,
					percent,
				});
			}, 2_000);
			if (publicThoughtSyncEnabledRef.current) {
				schedulePublicThoughtSync();
			}
			if (book.fmt === 'epub') {
				requestAnimationFrame(() => {
					const rend = epubNavRef.current?.getRendition();
					if (rend) ensureLoadedSpineThoughts(rend);
				});
			}
		},
		[book, schedulePublicThoughtSync, ensureLoadedSpineThoughts],
	);

	const activeTocIndex = useMemo(
		() =>
			findActiveTocItemIndex(
				tocItems,
				book?.fmt === 'pdf'
					? { pdfPage }
					: {
							epubSpineIndex: epubSpineIndex,
							epubCfi: readingCfi || currentEpubCfiRef.current,
							getRendition: () => epubNavRef.current?.getRendition() ?? null,
						},
			),
		[tocItems, book?.fmt, pdfPage, epubSpineIndex, readingCfi],
	);

	/** EPUB 目录/听书切章共用：go → 听书中则 restartFromChapterStart */
	const goEpubTocHref = useCallback((href: string, spineIndex?: number) => {
		const target = href.trim();
		if (!target) return;
		if (spineIndex != null && Number.isFinite(spineIndex)) {
			epubSpineIndexRef.current = spineIndex;
			setEpubSpineIndex(spineIndex);
		}
		const listen = chapterListenRef.current;
		const wasListening = listen.isActive;
		if (wasListening) {
			primeEnglishPlaybackForUserGesture();
			listen.stop({ notify: false });
		}
		void (async () => {
			let destCfi: string | undefined;
			try {
				destCfi = await epubNavRef.current?.go(target);
			} catch {
				// ignore
			}
			const rend = epubNavRef.current?.getRendition();
			const start = (
				rend as
					| { location?: { start?: { index?: number; cfi?: string } } }
					| null
					| undefined
			)?.location?.start;
			const cfi = destCfi?.trim() || start?.cfi?.trim();
			// 听书重开必须用目录目标 CFI；勿等 relocated，否则会按旧位置起播
			if (cfi) {
				currentEpubCfiRef.current = cfi;
				setReadingCfi(cfi);
			}
			if (start?.index != null && Number.isFinite(start.index)) {
				epubSpineIndexRef.current = start.index;
				setEpubSpineIndex(start.index);
			} else if (spineIndex != null && Number.isFinite(spineIndex)) {
				epubSpineIndexRef.current = spineIndex;
				setEpubSpineIndex(spineIndex);
			}
			if (wasListening) {
				chapterListenRef.current.restartFromChapterStart();
			}
		})();
	}, []);

	const listenTocIndex = chapterListen.isActive
		? findActiveTocItemIndex(tocItems, {
				epubSpineIndex: epubListenBar.spineIndex,
				epubCfi:
					chapterListen.getPlayheadCfi() ||
					readingCfi ||
					currentEpubCfiRef.current,
				getRendition: () => epubNavRef.current?.getRendition() ?? null,
			})
		: -1;

	const findListenTocNeighbor = useCallback(
		(from: number, delta: -1 | 1): EbookTocItem | null => {
			for (let i = from + delta; i >= 0 && i < tocItems.length; i += delta) {
				const href = tocItems[i]?.href?.trim();
				if (href && parsePdfPageHref(href) == null) return tocItems[i];
			}
			return null;
		},
		[tocItems],
	);

	/** 听书底栏切章：优先目录相邻项（与点目录一致）；无目录时回退 spine±1 */
	const goListenChapter = useCallback(
		(delta: -1 | 1) => {
			const listen = chapterListenRef.current;
			if (!listen.isActive) return;

			const active = findActiveTocItemIndex(tocItems, {
				epubSpineIndex: listen.spineIndex,
				// 用当前分句播头，避免阅读 CFI 滞后导致邻章算错
				epubCfi:
					listen.getPlayheadCfi() || readingCfi || currentEpubCfiRef.current,
				getRendition: () => epubNavRef.current?.getRendition() ?? null,
			});
			if (active >= 0) {
				const neighbor = findListenTocNeighbor(active, delta);
				const href = neighbor?.href?.trim();
				if (href) {
					goEpubTocHref(href, neighbor?.spineIndex);
					return;
				}
			}

			const spine = epubNavRef.current?.getBook()?.spine as
				| {
						length?: number;
						get?: (i: number) => { href?: string } | null;
				  }
				| undefined;
			const len = spine?.length ?? 0;
			const target = listen.spineIndex + delta;
			if (!spine?.get || target < 0 || target >= len) return;
			const href = spine.get(target)?.href?.trim();
			if (!href) return;
			goEpubTocHref(href, target);
		},
		[findListenTocNeighbor, goEpubTocHref, tocItems, readingCfi],
	);

	const canListenPrevChapter =
		chapterListen.isActive &&
		(listenTocIndex >= 0
			? findListenTocNeighbor(listenTocIndex, -1) != null
			: epubListenBar.spineIndex > 0);
	const canListenNextChapter =
		chapterListen.isActive &&
		(listenTocIndex >= 0
			? findListenTocNeighbor(listenTocIndex, 1) != null
			: epubNavReady &&
				epubListenBar.spineIndex >= 0 &&
				epubListenBar.spineIndex <
					((epubNavRef.current?.getBook()?.spine as { length?: number })
						?.length ?? 0) -
						1);

	const savePage = useCallback(
		(page: number, percent?: number) => {
			if (!book) return;
			pendingPdfProgRef.current = { page, percent };
			if (progTimer.current) clearTimeout(progTimer.current);
			progTimer.current = setTimeout(() => {
				pendingPdfProgRef.current = null;
				ebookStore.saveProg({
					bookId: book.id,
					pdfPage: page,
					percent,
				});
			}, 2_000);
		},
		[book],
	);

	const flushReadingProgress = useCallback(
		(opts?: { keepalive?: boolean }) => {
			if (progTimer.current) {
				clearTimeout(progTimer.current);
				progTimer.current = null;
			}
			if (book) {
				const epubPending = pendingEpubProgRef.current;
				if (epubPending) {
					pendingEpubProgRef.current = null;
					ebookStore.saveProg({
						bookId: book.id,
						epubCfi: epubPending.cfi,
						percent: epubPending.percent,
					});
				}
				const pdfPending = pendingPdfProgRef.current;
				if (pdfPending) {
					pendingPdfProgRef.current = null;
					ebookStore.saveProg({
						bookId: book.id,
						pdfPage: pdfPending.page,
						percent: pdfPending.percent,
					});
				}
				if (opts?.keepalive) {
					ebookStore.flushProgRemoteSync(book.id, { keepalive: true });
				} else {
					void ebookStore.flushProgRemoteSync(book.id);
				}
			}
		},
		[book],
	);

	useEffect(() => {
		const onPageHide = () => flushReadingProgress({ keepalive: true });
		const onVisibility = () => {
			if (document.visibilityState === 'hidden') {
				flushReadingProgress({ keepalive: true });
			}
		};
		window.addEventListener('pagehide', onPageHide);
		document.addEventListener('visibilitychange', onVisibility);
		return () => {
			window.removeEventListener('pagehide', onPageHide);
			document.removeEventListener('visibilitychange', onVisibility);
			flushReadingProgress({ keepalive: true });
		};
	}, [flushReadingProgress]);

	const onEpubReady = useCallback(
		(api: {
			prev: () => Promise<void>;
			next: () => Promise<void>;
			go: (href: string) => Promise<string | undefined>;
			clearTextSelection: () => void;
			getRendition: () => import('epubjs').Rendition | null;
			getBook: () => import('epubjs').Book | null;
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

	const closeEpubSettings = useCallback(() => {
		setEpubSettingsOpen(false);
	}, []);

	const closeReaderFloatingUi = useCallback(() => {
		closeEpubSettings();
		setListenSentenceMenuOpen(false);
		setListenRateMenuOpen(false);
	}, [closeEpubSettings]);

	/** iframe 内 mousedown 不冒泡；监听常挂载，用 ref 判断是否需要关浮层 */
	const onEpubReaderPointerDown = useCallback(() => {
		if (
			epubSettingsOpenRef.current ||
			listenSentenceMenuOpenRef.current ||
			listenRateMenuOpenRef.current
		) {
			closeReaderFloatingUi();
		}
	}, [closeReaderFloatingUi]);

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
		setAssistantOpen((wasOpen) => {
			if (wasOpen && thoughtListOpen && !thoughtListClusterRef.current) {
				setThoughtListOpen(false);
				setThoughtListCluster(null);
			}
			return !wasOpen;
		});
	}, [thoughtListOpen]);

	const openAssistantWithSelection = useCallback(
		(selectedText: string) => {
			const quote = selectedText.trim();
			if (!quote) return;
			openAssistant(t('ebook.read.assistant.askSelectionDraft', { quote }));
			setFocusInputAtEndKey((n) => n + 1);
		},
		[openAssistant, t],
	);

	const resolveQuoteShareSegments = useCallback(
		(opts?: { segments?: QuoteShareRun[]; cfiRange?: string }) => {
			if (opts?.segments?.length) return opts.segments;
			const cfiRange = opts?.cfiRange?.trim();
			if (!cfiRange) return undefined;
			const rend = epubNavRef.current?.getRendition();
			if (!rend) return undefined;
			const range = resolveCfiDomRange(rend, cfiRange);
			if (!range) return undefined;
			const win = range.startContainer.ownerDocument?.defaultView;
			if (!win) return undefined;
			const segments = extractQuoteSegmentsFromRange(range, win);
			return segments.length ? segments : undefined;
		},
		[epubNavReady],
	);

	const openQuoteShare = useCallback(
		(
			text: string,
			opts?: { segments?: QuoteShareRun[]; cfiRange?: string },
		) => {
			const quote = text.trim();
			if (!quote) return;
			setQuoteShareText(quote);
			setQuoteShareSegments(resolveQuoteShareSegments(opts));
			setQuoteShareOpen(true);
		},
		[resolveQuoteShareSegments],
	);

	const onSelectionPopBarShare = useCallback(() => {
		const payload = selectionPopBarRef.current;
		if (!payload?.selectedText.trim()) return;
		suppressEpubSelectionPopBarDismiss();
		openQuoteShare(payload.selectedText, {
			segments: payload.quoteSegments,
			cfiRange: payload.cfiRange,
		});
	}, [openQuoteShare]);

	const onSelectionPopBarCopy = useCallback(() => {
		const payload = selectionPopBarRef.current;
		if (!payload?.selectedText.trim()) return;
		suppressEpubSelectionPopBarDismiss();
		void copyToClipboard(payload.selectedText);
	}, []);

	const onSelectionPopBarListen = useCallback(() => {
		const payload = selectionPopBarRef.current;
		if (!payload?.selectedText.trim()) return;
		suppressEpubSelectionPopBarDismiss();
		void toggleListen(
			payload.selectedText,
			'popbar',
			payload.cfiRange,
			getRememberedEpubPopBarSelectionRange(),
		);
	}, [toggleListen]);

	const onSelectionPopBarAskBook = useCallback(() => {
		const payload = selectionPopBarRef.current;
		const text = payload?.selectedText ?? '';
		setSelectionPopBar(null);
		selectionPopBarRef.current = null;
		openAssistantWithSelection(text);
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
			listen: listenLabel('popbar', t('ebook.read.selectionPop.listen')),
			styleHighlight: t('ebook.read.selectionPop.styleHighlight'),
			styleUnderline: t('ebook.read.selectionPop.styleUnderline'),
			styleWavy: t('ebook.read.selectionPop.styleWavy'),
			colorPrefix: t('ebook.read.selectionPop.colorPrefix'),
			customColor: t('ebook.read.selectionPop.customColor'),
		}),
		[t, listenLabel],
	);

	const thoughtListQuoteActions = useMemo(() => {
		if (!thoughtListCluster) return null;
		const rend = epubNavRef.current?.getRendition() ?? undefined;
		const { cfiRange, quote } = getThoughtClusterHighlightSubject(
			thoughtListCluster,
			rend,
		);
		if (!quote.trim()) return null;
		const listenKey = `thought-list:${cfiRange}`;
		const spineHint = extractCfiSpineHint(cfiRange);
		const chapterHighlights = spineHint
			? highlights.filter(
					(item) => extractCfiSpineHint(item.cfiRange) === spineHint,
				)
			: highlights;
		return {
			labels: {
				...selectionPopBarLabels,
				listen: listenLabel(listenKey, t('ebook.read.selectionPop.listen')),
			},
			hasHighlight: isSelectionFullyHighlighted(
				chapterHighlights,
				cfiRange,
				quote,
				rend,
			),
			onCopy: () => void copyToClipboard(quote),
			onUnderline: () =>
				openHighlightPopBarAtBookContent(cfiRange, quote, {
					ensureHighlight: true,
				}),
			onRemoveUnderline: () => void removeHighlightForQuote(cfiRange, quote),
			onWriteThought: () => {
				if (thoughtListClusterRef.current) {
					returnToListClusterRef.current = thoughtListClusterRef.current;
				}
				setThoughtListOpen(false);
				openCreateThought(quote, cfiRange);
			},
			onAskBook: () => {
				openAssistantWithSelection(quote);
			},
			onShare: () => openQuoteShare(quote, { cfiRange }),
			onListen: () => void toggleListen(quote, listenKey, cfiRange),
		};
	}, [
		thoughtListCluster,
		highlights,
		epubNavReady,
		selectionPopBarLabels,
		openCreateThought,
		openAssistantWithSelection,
		removeHighlightForQuote,
		openHighlightPopBarAtBookContent,
		openQuoteShare,
		toggleListen,
		listenLabel,
		t,
	]);

	const thoughtDialogQuoteActions = useMemo(() => {
		const quote = thoughtDraft.quote.trim();
		if (!quote) return null;
		const cfiRange = thoughtDraft.cfiRange;
		const listenKey = `thought-dialog:${cfiRange}`;
		const rend = epubNavRef.current?.getRendition() ?? undefined;
		return {
			labels: {
				...selectionPopBarLabels,
				listen: listenLabel(listenKey, t('ebook.read.selectionPop.listen')),
			},
			hasHighlight: isSelectionFullyHighlighted(
				highlights,
				cfiRange,
				thoughtDraft.quote,
				rend,
			),
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
				openAssistantWithSelection(thoughtDraft.quote);
			},
			onShare: () =>
				openQuoteShare(thoughtDraft.quote, {
					cfiRange: thoughtDraft.cfiRange,
				}),
			onListen: () =>
				void toggleListen(thoughtDraft.quote, listenKey, thoughtDraft.cfiRange),
		};
	}, [
		thoughtDraft.quote,
		thoughtDraft.cfiRange,
		highlights,
		epubNavReady,
		thoughtDialogMode,
		thoughtDialogOpen,
		selectionPopBarLabels,
		openCreateThought,
		openAssistantWithSelection,
		removeHighlightForQuote,
		openHighlightPopBarAtBookContent,
		openQuoteShare,
		toggleListen,
		listenLabel,
		t,
	]);

	const thoughtListPanelOpen =
		thoughtListOpen &&
		thoughtListCluster != null &&
		thoughtListCluster.allThoughts.length > 0;

	const thoughtPanelOpen = thoughtDialogOpen || thoughtListPanelOpen;
	const [pinnedThoughtCfisRevision, setPinnedThoughtCfisRevision] = useState(0);

	const syncThoughtQuoteAnchorCfi = useCallback(() => {
		if (thoughtDialogOpen && thoughtDraft.cfiRange?.trim()) {
			thoughtQuoteAnchorCfiRef.current = thoughtDraft.cfiRange.trim();
			return;
		}
		if (thoughtListPanelOpen && thoughtListCluster) {
			const rend = epubNavRef.current?.getRendition() ?? undefined;
			const { cfiRange } = getThoughtClusterHighlightSubject(
				thoughtListCluster,
				rend,
			);
			if (cfiRange.trim()) {
				thoughtQuoteAnchorCfiRef.current = cfiRange.trim();
			}
		}
	}, [
		thoughtDialogOpen,
		thoughtDraft.cfiRange,
		thoughtListPanelOpen,
		thoughtListCluster,
		epubNavReady,
	]);

	const getPinnedThoughtCfis = useCallback(() => {
		const pins = new Set<string>();
		if (thoughtDialogOpen && thoughtDraft.cfiRange.trim()) {
			pins.add(thoughtDraft.cfiRange.trim());
		}
		if (thoughtListPanelOpen && thoughtListCluster) {
			const rend = epubNavRef.current?.getRendition() ?? undefined;
			const { cfiRange } = getThoughtClusterHighlightSubject(
				thoughtListCluster,
				rend,
			);
			if (cfiRange.trim()) pins.add(cfiRange.trim());
		}
		const anchor = thoughtQuoteAnchorCfiRef.current;
		if (thoughtPanelOpen && anchor?.trim()) pins.add(anchor.trim());
		return pins;
	}, [
		thoughtDialogOpen,
		thoughtDraft.cfiRange,
		thoughtListPanelOpen,
		thoughtListCluster,
		thoughtPanelOpen,
		epubNavReady,
	]);

	useEffect(() => {
		setPinnedThoughtCfisRevision((revision) => revision + 1);
	}, [thoughtPanelOpen, thoughtDraft.cfiRange, thoughtListCluster]);

	const scrollThoughtQuoteAnchorIntoView = useCallback(() => {
		const cfi = thoughtQuoteAnchorCfiRef.current;
		if (!cfi) return;
		void ensureQuoteCfiInViewport(cfi);
	}, [ensureQuoteCfiInViewport]);

	useEffect(() => {
		if (book?.fmt !== 'epub') return;
		return subscribeEbookSplitPanelResizeEnd(scrollThoughtQuoteAnchorIntoView);
	}, [book?.fmt, scrollThoughtQuoteAnchorIntoView]);

	useEffect(() => {
		if (book?.fmt !== 'epub') return;
		if (thoughtPanelOpen) syncThoughtQuoteAnchorCfi();
		let raf2 = 0;
		const raf1 = requestAnimationFrame(() => {
			raf2 = requestAnimationFrame(scrollThoughtQuoteAnchorIntoView);
		});
		return () => {
			cancelAnimationFrame(raf1);
			cancelAnimationFrame(raf2);
		};
	}, [
		book?.fmt,
		thoughtPanelOpen,
		thoughtDialogOpen,
		thoughtListPanelOpen,
		thoughtListCluster,
		thoughtDraft.cfiRange,
		syncThoughtQuoteAnchorCfi,
		scrollThoughtQuoteAnchorIntoView,
	]);

	const closeThoughtDialog = useCallback(() => {
		setThoughtDialogOpen(false);
	}, []);

	const closeThoughtList = useCallback(() => {
		returnToListClusterRef.current = null;
		setThoughtListOpen(false);
		setThoughtListCluster(null);
	}, []);

	const viewingOwnThought =
		thoughtDialogMode === 'create' ||
		!thoughtDraft.id ||
		thoughtDraft.userId === currentUserId;

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
					isPublic={thoughtDraft.isPublic !== false}
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
					onDelete={
						viewingOwnThought && thoughtDialogMode !== 'create'
							? deleteThought
							: undefined
					}
					onEdit={
						viewingOwnThought && thoughtDialogMode === 'view'
							? () => setThoughtDialogMode('edit')
							: undefined
					}
					saving={thoughtSaving}
				/>
			);
		}
		if (thoughtListPanelOpen && thoughtListCluster) {
			return (
				<EpubThoughtList
					onClose={closeThoughtList}
					cluster={thoughtListCluster}
					onOpenThoughtDetail={(thought) => openViewThought(thought, true)}
					quoteActions={thoughtListQuoteActions}
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
		thoughtDraft.userId,
		currentUserId,
		viewingOwnThought,
		thoughtListCluster,
		thoughtListPanelOpen,
		thoughtListQuoteActions,
		openHighlightPopBarAtBookContent,
		thoughtSaving,
	]);

	/** 右侧分栏开关与 state 对齐 */
	const sidePanelOpen =
		assistantOpen || thoughtDialogOpen || thoughtListPanelOpen;
	const sidePanelSlotKey = assistantOpen
		? 'assistant'
		: thoughtDialogOpen
			? 'thought-dialog'
			: 'thought-list';
	const sidePanelSlot =
		sidePanel != null ? (
			<div
				key={sidePanelSlotKey}
				className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden"
			>
				{sidePanel}
			</div>
		) : null;

	const closeContextMenu = useCallback(() => {
		contextMenuOpenRef.current = false;
		setContextMenu(null);
	}, []);

	const showReaderContextMenu = useCallback(
		(payload: { clientX: number; clientY: number; hasSelection?: boolean }) => {
			contextMenuOpenRef.current = true;
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
			showPageNav: epubSettings.pageFlow === 'paginated',
			actionsRef: contextActionsRef,
			t,
		});
	}, [
		book?.fmt,
		contextMenu?.hasSelection,
		epubSettings.pageFlow,
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

	const epubSurfaceProps = useMemo(() => {
		if (book?.fmt !== 'epub') return undefined;
		const chromeStyle = getEpubReaderChromeCssVars(
			epubSettings.bgTheme,
			epubSettings.textColor,
			appTheme,
		);
		return {
			surfaceClassName: epubReaderSurfaceBgClass,
			surfaceStyle: chromeStyle,
			chromeStyle,
		};
	}, [book?.fmt, epubSettings.bgTheme, epubSettings.textColor, appTheme]);

	if (!bookDetailReady || bookResolving) {
		return (
			<EbookPageShell>
				<div className="text-textcolor/60 flex flex-1 flex-col items-center justify-center py-12 text-center text-sm">
					<Loading text={t('common.loading')} />
				</div>
			</EbookPageShell>
		);
	}

	if (book && publicSourceRevoked) {
		return (
			<EbookPageShell>
				<div className="text-textcolor/60 flex flex-1 flex-col items-center justify-center gap-3 px-6 py-12 text-center text-sm">
					<p>{t('ebook.read.publicSourceRevoked')}</p>
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

	if (!book || open?.byteLength === 0) {
		if (bookResolving) {
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
				{canSetPublic && book ? (
					<EbookBookVisibilitySwitch
						book={book}
						canToggle={canSetPublic}
						compact
						tooltipSide="bottom"
						className={cn(
							book.isPublic
								? 'bg-theme/15 text-teal-500'
								: 'text-textcolor/80 hover:text-teal-500',
						)}
					/>
				) : null}
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
					content={
						chapterListen.isActive
							? t('ebook.read.listenBook.stop')
							: t('ebook.read.listenBook')
					}
				>
					<Button
						type="button"
						variant="ghost"
						size="icon-sm"
						className={cn(
							chapterListen.isActive
								? 'bg-theme/15 text-teal-500'
								: 'text-textcolor/80 hover:text-teal-500',
						)}
						aria-pressed={chapterListen.isActive}
						aria-label={
							chapterListen.isActive
								? t('ebook.read.listenBook.stop')
								: t('ebook.read.listenBook')
						}
						disabled={!epubNavReady}
						onClick={chapterListen.toggleChapterListen}
					>
						<Headphones className="size-4" />
					</Button>
				</Tooltip>

				{epubSettings.pageFlow === 'paginated' ? (
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
					</>
				) : null}
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
			surfaceClassName={epubSurfaceProps?.surfaceClassName}
			surfaceStyle={epubSurfaceProps?.surfaceStyle}
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
						sidePanel={sidePanelSlot}
					>
						<div
							className="relative flex h-full min-h-0 flex-1 flex-col overflow-hidden"
							onContextMenu={onHostContextMenu}
							onPointerDown={onEpubReaderPointerDown}
						>
							<div className="relative h-full min-h-0 flex-1 overflow-hidden">
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
									onReaderPointerDown={onEpubReaderPointerDown}
									onSelectionPopBar={onSelectionPopBarChange}
									thoughts={thoughts}
									annotationSpineKey={epubSpineIndex}
									getPinnedThoughtCfis={getPinnedThoughtCfis}
									pinnedThoughtCfisRevision={pinnedThoughtCfisRevision}
									highlights={highlights}
									currentUserId={currentUserId}
									onThoughtClick={openViewThought}
									onThoughtClusterClick={openThoughtCluster}
									onUserHighlightPopBar={onUserHighlightPopBar}
								/>
								<EpubListenFollowFab />
							</div>
							<EpubListenPlayerBar
								status={epubListenBar.status}
								spineIndex={epubListenBar.spineIndex}
								sentenceIndex={epubListenBar.sentenceIndex}
								sentenceCount={epubListenBar.sentenceCount}
								sentenceLabels={epubListenBar.sentenceLabels}
								rate={epubListenBar.rate}
								onTogglePlay={epubListenBar.togglePlay}
								onStop={epubListenBar.stop}
								onPrevChapter={() => goListenChapter(-1)}
								onNextChapter={() => goListenChapter(1)}
								canPrevChapter={canListenPrevChapter}
								canNextChapter={canListenNextChapter}
								onGoToSentence={epubListenBar.goToSentence}
								onRateChange={epubListenBar.setRate}
								sentenceMenuOpen={listenSentenceMenuOpen}
								onSentenceMenuOpenChange={setListenSentenceMenuOpen}
								rateMenuOpen={listenRateMenuOpen}
								onRateMenuOpenChange={setListenRateMenuOpen}
								menuChromeStyle={epubSurfaceProps?.chromeStyle}
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
				chromeStyle={
					book.fmt === 'epub' ? epubSurfaceProps?.chromeStyle : undefined
				}
				onSelect={(item) => {
					const href = item.href?.trim() ?? '';
					if (!href) return;
					const pdfPage = parsePdfPageHref(href);
					if (pdfPage != null) {
						pdfNavRef.current?.go(pdfPage);
						return;
					}
					goEpubTocHref(href, item.spineIndex);
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
					selectionHasHighlight={selectionHasHighlight}
					highlightStyle={highlightStyle}
					highlightColor={highlightColor}
					onHighlightStyleChange={onHighlightStyleChange}
					onHighlightColorChange={onHighlightColorChange}
					onCopy={onSelectionPopBarCopy}
					onApplyHighlight={onApplyHighlight}
					onRemoveHighlight={onRemoveHighlight}
					onWriteThought={onSelectionPopBarWriteThought}
					onAskBook={onSelectionPopBarAskBook}
					onShare={onSelectionPopBarShare}
					onListen={onSelectionPopBarListen}
					onClearSelection={clearEpubSelection}
					chromeStyle={epubSurfaceProps?.chromeStyle}
					readerBgTheme={epubSettings.bgTheme}
				/>
			) : null}

			{book ? (
				<EpubQuoteShareDialog
					open={quoteShareOpen}
					onOpenChange={setQuoteShareOpen}
					quote={quoteShareText}
					quoteSegments={quoteShareSegments}
					bookTitle={book.title}
					author={book.author}
					chromeStyle={epubSurfaceProps?.chromeStyle}
				/>
			) : null}
		</EbookPageShell>
	);
}

export default observer(EbookReadPage);
