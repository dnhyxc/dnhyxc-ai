import type { Book, Location, Rendition } from 'epubjs';
import ePub from 'epubjs';
import { useCallback, useEffect, useRef, useState } from 'react';
import { type ThemeName, useTheme } from '@/hooks';
import { cn } from '@/lib/utils';
import { onListen } from '@/utils';
import type { EpubToc } from '../types';
import {
	applyEpubReaderAppearance,
	type EpubReaderSettings,
	epubReaderHostBgClass,
} from '../utils/epubReaderSettings';
import { attachEpubScrolledEdgeNav } from '../utils/epubScrolledNav';

type NavApi = {
	prev: () => Promise<void>;
	next: () => Promise<void>;
	go: (href: string) => Promise<void>;
};

type Props = {
	open: ArrayBuffer;
	startCfi?: string;
	readerSettings: EpubReaderSettings;
	onCfi: (cfi: string, percent?: number) => void;
	onToc?: (items: EpubToc[]) => void;
	onReady?: (api: NavApi) => void;
	/** EPUB 重载前通知父级清空导航 API（避免快捷键指向已销毁的 rendition） */
	onNavReset?: () => void;
	/** 目录打开等场景下禁用翻页快捷键 */
	keyboardNavEnabled?: boolean;
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
}: Props) {
	const { theme: appTheme } = useTheme();
	const [appThemeName, setAppThemeName] = useState<ThemeName>(appTheme);
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
	const keyboardNavEnabledRef = useRef(keyboardNavEnabled);
	const openRef = useRef<ArrayBuffer | null>(null);
	const initialCfiRef = useRef<string | undefined>(undefined);
	const currentCfiRef = useRef<string | undefined>(undefined);
	const lateStartCfiAppliedRef = useRef(false);
	const [err, setErr] = useState<string | null>(null);

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
		onCfiRef.current(cfi, pct);
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
		const el = hostRef.current;
		if (!el) return;

		let destroyed = false;
		let book: Book | null = null;
		let rend: Rendition | null = null;
		let detachScrolledNav: (() => void) | undefined;
		onNavResetRef.current?.();
		readyRef.current = false;
		locationsReadyRef.current = false;
		bookRef.current = null;
		rendRef.current = null;
		setErr(null);

		const initialCfi =
			currentCfiRef.current ?? initialCfiRef.current ?? undefined;
		const pageFlow = readerSettingsRef.current.pageFlow;

		const reportCurrentLocation = async () => {
			if (!rend || destroyed) return;
			try {
				const loc = (await Promise.resolve(
					rend.currentLocation(),
				)) as unknown as Location | undefined;
				if (loc?.start?.cfi) relocate(loc);
			} catch {
				// ignore
			}
		};

		(async () => {
			try {
				book = ePub(open, {
					openAs: 'binary',
					replacements: 'blobUrl',
				});
				bookRef.current = book;
				await book.opened;
				if (destroyed || !book) return;

				const w = Math.max(el.clientWidth, 320) || 640;
				const h = Math.max(el.clientHeight, 320) || 480;

				rend = book.renderTo(el, {
					width: w,
					height: h,
					flow: pageFlow,
					manager: pageFlow === 'scrolled' ? 'continuous' : 'default',
					spread: 'none',
					allowScriptedContent: true,
				});
				applyEpubReaderAppearance(
					rend,
					readerSettingsRef.current,
					appThemeRef.current,
				);
				rendRef.current = rend;
				rend.on('relocated', relocate);
				rend.on('keydown', onRenditionKeyDown);

				await rend.display(initialCfi ?? undefined);
				if (destroyed) return;
				if (initialCfi) lateStartCfiAppliedRef.current = true;

				await book.ready;
				if (destroyed) return;

				readyRef.current = true;

				if (pageFlow === 'scrolled') {
					detachScrolledNav = attachEpubScrolledEdgeNav(rend, () => destroyed);
				}

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

				// 后台生成 locations，完成后刷新全书百分比
				void book.locations
					.generate(1600)
					.then(() => {
						if (destroyed) return;
						locationsReadyRef.current = true;
						return reportCurrentLocation();
					})
					.catch(() => {
						// 部分 EPUB 生成失败时仍依赖 spine 索引回退
					});
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
			detachScrolledNav?.();
			readyRef.current = false;
			locationsReadyRef.current = false;
			bookRef.current = null;
			ro.disconnect();
			try {
				if (rend) {
					rend.off('relocated', relocate);
					rend.off('keydown', onRenditionKeyDown);
					rend.destroy();
				}
				if (book) book.destroy();
			} catch {
				// ignore
			}
			rendRef.current = null;
		};
	}, [open, readerSettings.pageFlow, relocate, onRenditionKeyDown]);

	return (
		<div className="relative h-full min-h-0 w-full bg-theme/5">
			{err ? <p className="text-destructive p-4 text-sm">{err}</p> : null}
			<div
				ref={hostRef}
				className={cn(
					'h-full min-h-0 w-full overflow-hidden rounded-b-md ring-1 ring-theme/10',
					readerSettings.pageFlow === 'paginated' && 'min-h-[320px]',
					epubReaderHostBgClass(readerSettings.bgTheme),
					// 连续滚动：美化 epub.js 内部 .epub-container 原生滚动条
					readerSettings.pageFlow === 'scrolled' && [
						'[&_.epub-container]:[scrollbar-width:thin]',
						'[&_.epub-container]:[scrollbar-color:color-mix(in_oklch,var(--theme-border)_60%,transparent)_transparent]',
						'[&_.epub-container::-webkit-scrollbar]:w-2',
						'[&_.epub-container::-webkit-scrollbar-track]:bg-transparent',
						'[&_.epub-container::-webkit-scrollbar-thumb]:rounded-full',
						'[&_.epub-container::-webkit-scrollbar-thumb]:bg-theme-border/60',
						'hover:[&_.epub-container::-webkit-scrollbar-thumb]:bg-theme-border',
					],
				)}
			/>
		</div>
	);
}
