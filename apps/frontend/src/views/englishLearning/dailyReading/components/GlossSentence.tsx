import { Popover, PopoverAnchor, PopoverContent } from '@ui/index';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import { WordLine } from './WordLine';

/** 有拖选时不打开释义，避免抢选区 / 误点 */
function hasTextSelection() {
	const sel = window.getSelection();
	return Boolean(sel && !sel.isCollapsed);
}

/** 单词释义句组件 */
export function GlossSentence({
	en,
	words,
	sentenceIndex,
	openKey,
	onOpen,
	playingWord,
	onPlay,
	playLabel,
	stopLabel,
}: {
	en: string;
	words: { w: string; zh: string }[];
	sentenceIndex: number;
	openKey: string | null;
	onOpen: (key: string | null, from?: string) => void;
	playingWord: string | null;
	onPlay: (word: string) => void;
	playLabel: string;
	stopLabel: string;
}) {
	// ponytail: CSS :hover 在 ScrollArea / 两端对齐正文里易粘住；指针态可随 leave 清掉
	const [hoverKey, setHoverKey] = useState<string | null>(null);
	const tokens = en.split(/(\s+)/);
	let at = 0;

	return (
		<span className="select-text" onPointerLeave={() => setHoverKey(null)}>
			{tokens.map((token, index) => {
				if (!token.trim()) return <span key={index}>{token}</span>;
				if (/https?:\/\//i.test(token)) {
					return (
						<span key={index} className="break-all">
							{token}
						</span>
					);
				}
				const bare = token.replace(/^[^A-Za-z']+|[^A-Za-z']+$/g, '');
				const gloss = words[at];
				if (!bare || !gloss || bare.toLowerCase() !== gloss.w.toLowerCase()) {
					return <span key={index}>{token}</span>;
				}
				at += 1;
				const key = `${sentenceIndex}-${at}`;
				const open = openKey === key;
				const playing = playingWord === gloss.w;
				return (
					<Popover
						key={index}
						open={open}
						onOpenChange={(next) => {
							if (next && hasTextSelection()) return;
							onOpen(next ? key : null, key);
						}}
					>
						{/*
						 * 不用 PopoverTrigger：Trigger 会当成可聚焦按钮，右键 mousedown
						 * 聚焦该词 → 浏览器清掉跨词选区，看起来像「只剩点击处被选中」。
						 * Anchor + 左键打开：可拖选 / 右键复制，释义仍可点开。
						 */}
						<PopoverAnchor asChild>
							<span
								onClick={() => {
									if (hasTextSelection()) return;
									onOpen(open ? null : key, key);
								}}
								onPointerEnter={() => setHoverKey(key)}
								onPointerLeave={() =>
									setHoverKey((current) => (current === key ? null : current))
								}
								className={cn(
									'cursor-pointer select-text bg-transparent p-0 text-inherit',
									open ? 'text-teal-500' : hoverKey === key && 'text-teal-400',
								)}
							>
								{token}
							</span>
						</PopoverAnchor>
						<PopoverContent
							side="top"
							align="center"
							sideOffset={8}
							className="w-auto max-w-64 px-3 py-2.5"
							onOpenAutoFocus={(event) => event.preventDefault()}
							onCloseAutoFocus={(event) => event.preventDefault()}
						>
							<WordLine
								word={gloss.w}
								zh={gloss.zh}
								playing={playing}
								onPlay={() => onPlay(gloss.w)}
								playLabel={playLabel}
								stopLabel={stopLabel}
								copy
							/>
						</PopoverContent>
					</Popover>
				);
			})}
		</span>
	);
}
