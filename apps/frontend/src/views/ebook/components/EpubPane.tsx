import type { Book, Location, Rendition } from 'epubjs';
import ePub from 'epubjs';
import { useCallback, useEffect, useRef, useState } from 'react';
import { type ThemeName, useTheme } from '@/hooks';
import { cn } from '@/lib/utils';
import { onListen } from '@/utils';
import type {
	EbookThought,
	EbookThoughtClickCluster,
	EbookTocItem,
	EbookUserHighlight,
} from '../types';
import { subscribeEbookSplitPanelResizeEnd } from '../utils/ebookSplitResize';
import {
	attachEpubIframeContextMenu,
	attachEpubIframePointerDown,
	type EpubReaderContextMenuPayload,
} from '../utils/epubContextMenuAttach';
import { relayoutListenMarkHighlight } from '../utils/epubListenMarkHighlight';
import {
	applyEpubReaderAppearance,
	type EpubReaderSettings,
	resolveEpubReaderSurfaceBackground,
} from '../utils/epubReaderSettings';
import { attachEpubScrolledEdgeNav } from '../utils/epubScrolledNav';
import {
	attachEpubSelectionPopBar,
	clearEpubTextSelection,
	type EpubSelectionPopBarPayload,
} from '../utils/epubSelectionToolbarAttach';
import { softResizeEpubRendition } from '../utils/epubSoftResize';
import { resolveSpineIndexForHref } from '../utils/epubSpineIndex';
import {
	installEpubThoughtUnderlineListeners,
	teardownAppliedThoughtUnderlines,
} from '../utils/epubThoughtAnnotations';
import {
	installEpubReadingMarkClickListeners,
	installEpubUserHighlightPatchListeners,
	patchEpubReadingAnnotations,
	resetEpubReadingAnnotationSyncState,
	syncEpubReadingAnnotations,
	teardownAppliedUserHighlights,
} from '../utils/epubUserHighlights';
import { READER_NATIVE_SCROLLBAR_EPUB_CONTAINER } from '../utils/readerScrollbar';

type NavApi = {
	prev: () => Promise<void>;
	next: () => Promise<void>;
	go: (href: string) => Promise<void>;
	clearTextSelection: () => void;
	getRendition: () => Rendition | null;
	getBook: () => Book | null;
	syncReadingAnnotations: (nextHighlights?: EbookUserHighlight[]) => void;
};

type Props = {
	open: ArrayBuffer;
	startCfi?: string;
	readerSettings: EpubReaderSettings;
	onCfi: (cfi: string, percent?: number, spineIndex?: number) => void;
	onToc?: (items: EbookTocItem[]) => void;
	onReady?: (api: NavApi) => void;
	/** EPUB 重载前通知父级清空导航 API（避免快捷键指向已销毁的 rendition） */
	onNavReset?: () => void;
	/** 目录打开等场景下禁用翻页快捷键 */
	keyboardNavEnabled?: boolean;
	/** EPUB iframe 内右键菜单 */
	onReaderContextMenu?: (payload: EpubReaderContextMenuPayload) => void;
	/** iframe 内按下时回调（如关闭阅读设置浮层） */
	onReaderPointerDown?: () => void;
	/** 选区结束后的浮动操作条 */
	onSelectionPopBar?: (payload: EpubSelectionPopBarPayload | null) => void;
	/** 读书想法（下划线标注） */
	thoughts?: EbookThought[];
	onThoughtClick?: (thought: EbookThought) => void;
	onThoughtClusterClick?: (cluster: EbookThoughtClickCluster) => void;
	onUserHighlightPopBar?: (
		payload: EpubSelectionPopBarPayload,
		highlight: EbookUserHighlight,
	) => void;
	/** 用户划线（高亮 / 下划线 / 波浪线） */
	highlights?: EbookUserHighlight[];
};

/** epub.js 全书百分比需 locations.generate；未就绪时用 spine 索引粗估 */
function resolveEpubPercent(
	book: Book | null,
	loc: Location,
	locationsReady: boolean,
): number | undefined {
	const start = loc.start;
	if (!start?.cfi) return undefined;

	const spineLen = (book?.spine as { length?: number } | undefined)?.length;
	const locLen = book?.locations?.length?.() ?? 0;

	if (
		locationsReady &&
		locLen > 1 &&
		typeof start.percentage === 'number' &&
		Number.isFinite(start.percentage)
	) {
		return Math.min(100, Math.round(start.percentage * 100));
	}

	if (locationsReady && book?.locations) {
		const fromCfi = book.locations.percentageFromCfi(start.cfi);
		if (typeof fromCfi === 'number' && Number.isFinite(fromCfi)) {
			return Math.min(100, Math.round(fromCfi * 100));
		}
	}

	if (start.index != null && typeof spineLen === 'number' && spineLen > 0) {
		return Math.min(100, Math.round((start.index / spineLen) * 100));
	}

	return undefined;
}

export function EpubPane({
	open,
	startCfi,
	readerSettings,
	onCfi,
	onToc,
	onReady,
	onNavReset,
	keyboardNavEnabled = true,
	onReaderContextMenu,
	onReaderPointerDown,
	onSelectionPopBar,
	thoughts = [],
	onThoughtClick,
	onThoughtClusterClick,
	onUserHighlightPopBar,
	highlights = [],
}: Props) {
	const { theme: appTheme } = useTheme();
	const [appThemeName, setAppThemeName] = useState<ThemeName>(appTheme);
	const readerBgColor = resolveEpubReaderSurfaceBackground(
		readerSettings.bgTheme,
	);
	const readerSettingsRef = useRef(readerSettings);
	const appThemeRef = useRef<ThemeName>(appTheme);
	const hostRef = useRef<HTMLDivElement>(null);
	const rendRef = useRef<Rendition | null>(null);
	const bookRef = useRef<Book | null>(null);
	const locationsReadyRef = useRef(false);
	const readyRef = useRef(false);
	const onCfiRef = useRef(onCfi);
	const onTocRef = useRef(onToc);
	const onReadyRef = useRef(onReady);
	const onNavResetRef = useRef(onNavReset);
	const onReaderContextMenuRef = useRef(onReaderContextMenu);
	const onReaderPointerDownRef = useRef(onReaderPointerDown);
	const onSelectionPopBarRef = useRef(onSelectionPopBar);
	const onThoughtClickRef = useRef(onThoughtClick);
	const onThoughtClusterClickRef = useRef(onThoughtClusterClick);
	const onUserHighlightPopBarRef = useRef(onUserHighlightPopBar);
	const thoughtsRef = useRef(thoughts);
	const highlightsRef = useRef(highlights);
	const appliedThoughtsRef = useRef<Map<string, string>>(new Map());
	const appliedHighlightsRef = useRef<Map<string, string>>(new Map());
	const keyboardNavEnabledRef = useRef(keyboardNavEnabled);
	const openRef = useRef<ArrayBuffer | null>(null);
	const initialCfiRef = useRef<string | undefined>(undefined);
	const currentCfiRef = useRef<string | undefined>(undefined);
	const lateStartCfiAppliedRef = useRef(false);
	const [err, setErr] = useState<string | null>(null);
	const [rendReady, setRendReady] = useState(false);

	readerSettingsRef.current = readerSettings;
	appThemeRef.current = appThemeName;

	useEffect(() => {
		setAppThemeName(appTheme);
	}, [appTheme]);

	useEffect(() => {
		let disposed = false;
		let unlisten: (() => void) | undefined;
		onListen<ThemeName>('theme', (name) => {
			if (disposed) return;
			setAppThemeName(name);
		}).then((fn) => {
			if (!disposed) unlisten = fn;
		});
		return () => {
			disposed = true;
			unlisten?.();
		};
	}, []);

	useEffect(() => {
		if (!rendRef.current) return;
		applyEpubReaderAppearance(rendRef.current, readerSettings, appThemeName);
	}, [readerSettings, appThemeName]);

	onCfiRef.current = onCfi;
	onTocRef.current = onToc;
	onReadyRef.current = onReady;
	onNavResetRef.current = onNavReset;
	onReaderContextMenuRef.current = onReaderContextMenu;
	onReaderPointerDownRef.current = onReaderPointerDown;
	onSelectionPopBarRef.current = onSelectionPopBar;
	onThoughtClickRef.current = onThoughtClick;
	onThoughtClusterClickRef.current = onThoughtClusterClick;
	onUserHighlightPopBarRef.current = onUserHighlightPopBar;
	thoughtsRef.current = thoughts;
	highlightsRef.current = highlights;
	keyboardNavEnabledRef.current = keyboardNavEnabled;

	// 仅在换书（open 变化）时记录起始 CFI，避免翻页保存进度后整书重载闪烁
	if (openRef.current !== open) {
		openRef.current = open;
		initialCfiRef.current = startCfi;
		currentCfiRef.current = startCfi;
		lateStartCfiAppliedRef.current = false;
	}

	const relocate = useCallback((loc: Location) => {
		const cfi = loc.start?.cfi;
		if (!cfi) return;
		currentCfiRef.current = cfi;
		const pct = resolveEpubPercent(
			bookRef.current,
			loc,
			locationsReadyRef.current,
		);
		onCfiRef.current(cfi, pct, loc.start?.index);
	}, []);

	const onRenditionKeyDown = useCallback((e: KeyboardEvent) => {
		if (!keyboardNavEnabledRef.current || e.repeat) return;
		const isPrev = e.key === 'ArrowUp' || e.key === 'ArrowLeft';
		const isNext = e.key === 'ArrowDown' || e.key === 'ArrowRight';
		if (!isPrev && !isNext) return;
		if (!readyRef.current || !rendRef.current) return;
		e.preventDefault();
		if (isPrev) void rendRef.current.prev();
		else void rendRef.current.next();
	}, []);

	// 书架进度晚于首屏加载时，补一次跳转（不重载整书）
	useEffect(() => {
		if (!startCfi || lateStartCfiAppliedRef.current) return;
		if (initialCfiRef.current) {
			lateStartCfiAppliedRef.current = true;
			return;
		}
		if (!readyRef.current || !rendRef.current) return;
		lateStartCfiAppliedRef.current = true;
		initialCfiRef.current = startCfi;
		void rendRef.current.display(startCfi);
	}, [startCfi]);

	useEffect(() => {
		const rend = rendRef.current;
		if (!rend || !rendReady) return;

		return installEpubThoughtUnderlineListeners(rend, {
			getThoughts: () => thoughtsRef.current ?? [],
			onThoughtClick: (thought) => onThoughtClickRef.current?.(thought),
			onThoughtClusterClick: (cluster) =>
				onThoughtClusterClickRef.current?.(cluster),
		});
	}, [rendReady]);

	useEffect(() => {
		const rend = rendRef.current;
		if (!rend || !rendReady) return;

		return installEpubReadingMarkClickListeners(rend, {
			getThoughts: () => thoughtsRef.current ?? [],
			getHighlights: () => highlightsRef.current ?? [],
			onThoughtClusterClick: (cluster) =>
				onThoughtClusterClickRef.current?.(cluster),
			onUserHighlightPopBar: (payload, highlight) =>
				onUserHighlightPopBarRef.current?.(payload, highlight),
		});
	}, [rendReady]);

	useEffect(() => {
		const rend = rendRef.current;
		if (!rend || !rendReady) return;

		return installEpubUserHighlightPatchListeners(rend);
	}, [rendReady]);

	useEffect(() => {
		const rend = rendRef.current;
		if (!rend || !rendReady || !onReaderPointerDown) return;

		return attachEpubIframePointerDown(rend, () => {
			onReaderPointerDownRef.current?.();
		});
	}, [rendReady, onReaderPointerDown]);

	useEffect(() => {
		const rend = rendRef.current;
		if (!rend || !rendReady) return;

		syncEpubReadingAnnotations(
			rend,
			thoughts ?? [],
			highlights ?? [],
			appliedThoughtsRef.current,
			appliedHighlightsRef.current,
		);
	}, [thoughts, highlights, rendReady]);

	// EPUB 渲染器主生命周期副作用
	useEffect(() => {
		const el = hostRef.current; // 获取渲染节点
		if (!el) return; // DOM 节点未挂载时直接返回

		let destroyed = false; // 标记该 Effect 是否已被清理，以避免异步流程完成时“已读已写”崩溃
		let book: Book | null = null; // epub.js Book 实例
		let rend: Rendition | null = null; // epub.js Rendition 实例
		let detachScrolledNav: (() => void) | undefined; // 连续滚动模式下的纵向边缘导航事件解绑方法
		let detachContextMenu: (() => void) | undefined; // contextmenu 事件解绑
		let detachSelectionPopBar: (() => void) | undefined; // 选区浮条事件解绑

		// 清空所有关联状态，准备重新加载
		onNavResetRef.current?.();
		readyRef.current = false;
		setRendReady(false);
		appliedThoughtsRef.current.clear(); // 清除已应用的思考（下划线等）
		appliedHighlightsRef.current.clear(); // 清除已应用的高亮
		resetEpubReadingAnnotationSyncState(); // 清除同步状态
		locationsReadyRef.current = false;
		bookRef.current = null;
		rendRef.current = null;
		setErr(null); // 清除上一轮错误提示

		// 计算初始 CFI（定位阅读位置）
		const initialCfi =
			currentCfiRef.current ?? initialCfiRef.current ?? undefined;
		const pageFlow = readerSettingsRef.current.pageFlow; // 获取当前排版模式（分页、连续滚动等）

		// 上报当前位置到外部，例如用于更新“百分比”显示等
		const reportCurrentLocation = async () => {
			if (!rend || destroyed) return;
			try {
				const loc = (await Promise.resolve(
					rend.currentLocation(),
				)) as unknown as Location | undefined;
				if (loc?.start?.cfi) relocate(loc); // 通知父层 location 变更
			} catch {
				// 忽略异常
			}
		};

		// 以下为异步立即执行函数，负责初始化 epub.js
		(async () => {
			try {
				// 1. 实例化书籍对象，读取并解析二进制 EPUB
				book = ePub(open, {
					openAs: 'binary',
					replacements: 'blobUrl', // 图片用 blob 方案提升兼容性
				});
				bookRef.current = book;
				await book.opened; // 等待书籍完全打开
				if (destroyed || !book) return; // 清理后提前退

				// 2. 计算渲染区域尺寸，为 epub.js 创建合适的视口
				const w = Math.max(el.clientWidth, 320) || 640;
				const h = Math.max(el.clientHeight, 320) || 480;

				// 3. 创建渲染器，并配置模式参数
				rend = book.renderTo(el, {
					width: w,
					height: h,
					flow: pageFlow, // 'paginated'、'scrolled'
					manager: pageFlow === 'scrolled' ? 'continuous' : 'default', // 连续滚动用 continuous
					spread: 'none', // 不做双页分栏
					allowScriptedContent: true, // 允许内容内 JS，便于交互
				});
				// 4. 应用主题与外观（夜间模式、字号等）
				applyEpubReaderAppearance(
					rend,
					readerSettingsRef.current,
					appThemeRef.current,
				);
				// 绑定到 ref，便于后续副作用访问
				rendRef.current = rend;

				// 5. 绑定翻页、键盘等常规事件
				rend.on('relocated', relocate);
				rend.on('keydown', onRenditionKeyDown);

				// 6. 条件绑定 contextmenu 和选区浮条事件
				if (onReaderContextMenuRef.current) {
					detachContextMenu = attachEpubIframeContextMenu(rend, (payload) => {
						onReaderContextMenuRef.current?.(payload);
					});
				}
				detachSelectionPopBar = attachEpubSelectionPopBar(rend, (payload) => {
					onSelectionPopBarRef.current?.(payload);
				});

				// 7. 初始定位到指定 CFI（阅读进度或跳转）
				await rend.display(initialCfi ?? undefined);
				if (destroyed) return;
				if (initialCfi) lateStartCfiAppliedRef.current = true;

				// 8. 等待书籍内容全量解析
				await book.ready;
				if (destroyed) return;

				// 9. 标记渲染器可用，允许加载批注等后续逻辑
				readyRef.current = true;
				setRendReady(true);

				// 10. 连续滚动模式下，启用边缘跳章
				if (pageFlow === 'scrolled') {
					detachScrolledNav = attachEpubScrolledEdgeNav(rend, () => destroyed);
				}

				// 11. 通知外部 EPUB 已经 ready（支持翻页、跳转等操作）
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
					clearTextSelection: () => {
						if (!rendRef.current) return;
						clearEpubTextSelection(rendRef.current);
					},
					getRendition: () => rendRef.current,
					getBook: () => bookRef.current,
					syncReadingAnnotations: (nextHighlights) => {
						const r = rendRef.current;
						if (!r) return;
						syncEpubReadingAnnotations(
							r,
							thoughtsRef.current ?? [],
							nextHighlights ?? highlightsRef.current ?? [],
							appliedThoughtsRef.current,
							appliedHighlightsRef.current,
						);
					},
				});

				// 12. 读取目录导航信息，回调传递数据给父层
				const nav = await book.loaded.navigation;
				const spineBook = book;
				const toc: EbookTocItem[] = (nav.toc ?? []).map((t) => ({
					label: t.label?.trim() || t.href, // 目录名默认去空格，否则用链接
					href: t.href,
					spineIndex: t.href
						? resolveSpineIndexForHref(spineBook, t.href)
						: undefined,
				}));
				if (!destroyed) onTocRef.current?.(toc);

				// 13. 启动后台分页索引生成，生成成功则刷新全书百分比进度
				void book.locations
					.generate(1600) // 建议分块点数，1600 为常用默认
					.then(() => {
						if (destroyed) return;
						locationsReadyRef.current = true;
						return reportCurrentLocation();
					})
					.catch(() => {
						// 部分 EPUB 生成失败时仍依赖 spine 索引回退
					});
			} catch (e) {
				// 任何异常都上报为错误提示（避免应用崩溃）
				if (!destroyed) {
					setErr(e instanceof Error ? e.message : 'EPUB 打开失败');
				}
			}
		})();

		// ============================ 页面尺寸自适应机制 ============================
		let resizeRaf: number | null = null; // 防抖计时器

		// 实际尺寸应用及高亮样式恢复
		const applyHostResize = () => {
			// 节点未就绪或渲染器尚未 Ready 时直接忽略
			if (!hostRef.current || !readyRef.current || !rendRef.current) return;
			const w = Math.max(hostRef.current.clientWidth, 320);
			const h = Math.max(hostRef.current.clientHeight, 320);
			const rend = rendRef.current;
			// 优先使用 softResize 尝试温和调整（部分内容重排避免闪屏）
			if (!softResizeEpubRendition(rend, w, h)) {
				try {
					rend.resize(w, h); // 兜底：完整 resize
				} catch {
					// 忽略 resize 闪断异常
				}
			}
			// soft resize 可能令高亮失色/划线消失，需立即恢复批注样式
			patchEpubReadingAnnotations(rend, { sync: true });
			relayoutListenMarkHighlight(rend);
		};

		// 封装动画帧防抖批量 resize
		const scheduleHostResize = () => {
			if (resizeRaf != null) cancelAnimationFrame(resizeRaf);
			resizeRaf = requestAnimationFrame(() => {
				resizeRaf = null;
				applyHostResize();
			});
		};

		// 手动触发 resize 并强制同步批注渲染
		const settleHostResize = () => {
			applyHostResize();
			const rend = rendRef.current;
			if (!rend || !readyRef.current) return;
			syncEpubReadingAnnotations(
				rend,
				thoughtsRef.current ?? [],
				highlightsRef.current ?? [],
				appliedThoughtsRef.current,
				appliedHighlightsRef.current,
			);
		};

		// 14. 监听容器变化（如分栏、拖动等），自动刷新排版
		const ro = new ResizeObserver(() => {
			scheduleHostResize();
		});
		ro.observe(el); // 监听 EPUB 容器 div 异步变化

		const unsubSplitResizeEnd =
			subscribeEbookSplitPanelResizeEnd(settleHostResize); // 参与 SplitPanel 拖动事件

		// ============================ 清理函数（副作用回收） ============================
		return () => {
			// 停止尺寸动画帧
			if (resizeRaf != null) cancelAnimationFrame(resizeRaf);
			unsubSplitResizeEnd();
			destroyed = true; // 标记 Effect 结束，后续异步流程可以短路

			// 卸载各种外部事件
			detachContextMenu?.();
			detachSelectionPopBar?.();
			detachScrolledNav?.();

			// 清理所有外部状态、批注等
			readyRef.current = false;
			setRendReady(false);
			appliedThoughtsRef.current.clear();
			appliedHighlightsRef.current.clear();
			resetEpubReadingAnnotationSyncState();
			locationsReadyRef.current = false;
			bookRef.current = null;
			ro.disconnect(); // 解绑 ResizeObserver

			// 尝试销毁 epub.js 实例及批注残留
			try {
				if (rend) {
					teardownAppliedThoughtUnderlines(rend, appliedThoughtsRef.current); // 清除批注下划线
					teardownAppliedUserHighlights(rend, appliedHighlightsRef.current); // 清除用户高亮
					rend.off('relocated', relocate);
					rend.off('keydown', onRenditionKeyDown);
					rend.destroy();
				}
				if (book) book.destroy();
			} catch {
				// 忽略销毁时报错
			}
			rendRef.current = null;
		};
		// 依赖项包含 open（文件内容）、排版模式、翻页监听、键盘监听等
	}, [open, readerSettings.pageFlow, relocate, onRenditionKeyDown]);

	return (
		<div className="relative h-full min-h-0 w-full">
			{err ? <p className="text-destructive p-4 text-sm">{err}</p> : null}
			<div
				ref={hostRef}
				className={cn(
					'h-full min-h-0 w-full overflow-hidden ring-1 ring-theme/10',
					readerSettings.pageFlow === 'paginated' && 'min-h-[320px]',
					// 连续滚动：美化 epub.js 内部 .epub-container 原生滚动条
					readerSettings.pageFlow === 'scrolled' &&
						READER_NATIVE_SCROLLBAR_EPUB_CONTAINER,
				)}
				style={{ backgroundColor: readerBgColor }}
			/>
		</div>
	);
}
