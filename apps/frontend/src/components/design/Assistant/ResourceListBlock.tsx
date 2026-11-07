import { Button, Input, ScrollArea, Spinner, Toast } from '@ui/index';
import { Search, Square, Volume2 } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { Virtuoso } from 'react-virtuoso';
import { useI18n } from '@/hooks';
import { cn } from '@/lib/utils';
import {
	getElArtifact,
	listEnglishClassicQuotesLibraryItems,
	listEnglishVocabularyLibraryItems,
} from '@/service';
import type { ElResourceBlock } from '@/types/chat';
import { playPreferred, stopAllPlayback } from '@/utils/speech';

const PAGE = 1000;

function isLiveLibrary(block: ElResourceBlock): boolean {
	// 筛选卡的行在 items 里。再按库 id 拉，会把整库尾部画出来，角标却仍是分类条数
	if (block.filtered) return false;
	const libraryKind =
		block.contentKind === 'vocab' || block.contentKind === 'classic';
	return block.source === 'library' && Boolean(block.libraryId) && libraryKind;
}

/** 条数单独显示，标题里的「全部 66 条 / 已列出」去掉。 */
function shownTitle(title: string): string {
	return title
		.replace(/（已列出\s*\d+\s*\/\s*\d+）/g, '')
		.replace(/（(?:全部|共|前)\s*\d+[^）]*）/g, '')
		.replace(/（未穷尽[^）]*）/g, '')
		.replace(/\s{2,}/g, ' ')
		.trim();
}

/** 与 spill placeCardHint 同一条：整库卡已经是全量，去掉裁剪条数。 */
export function calmFullLibraryCopy(text: string): string {
	return text
		.replace(/，?\s*本次列出\s*\d+\s*条（[^）]*）/g, '')
		.replace(/（已列出\s*\d+\s*\/\s*\d+）/g, '')
		.replace(/（未穷尽，已达硬顶）/g, '');
}

/** 只朗读词面或英文句子，库名、标题、笔记正文不播。 */
function speakOf(
	item: unknown,
	source?: ElResourceBlock['source'],
): { text: string; sentence: boolean } | null {
	if (source === 'notes') return null;
	if (!item || typeof item !== 'object') return null;
	const o = item as Record<string, unknown>;
	const text = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
	const word = text(o.word);
	if (word) return { text: word, sentence: false };
	const english = text(o.english);
	if (english) return { text: english, sentence: true };
	return null;
}

function rowOf(
	item: unknown,
	source?: ElResourceBlock['source'],
): {
	en: string;
	zh?: string;
	ipa?: string;
	pos?: string;
} {
	if (!item || typeof item !== 'object') {
		return { en: String(item ?? '') };
	}
	const o = item as Record<string, unknown>;
	const text = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
	// 笔记卡只亮标题；english 是去标签正文，不能当行文案或副标题
	if (source === 'notes') {
		return { en: text(o.titleZh) || text(o.title) || text(o.lead) };
	}
	const en =
		text(o.english) ||
		text(o.word) ||
		text(o.title) ||
		text(o.titleEn) ||
		text(o.topic) ||
		text(o.text) ||
		JSON.stringify(o).slice(0, 180);
	const zh =
		text(o.translationZh) || text(o.zh) || text(o.meaning) || text(o.titleZh);
	const ipa = text(o.ipa);
	const pos = text(o.pos);
	return zh ? { en, zh, ipa, pos } : { en, ipa, pos };
}

/** 日推行 → 阅读详情；笔记行 → 笔记页；词句生成历史行 → stream 页。词条行本身不跳。 */
function hrefOf(block: ElResourceBlock, item: unknown): string | null {
	if (!item || typeof item !== 'object') return null;
	const o = item as Record<string, unknown>;
	const text = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
	const id = text(o.id);
	if (!id) return null;
	if (block.source === 'reading') {
		const params = new URLSearchParams();
		const title = text(o.titleEn);
		if (title) params.set('title', title);
		if (text(o.origin) === 'manual') params.set('origin', 'manual');
		const q = params.toString();
		return `/english-learning/daily-reading/${encodeURIComponent(id)}${q ? `?${q}` : ''}`;
	}
	if (block.source === 'notes') {
		return `/english-learning/notes?noteId=${encodeURIComponent(id)}`;
	}
	if (block.source === 'pack') {
		const topic = text(o.topic);
		if (!topic || text(o.word) || text(o.english)) return null;
		const kind = block.contentKind === 'classic' ? 'classic' : 'vocab';
		return `/english-learning/stream?kind=${kind}&streamId=${encodeURIComponent(id)}`;
	}
	return null;
}

function ListRow({
	index,
	item,
	source,
	last,
	playingKey,
	onPlay,
	onOpen,
	playWordLabel,
	playQuoteLabel,
	stopLabel,
}: {
	index: number;
	item: unknown;
	source?: ElResourceBlock['source'];
	last: boolean;
	playingKey: string | null;
	onPlay: (text: string) => void;
	onOpen?: () => void;
	playWordLabel: string;
	playQuoteLabel: string;
	stopLabel: string;
}) {
	const row = rowOf(item, source);
	const speak = speakOf(item, source);
	const playing = speak != null && playingKey === speak.text;
	return (
		<div
			className={cn(
				'flex items-center gap-3 px-2 py-1.5',
				!last && 'border-b border-theme/10',
				onOpen &&
					'cursor-pointer hover:bg-theme/10 focus-visible:bg-theme/10 focus-visible:outline-none',
			)}
			role={onOpen ? 'button' : undefined}
			tabIndex={onOpen ? 0 : undefined}
			onClick={onOpen}
			onKeyDown={
				onOpen
					? (e) => {
							if (e.key === 'Enter' || e.key === ' ') {
								e.preventDefault();
								onOpen();
							}
						}
					: undefined
			}
		>
			<span className="w-12 shrink-0 text-textcolor/40">{index + 1}</span>
			<span className="min-w-0 flex-1">
				<span className="block">
					{row.en}
					{row.ipa
						? ` ·${row.ipa.startsWith('/') ? row.ipa : `/${row.ipa}/`}`
						: ''}
					{row.pos ? ` ·${row.pos}` : ''}
				</span>
				{row.zh ? (
					<span className="block text-textcolor/60">{row.zh}</span>
				) : null}
			</span>
			{speak ? (
				<Button
					type="button"
					variant="ghost"
					size="sm"
					className={cn(
						'size-6 shrink-0 rounded-md p-0 shadow-none',
						'focus-visible:border-transparent focus-visible:ring-0',
						playing ? 'text-teal-500' : 'text-textcolor/55 hover:text-teal-400',
					)}
					aria-label={
						playing
							? stopLabel
							: speak.sentence
								? playQuoteLabel
								: playWordLabel
					}
					onClick={(e) => {
						e.stopPropagation();
						onPlay(speak.text);
					}}
				>
					{playing ? (
						<Square className="size-3.5 fill-current" aria-hidden />
					) : (
						<Volume2 className="size-3.5" aria-hidden />
					)}
				</Button>
			) : null}
		</div>
	);
}

/** 英语 Agent 大列表：整库按 libraryId 分页，子集仍用块内行 */
export function ResourceListBlock({
	block,
	hasAbove = false,
	hasBelow = false,
	snapshot = false,
}: {
	block: ElResourceBlock;
	/** 卡片上方还有正文或另一张卡 */
	hasAbove?: boolean;
	/** 卡片下方还有正文或另一张卡 */
	hasBelow?: boolean;
	/** 分享页：用块内行，不再请求需登录的词库或 artifact */
	snapshot?: boolean;
}) {
	const { t } = useI18n();
	const navigate = useNavigate();
	const live = isLiveLibrary(block);
	const fetchLive = live && !snapshot;
	const title = shownTitle(block.title);
	const [playing, setPlaying] = useState<string | null>(null);
	const [items, setItems] = useState<unknown[] | null>(
		fetchLive ? null : (block.items ?? null),
	);
	const [phase, setPhase] = useState<'ready' | 'loading' | 'expired'>(() => {
		if (fetchLive) return 'loading';
		if (block.items) return 'ready';
		return snapshot ? 'expired' : 'loading';
	});
	const [filled, setFilled] = useState(!fetchLive);
	const [reload, setReload] = useState(0);
	const [q, setQ] = useState('');
	const [scrollParent, setScrollParent] = useState<HTMLDivElement | null>(null);

	useEffect(() => {
		if (fetchLive) return;
		if (block.items) {
			setItems(block.items);
			setPhase('ready');
			return;
		}
		if (snapshot) {
			setPhase('expired');
			return;
		}
		let cancelled = false;
		setPhase('loading');
		void getElArtifact(block.artifactId)
			.then((res) => {
				if (cancelled) return;
				if (!res.success || !res.data?.items) {
					setPhase('expired');
					return;
				}
				setItems(res.data.items);
				setPhase('ready');
			})
			.catch(() => {
				if (!cancelled) setPhase('expired');
			});
		return () => {
			cancelled = true;
		};
	}, [fetchLive, snapshot, block.artifactId, block.items]);

	useEffect(() => {
		if (!fetchLive || !block.libraryId) return;
		const libraryId = block.libraryId;
		const kind = block.contentKind;
		let cancelled = false;
		setPhase('loading');
		setItems([]);
		setFilled(false);
		void (async () => {
			const acc: unknown[] = [];
			let offset = 0;
			try {
				while (!cancelled) {
					const res =
						kind === 'classic'
							? await listEnglishClassicQuotesLibraryItems(libraryId, {
									limit: PAGE,
									offset,
									silent: true,
								})
							: await listEnglishVocabularyLibraryItems(libraryId, {
									limit: PAGE,
									offset,
									silent: true,
								});
					if (cancelled) return;
					const page = res.data?.items;
					if (!res.success || !page) {
						setPhase('expired');
						return;
					}
					acc.push(...page);
					offset += page.length;
					setItems([...acc]);
					setPhase('ready');
					const done =
						page.length === 0 ||
						page.length < PAGE ||
						(block.totalCount > 0 && acc.length >= block.totalCount);
					if (done) {
						setFilled(true);
						break;
					}
				}
			} catch {
				if (!cancelled) setPhase('expired');
			}
		})();
		return () => {
			cancelled = true;
		};
	}, [fetchLive, block.libraryId, block.contentKind, block.totalCount, reload]);

	const onPlay = useCallback(
		(text: string) => {
			if (playing === text) {
				stopAllPlayback();
				setPlaying(null);
				return;
			}
			stopAllPlayback();
			setPlaying(text);
			void playPreferred(text)
				.catch(() => {
					setPlaying((current) => {
						if (current !== text) return current;
						Toast({ type: 'warning', title: t('assistant.tts.unsupported') });
						return null;
					});
				})
				.finally(() => {
					setPlaying((current) => (current === text ? null : current));
				});
		},
		[playing, t],
	);

	const openItem = useCallback(
		(item: unknown) => {
			const href = hrefOf(block, item);
			if (!href) return;
			if (block.source === 'notes' && item && typeof item === 'object') {
				const id =
					typeof (item as { id?: unknown }).id === 'string'
						? (item as { id: string }).id.trim()
						: '';
				// 插件挂载时 consumeInitialNoteId → openEditById
				if (id) {
					try {
						sessionStorage.setItem('dnhyxc_ln_popout_note_id', id);
					} catch {
						/* ignore */
					}
				}
			}
			navigate(href);
		},
		[block, navigate],
	);

	const filtered = useMemo(() => {
		const rows = items ?? [];
		const needle = q.trim().toLowerCase();
		if (!needle) return rows;
		return rows.filter((item) => {
			const row = rowOf(item, block.source);
			return (
				row.en.toLowerCase().includes(needle) ||
				(row.zh ?? '').toLowerCase().includes(needle)
			);
		});
	}, [items, q, block.source]);

	return (
		<div
			className={cn(
				'w-full overflow-hidden rounded-md border border-theme/15 bg-theme/5 text-sm text-textcolor',
				hasAbove && 'mt-4',
				hasBelow && 'mb-4',
			)}
		>
			<div className="flex items-center gap-3 border-b border-theme/10 px-2 pt-2 pb-2">
				<div className="flex min-w-0 flex-1 items-baseline gap-2">
					<span className="truncate text-base font-medium">{title}</span>
					<span className="shrink-0 text-xs tabular-nums text-textcolor/45">
						{q.trim()
							? `${filtered.length} / ${block.totalCount}`
							: block.totalCount}{' '}
						条{!live && block.truncated ? '（未穷尽）' : ''}
					</span>
				</div>
				<div className="relative w-44 shrink-0">
					<Search
						className="pointer-events-none absolute top-1/2 left-2 size-3.5 -translate-y-1/2 text-textcolor/40"
						aria-hidden
					/>
					<Input
						value={q}
						placeholder="过滤"
						aria-label="过滤"
						className="h-7 border-theme/15! bg-transparent pl-7 text-sm shadow-none focus-visible:border-theme/30 focus-visible:ring-1 focus-visible:ring-theme/20"
						onChange={(e) => setQ(e.target.value)}
					/>
				</div>
			</div>
			{phase === 'loading' ? (
				<div className="flex items-center justify-center gap-2 px-2 py-4 text-textcolor/60">
					<Spinner className="size-4 text-textcolor/60" />
					加载清单
				</div>
			) : null}
			{phase === 'expired' ? (
				<div className="flex items-center gap-2 px-2 py-3 text-textcolor/70">
					<span>{live ? '库不可用。' : '清单已过期。'}</span>
					{snapshot ? null : (
						<Button
							type="button"
							size="sm"
							variant="outline"
							onClick={() => {
								if (live) {
									setReload((n) => n + 1);
									return;
								}
								setPhase('loading');
								void getElArtifact(block.artifactId)
									.then((res) => {
										if (!res.success || !res.data?.items) {
											setPhase('expired');
											return;
										}
										setItems(res.data.items);
										setPhase('ready');
									})
									.catch(() => setPhase('expired'));
							}}
						>
							重新获取
						</Button>
					)}
				</div>
			) : null}
			{phase === 'ready' && live ? (
				filtered.length === 0 ? (
					<div className="px-2 py-3 text-textcolor/60">没有匹配的条目</div>
				) : (
					<>
						<ScrollArea
							ref={setScrollParent}
							className="h-79"
							viewportClassName="h-full [overflow-anchor:none] [&>div]:block! [&>div]:h-auto! [&>div]:min-h-0! [&>div]:w-full!"
							scrollbarClassName="border-0 p-0"
						>
							{scrollParent ? (
								// ponytail: 滚动条用 ScrollArea；Virtuoso 仍只画可见行。整库到几千条时再换窗口化会卡。
								<Virtuoso
									customScrollParent={scrollParent}
									data={filtered}
									itemContent={(i, item) => (
										<ListRow
											index={i}
											item={item}
											source={block.source}
											last={i === filtered.length - 1}
											playingKey={playing}
											onPlay={onPlay}
											onOpen={
												hrefOf(block, item) ? () => openItem(item) : undefined
											}
											playWordLabel={t('englishLearning.vocab.playWord')}
											playQuoteLabel={t('englishLearning.classic.playQuote')}
											stopLabel={t('englishLearning.tts.stop')}
										/>
									)}
								/>
							) : null}
						</ScrollArea>
						{filled ? null : (
							<div className="flex items-center gap-2 px-2 py-2 text-textcolor/60">
								<Spinner className="size-3.5" />
								继续加载
							</div>
						)}
					</>
				)
			) : null}
			{phase === 'ready' && !live ? (
				<ScrollArea
					className="max-h-79"
					viewportClassName="max-h-79"
					scrollbarClassName="border-0 p-0"
				>
					{filtered.length === 0 ? (
						<div className="px-2 py-3 text-textcolor/60">没有匹配的条目</div>
					) : (
						filtered.map((item, i) => (
							<ListRow
								key={`${block.artifactId}-${i}`}
								index={i}
								item={item}
								source={block.source}
								last={i === filtered.length - 1}
								playingKey={playing}
								onPlay={onPlay}
								onOpen={hrefOf(block, item) ? () => openItem(item) : undefined}
								playWordLabel={t('englishLearning.vocab.playWord')}
								playQuoteLabel={t('englishLearning.classic.playQuote')}
								stopLabel={t('englishLearning.tts.stop')}
							/>
						))
					)}
				</ScrollArea>
			) : null}
		</div>
	);
}
