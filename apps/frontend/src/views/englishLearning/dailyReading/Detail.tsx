/**
 * 每日阅读详情：英文在上，中文在下，只朗读英文。
 */
import Loading from '@design/Loading';
import {
	Button,
	Popover,
	PopoverContent,
	PopoverTrigger,
	Toast,
} from '@ui/index';
import {
	CircleChevronDown,
	CircleChevronRight,
	Square,
	Volume2,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useSearchParams } from 'react-router';
import { useI18n } from '@/hooks';
import { cn } from '@/lib/utils';
import {
	type EnglishDailyReadingExtras,
	type EnglishDailyReadingItem,
	getEnglishDailyReading,
} from '@/service';
import { playPreferred, stopAllPlayback } from '@/utils/speech';
import { Card } from '../components/vocab/Card';
import { DailyPlayIconButton } from '../daily/components/DailyPlayIconButton';
import { QUIZ_OPTION_CLASS } from '../daily/constants';
import { PRACTICE_PRIMARY_ACTION_BTN_CLASS } from '../practice/constants';
import { ttsCacheScopeDailyReading } from '../utils/ttsCacheFolder';

const SECTION = 'text-textcolor text-sm font-semibold';
const PANEL = 'border-theme/10 bg-theme/5 rounded-md border';

function Quiz({
	items,
}: {
	items: NonNullable<EnglishDailyReadingExtras['questions']>;
}) {
	const { t } = useI18n();
	const [picked, setPicked] = useState<Record<number, number>>({});
	const [submitted, setSubmitted] = useState(false);
	const ready = items.every((_, index) => picked[index] != null);
	return (
		<section className="flex flex-col gap-3">
			<h2 className={SECTION}>{t('englishLearning.dailyReading.quiz')}</h2>
			{items.map((item, index) => {
				const chosen = picked[index];
				const correct = chosen === item.answer;
				return (
					<div key={index} className="flex flex-col gap-2">
						<p className="text-textcolor text-base leading-7">
							{submitted ? (
								<span
									className={cn(
										'mr-2',
										correct ? 'text-teal-500' : 'text-rose-500',
									)}
								>
									{correct
										? t('englishLearning.dailyReading.quizRight')
										: t('englishLearning.dailyReading.quizWrong')}
								</span>
							) : null}
							{item.q}
						</p>
						{item.options.map((opt, optIndex) => {
							const on = chosen === optIndex;
							const right = optIndex === item.answer;
							return (
								<Button
									key={optIndex}
									type="button"
									variant="ghost"
									aria-pressed={on}
									className={cn(
										QUIZ_OPTION_CLASS,
										submitted && 'pointer-events-none',
										!submitted &&
											on &&
											'border-teal-500/40 bg-teal-500/15 hover:bg-teal-500/15',
										submitted &&
											right &&
											'border-teal-500/40 bg-teal-500/15 hover:bg-teal-500/15',
										submitted &&
											on &&
											!right &&
											'border-rose-500/35 bg-rose-500/10 text-rose-500 hover:bg-rose-500/10',
									)}
									onClick={() =>
										setPicked((prev) => {
											if (prev[index] === optIndex) {
												const next = { ...prev };
												delete next[index];
												return next;
											}
											return { ...prev, [index]: optIndex };
										})
									}
								>
									{opt}
								</Button>
							);
						})}
					</div>
				);
			})}
			{submitted ? null : (
				<Button
					type="button"
					disabled={!ready}
					className={cn('h-10 w-full', PRACTICE_PRIMARY_ACTION_BTN_CLASS)}
					onClick={() => setSubmitted(true)}
				>
					{t('englishLearning.dailyReading.quizSubmit')}
				</Button>
			)}
		</section>
	);
}

function GlossSentence({
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
	const tokens = en.split(/(\s+)/);
	let at = 0;
	return (
		<span>
			{tokens.map((token, index) => {
				if (!token.trim()) return <span key={index}>{token}</span>;
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
						onOpenChange={(next) => onOpen(next ? key : null, key)}
					>
						<PopoverTrigger asChild>
							<button
								type="button"
								className={cn(
									'cursor-pointer bg-transparent p-0 text-inherit hover:text-teal-400',
									open && 'text-teal-500',
								)}
							>
								{token}
							</button>
						</PopoverTrigger>
						<PopoverContent
							side="top"
							align="center"
							sideOffset={8}
							className="w-auto max-w-64 px-3 py-2.5"
							onOpenAutoFocus={(event) => event.preventDefault()}
							onCloseAutoFocus={(event) => event.preventDefault()}
						>
							<div className="flex flex-col gap-1">
								<div className="flex items-center gap-1.5">
									<span className="text-textcolor text-base font-semibold leading-none">
										{gloss.w}
									</span>
									<Button
										type="button"
										variant="ghost"
										size="sm"
										className={cn(
											'size-6 shrink-0 rounded-md p-0 shadow-none',
											'focus-visible:border-transparent focus-visible:ring-0',
											playing
												? 'text-teal-500'
												: 'text-textcolor/55 hover:text-teal-400',
										)}
										aria-label={playing ? stopLabel : playLabel}
										onClick={() => onPlay(gloss.w)}
									>
										{playing ? (
											<Square className="size-3.5 fill-current" aria-hidden />
										) : (
											<Volume2 className="size-3.5" aria-hidden />
										)}
									</Button>
								</div>
								<span className="text-textcolor/70 text-sm leading-5">
									{gloss.zh}
								</span>
							</div>
						</PopoverContent>
					</Popover>
				);
			})}
		</span>
	);
}

function sourceList(
	row: EnglishDailyReadingItem,
): { title: string; url: string }[] {
	if (row.extras?.sources?.length) return row.extras.sources;
	if (!row.sourceUrl) return [];
	return [{ title: row.sourceTitle || row.sourceUrl, url: row.sourceUrl }];
}

function paragraphs(text: string): string[] {
	return text
		.split(/\n\s*\n/)
		.map((part) => part.replace(/\s*\n\s*/g, ' ').trim())
		.filter(Boolean);
}

type GlossItem = { en: string; words: { w: string; zh: string }[] };
type ShownSentence = { en: string; words: { w: string; zh: string }[] | null };

function flatParagraph(text: string): string {
	return text.replace(/\s*\n\s*/g, ' ').trim();
}

/**
 * 正文分段是展示真相。wordGloss 对得上的句子挂逐词释义，
 * 对不上的原文仍留在原段，避免释义缺句时英文少一段。
 */
function glossParagraphs(
	bodyEn: string,
	gloss: GlossItem[],
): ShownSentence[][] {
	const used = new Set<number>();
	return paragraphs(bodyEn)
		.map((part) => {
			const raw = flatParagraph(part);
			const rawLower = raw.toLowerCase();
			const hits: { item: GlossItem; at: number }[] = [];
			gloss.forEach((item, index) => {
				if (used.has(index)) return;
				const en = item.en.replace(/\s+/g, ' ').trim();
				if (!en) return;
				const at = rawLower.indexOf(en.toLowerCase());
				if (at < 0) return;
				used.add(index);
				hits.push({ item: { en, words: item.words }, at });
			});
			hits.sort((a, b) => a.at - b.at);
			const sentences: ShownSentence[] = [];
			let cursor = 0;
			for (const hit of hits) {
				const en = hit.item.en;
				const at = rawLower.indexOf(en.toLowerCase(), cursor);
				if (at < 0) continue;
				const gap = raw.slice(cursor, at).trim();
				if (gap) sentences.push({ en: gap, words: null });
				sentences.push({
					en: raw.slice(at, at + en.length),
					words: hit.item.words,
				});
				cursor = at + en.length;
			}
			const tail = raw.slice(cursor).trim();
			if (tail) sentences.push({ en: tail, words: null });
			if (!sentences.length && raw) sentences.push({ en: raw, words: null });
			return sentences;
		})
		.filter((block) => block.length > 0);
}

export default function DailyReadingDetailPage() {
	const { t } = useI18n();
	const { id } = useParams<{ id: string }>();
	const [searchParams, setSearchParams] = useSearchParams();
	const [row, setRow] = useState<EnglishDailyReadingItem | null>(null);
	const [loading, setLoading] = useState(true);
	const [playing, setPlaying] = useState(false);
	const [wordKey, setWordKey] = useState<string | null>(null);
	const [showZh, setShowZh] = useState(false);
	const [glossKey, setGlossKey] = useState<string | null>(null);
	const scrollerRef = useRef<HTMLDivElement>(null);
	const openGloss = useCallback((key: string | null, from?: string) => {
		setGlossKey((current) => {
			if (key === null && from && current !== from) return current;
			return key;
		});
	}, []);
	useEffect(() => {
		if (!glossKey) return;
		const close = () => setGlossKey(null);
		const scroller = scrollerRef.current;
		scroller?.addEventListener('scroll', close, { passive: true });
		document.addEventListener('scroll', close, {
			capture: true,
			passive: true,
		});
		return () => {
			scroller?.removeEventListener('scroll', close);
			document.removeEventListener('scroll', close, { capture: true });
		};
	}, [glossKey]);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		if (!id) {
			setLoading(false);
			return;
		}
		let cancelled = false;
		void (async () => {
			setLoading(true);
			try {
				const res = await getEnglishDailyReading(id, { silent: true });
				if (!cancelled) {
					setRow(res.data ?? null);
					setError(null);
				}
			} catch (e) {
				if (!cancelled) {
					const message =
						e instanceof Error
							? e.message
							: t('englishLearning.dailyReading.notFound');
					setRow((prev) => (prev?.id === id ? prev : null));
					setError(message);
					Toast({ type: 'warning', title: message });
				}
			} finally {
				if (!cancelled) setLoading(false);
			}
		})();
		return () => {
			cancelled = true;
		};
	}, [id, t]);

	useEffect(() => {
		const title = row?.titleEn?.trim();
		if (!title || searchParams.get('title') === title) return;
		const next = new URLSearchParams(searchParams);
		next.set('title', title);
		setSearchParams(next, { replace: true });
	}, [row?.titleEn, searchParams, setSearchParams]);

	const togglePlay = useCallback(async () => {
		if (!row?.bodyEn) return;
		if (playing) {
			stopAllPlayback();
			setPlaying(false);
			return;
		}
		stopAllPlayback();
		setWordKey(null);
		setPlaying(true);
		try {
			await playPreferred(row.bodyEn, {
				cloudSingleUtterance: false,
				leadThenParagraphs: true,
				persistDisk: true,
				cacheFolder: ttsCacheScopeDailyReading(row.id),
				cacheTitle: row.titleEn,
			});
		} catch {
			Toast({ type: 'warning', title: t('assistant.tts.unsupported') });
		} finally {
			setPlaying(false);
		}
	}, [playing, row, t]);

	const playWord = useCallback(
		async (word: string) => {
			if (!row) return;
			if (wordKey === word) {
				stopAllPlayback();
				setWordKey(null);
				return;
			}
			stopAllPlayback();
			setPlaying(false);
			setWordKey(word);
			try {
				await playPreferred(word, {
					persistDisk: true,
					cacheFolder: ttsCacheScopeDailyReading(row.id),
					cacheTitle: word,
				});
			} catch {
				Toast({ type: 'warning', title: t('assistant.tts.unsupported') });
			} finally {
				setWordKey((current) => (current === word ? null : current));
			}
		},
		[row, t, wordKey],
	);

	return (
		<div className="flex h-full min-h-0 w-full flex-col">
			<div className="box-border flex h-full min-h-0 w-full min-w-0 flex-col p-5.5 pt-0">
				<div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-md bg-theme-background">
					<div ref={scrollerRef} className="min-h-0 flex-1 overflow-auto p-6">
						{loading ? <Loading /> : null}
						{!loading && !row ? (
							<p className="text-sm text-textcolor/60">
								{error || t('englishLearning.dailyReading.notFound')}
							</p>
						) : null}
						{row ? (
							<article className="mx-auto flex max-w-2xl flex-col gap-6">
								<div className="flex flex-col gap-2">
									<h1 className="text-xl font-semibold leading-snug">
										{row.titleEn}
										{row.bodyEn ? (
											<span className="ml-1 mb-1 inline-flex align-middle">
												<DailyPlayIconButton
													playing={playing}
													playLabel={
														playing
															? t('englishLearning.tts.stop')
															: t('englishLearning.dailyReading.play')
													}
													onPlay={() => void togglePlay()}
												/>
											</span>
										) : null}
									</h1>
									<p className="text-sm text-textcolor/80">
										{row.publishDate}
										{' · '}
										{t(
											row.origin === 'manual'
												? 'englishLearning.dailyReading.manual'
												: 'englishLearning.dailyReading.originDay',
										)}
										{row.extras ? ` · ${row.extras.level}` : ''}
										{row.extras?.length
											? ` · ${t(
													row.extras.length === 'short'
														? 'englishLearning.dailyReading.lengthShort'
														: row.extras.length === 'long'
															? 'englishLearning.dailyReading.lengthLong'
															: 'englishLearning.dailyReading.lengthMedium',
												)}`
											: ''}
									</p>
								</div>
								{row.extras?.wordGloss?.length
									? glossParagraphs(row.bodyEn, row.extras.wordGloss).map(
											(block, blockIndex) => (
												<p key={blockIndex} className="text-lg leading-7">
													{block.map((sentence, index) => (
														<span key={`${blockIndex}-${index}`}>
															{index > 0 ? ' ' : null}
															{sentence.words ? (
																<GlossSentence
																	en={sentence.en}
																	words={sentence.words}
																	sentenceIndex={blockIndex * 100 + index}
																	openKey={glossKey}
																	onOpen={openGloss}
																	playingWord={wordKey}
																	onPlay={(word) => void playWord(word)}
																	playLabel={t(
																		'englishLearning.vocab.playWord',
																	)}
																	stopLabel={t('englishLearning.tts.stop')}
																/>
															) : (
																sentence.en
															)}
														</span>
													))}
												</p>
											),
										)
									: paragraphs(row.bodyEn).map((part, index) => (
											<p key={index} className="text-lg leading-7">
												{part}
											</p>
										))}
								<Button
									type="button"
									variant="link"
									className="h-auto justify-start gap-1.5 px-0! py-0 has-[>svg]:px-0! text-sm font-medium text-teal-500 hover:text-teal-400"
									aria-expanded={showZh}
									onClick={() => setShowZh((v) => !v)}
								>
									{showZh ? (
										<CircleChevronDown
											className="size-4 shrink-0"
											aria-hidden
										/>
									) : (
										<CircleChevronRight
											className="size-4 shrink-0"
											aria-hidden
										/>
									)}
									{showZh
										? t('englishLearning.dailyReading.hideZh')
										: t('englishLearning.dailyReading.showZh')}
								</Button>
								{showZh ? (
									<p className="text-sm font-medium leading-7 text-textcolor/80">
										{row.titleZh}
									</p>
								) : null}
								{showZh
									? paragraphs(row.bodyZh).map((part, index) => (
											<p
												key={index}
												className="text-sm leading-7 text-textcolor/80"
											>
												{part}
											</p>
										))
									: null}
								{sourceList(row).length ? (
									<div className="flex flex-col gap-1 text-sm">
										<span className="text-textcolor/80">
											{t('englishLearning.dailyReading.sourceHint')}
										</span>
										{sourceList(row).map((source) => (
											<a
												key={source.url}
												className="text-teal-500 underline"
												href={source.url}
												target="_blank"
												rel="noreferrer"
											>
												{source.title}
											</a>
										))}
									</div>
								) : null}
								{row.extras?.glossary?.length ? (
									<section className="flex flex-col gap-3">
										<h2 className={SECTION}>
											{t('englishLearning.dailyReading.glossary')}
										</h2>
										<div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,14rem),1fr))] gap-3">
											{row.extras.glossary.map((item) => (
												<Card
													key={item.word}
													className="[&_[data-word]]:text-xl"
													data={{
														word: item.word,
														ipa: '',
														translationZh: item.zh,
													}}
													playing={wordKey === item.word}
													onTogglePlay={() => void playWord(item.word)}
													playLabels={{
														play: t('englishLearning.vocab.playWord'),
														stop: t('englishLearning.tts.stop'),
													}}
												/>
											))}
										</div>
									</section>
								) : null}
								{row.extras?.grammarNotes?.length || row.extras?.grammarNote ? (
									<section className="flex flex-col gap-3">
										<h2 className={SECTION}>
											{t('englishLearning.dailyReading.grammar')}
										</h2>
										{(row.extras.grammarNotes?.length
											? row.extras.grammarNotes
											: [row.extras.grammarNote!]
										).map((note) => (
											<p
												key={note}
												className={cn(
													PANEL,
													'text-textcolor/80 px-3 py-2.5 text-sm leading-7',
												)}
											>
												{note}
											</p>
										))}
									</section>
								) : null}
								{row.extras?.questions?.length ? (
									<Quiz items={row.extras.questions} />
								) : null}
							</article>
						) : null}
					</div>
				</div>
			</div>
		</div>
	);
}
