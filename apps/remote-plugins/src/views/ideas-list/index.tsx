import { Button, ScrollArea } from '@ui/index';
import { useCallback, useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import '@/styles.css';

const PAGE_SIZE = 50;

type Thought = {
	id: string;
	userId: number | string;
	cfiRange: string;
	quote: string;
	content: string;
	username?: string;
	avatar?: string;
	createdAt?: string;
	updatedAt?: string;
	isPublic?: boolean;
};

type EbookModules = {
	getBookId: () => string | null;
	getBookTitle: () => string | null;
	navigateToCfi: (cfi: string) => void | Promise<void>;
	openThought: (thought: Thought) => void;
	closeIdeasList?: () => void;
};

type HostBridgeProps = {
	api: {
		t: (key: string, params?: Record<string, unknown>) => string;
		theme: 'light' | 'dark';
		navigate?: (to: string) => void;
		event: {
			on: (event: string, handler: (data?: unknown) => void) => void;
			off: (event: string, handler: (data?: unknown) => void) => void;
			emit: (event: string, data?: unknown) => void;
		};
		http?: {
			get: <T = unknown>(url: string) => Promise<T>;
			post: <T = unknown>(url: string, body?: unknown) => Promise<T>;
		};
		ui?: {
			showToast: (options: {
				message: string;
				type?: 'success' | 'error' | 'info';
			}) => void;
		};
		modules?: Readonly<Record<string, unknown>>;
	};
	plugin: { id: string; version: string; routePath: string };
};

type ThoughtPage = {
	list: Thought[];
	total: number;
	pageNo: number;
	pageSize: number;
};

function unwrapPage(res: unknown): ThoughtPage {
	const body =
		res && typeof res === 'object' && 'data' in res
			? (res as { data: unknown }).data
			: res;
	if (
		body &&
		typeof body === 'object' &&
		Array.isArray((body as ThoughtPage).list)
	) {
		const page = body as ThoughtPage;
		return {
			list: page.list,
			total: Number(page.total) || 0,
			pageNo: Number(page.pageNo) || 1,
			pageSize: Number(page.pageSize) || PAGE_SIZE,
		};
	}
	return { list: [], total: 0, pageNo: 1, pageSize: PAGE_SIZE };
}

function formatTime(iso?: string): string {
	if (!iso) return '';
	const d = new Date(iso);
	if (Number.isNaN(d.getTime())) return iso;
	return d.toLocaleString();
}

export default function IdeasListApp({ api }: HostBridgeProps) {
	const ebook = api.modules?.ebook as EbookModules | undefined;
	const bookId = ebook?.getBookId() ?? null;
	const bookTitle = ebook?.getBookTitle() ?? null;
	const [items, setItems] = useState<Thought[]>([]);
	const [pageNo, setPageNo] = useState(0);
	const [total, setTotal] = useState(0);
	const [loading, setLoading] = useState(false);
	const [loadingMore, setLoadingMore] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const viewportRef = useRef<HTMLDivElement>(null);
	const sentinelRef = useRef<HTMLDivElement>(null);
	const inflightRef = useRef(false);

	const hasMore = items.length < total;

	const fetchPage = useCallback(
		async (nextPage: number, append: boolean) => {
			if (!bookId || !api.http || inflightRef.current) return;
			inflightRef.current = true;
			if (append) setLoadingMore(true);
			else {
				setLoading(true);
				setError(null);
			}
			try {
				const res = await api.http.get(
					`/ebook/thoughts/${bookId}?pageNo=${nextPage}&pageSize=${PAGE_SIZE}&publicOnly=true`,
				);
				const page = unwrapPage(res);
				setTotal(page.total);
				setPageNo(page.pageNo);
				setItems((prev) => {
					if (!append) return page.list;
					const seen = new Set(prev.map((t) => t.id));
					const extra = page.list.filter((t) => !seen.has(t.id));
					return [...prev, ...extra];
				});
			} catch (e) {
				const message = e instanceof Error ? e.message : String(e);
				if (!append) {
					setError(message);
					setItems([]);
					setTotal(0);
					setPageNo(0);
				} else {
					api.ui?.showToast({ message, type: 'error' });
				}
			} finally {
				inflightRef.current = false;
				setLoading(false);
				setLoadingMore(false);
			}
		},
		[api.http, api.ui, bookId],
	);

	useEffect(() => {
		if (!bookId || !api.http) {
			setItems([]);
			setTotal(0);
			setPageNo(0);
			setError(bookId ? null : '未绑定当前书籍');
			return;
		}
		void fetchPage(1, false);
	}, [api.http, bookId, fetchPage]);

	useEffect(() => {
		const root = viewportRef.current;
		const target = sentinelRef.current;
		if (!root || !target || !hasMore || loading || loadingMore) return;

		const io = new IntersectionObserver(
			(entries) => {
				if (!entries[0]?.isIntersecting) return;
				void fetchPage(pageNo + 1, true);
			},
			{ root, rootMargin: '120px 0px', threshold: 0 },
		);
		io.observe(target);
		return () => io.disconnect();
	}, [fetchPage, hasMore, loading, loadingMore, pageNo, items.length]);

	const onOpen = (thought: Thought) => {
		const cfi = thought.cfiRange?.trim();
		if (cfi) void ebook?.navigateToCfi(cfi);
		ebook?.openThought(thought);
		ebook?.closeIdeasList?.();
	};

	return (
		<div
			data-plugin-root
			className="text-textcolor flex h-full min-h-0 flex-col text-sm"
		>
			{bookTitle ? (
				<div className="text-textcolor/55 border-theme-border mb-1 shrink-0 border-b px-2 pb-2.5 text-xs">
					{bookTitle}
					{total > 0 ? (
						<span className="text-textcolor/40 ml-2">共 {total} 条</span>
					) : null}
				</div>
			) : null}

			{/* 与 EbookTocDrawer 一致：ScrollArea pr-1.5，条目左右 px-2 */}
			<ScrollArea
				ref={viewportRef}
				className="box-border flex min-h-0 flex-1 flex-col pr-1.5"
			>
				{loading ? (
					<p className="text-textcolor/55 px-2 py-2">加载中…</p>
				) : error ? (
					<p className="text-destructive px-2 py-2">{error}</p>
				) : items.length === 0 ? (
					<p className="text-textcolor/55 px-2 py-4">暂无想法</p>
				) : (
					<div className="flex min-h-0 w-full flex-1 flex-col gap-1">
						{items.map((thought) => (
							<div key={thought.id}>
								<Button
									type="button"
									variant="ghost"
									onClick={() => onOpen(thought)}
									className={cn(
										'h-auto w-full flex-col items-stretch gap-0 rounded-md px-2 py-2 text-left font-normal whitespace-normal',
										'hover:bg-theme/10',
									)}
								>
									{thought.quote ? (
										<p className="text-textcolor/55 mb-1.5 line-clamp-2 text-justify text-xs">
											「{thought.quote}」
										</p>
									) : null}
									<p className="text-textcolor line-clamp-3 text-justify leading-snug">
										{thought.content || '（无正文）'}
									</p>
									<p className="text-textcolor/45 mt-1.5 text-left text-[11px]">
										{[thought.username, formatTime(thought.createdAt)]
											.filter(Boolean)
											.join(' · ')}
									</p>
								</Button>
							</div>
						))}
						<div ref={sentinelRef} className="h-1 w-full" aria-hidden />
						{loadingMore ? (
							<p className="text-textcolor/45 py-2 text-center text-xs">
								加载更多…
							</p>
						) : null}
						{!hasMore && items.length > 0 ? (
							<p className="text-textcolor/35 py-2 text-center text-xs">
								已加载全部
							</p>
						) : null}
					</div>
				)}
			</ScrollArea>
		</div>
	);
}

export async function activate() {
	// ponytail: 列表在组件 mount 时拉取
	console.log('IdeasListApp activate');
}

export async function deactivate() {
	// ponytail: 无全局副作用
	console.log('IdeasListApp deactivate');
}
