import { Button, Input, ScrollArea, Spinner, Toast } from '@ui/index';
import { Search, Square, Volume2 } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
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
	return (
		block.source === 'library' &&
		Boolean(block.libraryId) &&
		(block.contentKind === 'vocab' || block.contentKind === 'classic')
	);
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

/** 只朗读词面或英文句子，库名、标题不播。 */
function speakOf(item: unknown): { text: string; sentence: boolean } | null {
	if (!item || typeof item !== 'object') return null;
	const o = item as Record<string, unknown>;
	const text = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
	const word = text(o.word);
	if (word) return { text: word, sentence: false };
	const english = text(o.english);
	if (english) return { text: english, sentence: true };
	return null;
}

function rowOf(item: unknown): { en: string; zh?: string } {
	if (!item || typeof item !== 'object') {
		return { en: String(item ?? '') };
	}
	const o = item as Record<string, unknown>;
	const text = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
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
	return zh ? { en, zh } : { en };
}

function ListRow({
	index,
	item,
	last,
	playingKey,
	onPlay,
	playWordLabel,
	playQuoteLabel,
	stopLabel,
}: {
	index: number;
	item: unknown;
	last: boolean;
	playingKey: string | null;
	onPlay: (text: string) => void;
	playWordLabel: string;
	playQuoteLabel: string;
	stopLabel: string;
}) {
	const row = rowOf(item);
	const speak = speakOf(item);
	const playing = speak != null && playingKey === speak.text;
	return (
		<div
			className={cn(
				'flex items-center gap-3 px-2 py-1.5',
				!last && 'border-b border-theme/10',
			)}
		>
			<span className="w-12 shrink-0 text-textcolor/40">{index + 1}</span>
			<span className="min-w-0 flex-1">
				<span className="block">{row.en}</span>
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
					onClick={() => onPlay(speak.text)}
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
}: {
	block: ElResourceBlock;
	/** 卡片上方还有正文或另一张卡 */
	hasAbove?: boolean;
	/** 卡片下方还有正文或另一张卡 */
	hasBelow?: boolean;
}) {
	const { t } = useI18n();
	const live = isLiveLibrary(block);
	const title = shownTitle(block.title);
	const [playing, setPlaying] = useState<string | null>(null);
	const [items, setItems] = useState<unknown[] | null>(
		live ? null : (block.items ?? null),
	);
	const [phase, setPhase] = useState<'ready' | 'loading' | 'expired'>(
		live ? 'loading' : block.items ? 'ready' : 'loading',
	);
	const [filled, setFilled] = useState(!live);
	const [reload, setReload] = useState(0);
	const [q, setQ] = useState('');
	const [scrollParent, setScrollParent] = useState<HTMLDivElement | null>(null);

	useEffect(() => {
		if (live) return;
		if (block.items) {
			setItems(block.items);
			setPhase('ready');
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
	}, [live, block.artifactId, block.items]);

	useEffect(() => {
		if (!live || !block.libraryId) return;
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
	}, [live, block.libraryId, block.contentKind, block.totalCount, reload]);

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

	const filtered = useMemo(() => {
		const rows = items ?? [];
		const needle = q.trim().toLowerCase();
		if (!needle) return rows;
		return rows.filter((item) => {
			const row = rowOf(item);
			return (
				row.en.toLowerCase().includes(needle) ||
				(row.zh ?? '').toLowerCase().includes(needle)
			);
		});
	}, [items, q]);

	return (
		<div
			className={cn(
				'w-full overflow-hidden rounded-md border border-theme/15 bg-theme/5 text-sm text-textcolor',
				hasAbove && 'mt-4',
				hasBelow && 'mb-4',
			)}
		>
			<div className="mb-1 flex items-center gap-3 border-b border-theme/10 px-2 pt-2 pb-2">
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
				<div className="flex items-center gap-2 px-2 py-4 text-textcolor/60">
					<Spinner className="size-4" />
					加载清单
				</div>
			) : null}
			{phase === 'expired' ? (
				<div className="flex items-center gap-2 px-2 py-3 text-textcolor/70">
					<span>{live ? '库不可用。' : '清单已过期。'}</span>
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
				</div>
			) : null}
			{phase === 'ready' && live ? (
				filtered.length === 0 ? (
					<div className="px-2 py-3 text-textcolor/60">没有匹配的条目</div>
				) : (
					<>
						<ScrollArea
							ref={setScrollParent}
							className="h-80"
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
											last={i === filtered.length - 1}
											playingKey={playing}
											onPlay={onPlay}
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
					className="max-h-80"
					viewportClassName="max-h-80"
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
								last={i === filtered.length - 1}
								playingKey={playing}
								onPlay={onPlay}
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
