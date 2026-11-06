/**
 * 每日阅读详情：英文在上，中文在下，只朗读英文。
 */
import { useSelectionContextMenu } from '@design/ContextMenu';
import Loading from '@design/Loading';
import {
	createSelectionSpeakMenu,
	useAssistantSelectionSpeak,
} from '@design/SelectionSpeak';
import { Button, ScrollArea, Toast } from '@ui/index';
import { CircleChevronDown, CircleChevronRight } from 'lucide-react';
import {
	Fragment,
	useCallback,
	useEffect,
	useLayoutEffect,
	useMemo,
	useRef,
	useState,
} from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router';
import {
	ResizableHandle,
	ResizablePanel,
	ResizablePanelGroup,
} from '@/components/ui/resizable';
import { useI18n } from '@/hooks';
import { cn } from '@/lib/utils';
import {
	type EnglishDailyReadingItem,
	getEnglishDailyReading,
} from '@/service';
import { playPreferred, stopAllPlayback } from '@/utils/speech';
import { ttsCacheScopeDailyReading } from '../utils/ttsCacheFolder';
import { ArticleHeader } from './components/ArticleHeader';
import { GlossSentence } from './components/GlossSentence';
import { Quiz } from './components/Quiz';
import { ReadingList } from './components/ReadingList';
import { WordLine } from './components/WordLine';
import { paragraphs, renderText, sourceList } from './utils/body';
import { parseOrigin, type ReadingOrigin } from './utils/origin';
import {
	alignBodyZhHeuristic,
	buildPlaySentences,
	type PlaySentence,
	playSentenceCount,
	resolveArticleSiFromSelection,
	resolveSentenceZh,
} from './utils/playSentences';

/**
 * - 默认/播放：一段连续 text-justify；当前句译 float 全宽挂在该句后。
 * - 逐句释义：仍按句展示（一句英文 + 一句中文），中文普通换行（一行摆不下再折），
 *   不再把整段中文捏成一块。
 */
function PlaySentenceRun({
	sentences,
	activeSentenceIndex,
	glossKey,
	openGloss,
	wordKey,
	onPlayWord,
	playLabel,
	stopLabel,
	showSentenceZh = false,
	showPlaySentenceZh = true,
}: {
	sentences: PlaySentence[];
	activeSentenceIndex: number | null;
	glossKey: string | null;
	openGloss: (key: string | null, from?: string) => void;
	wordKey: string | null;
	onPlayWord: (word: string) => void;
	playLabel: string;
	stopLabel: string;
	showSentenceZh?: boolean;
	/** 朗读时在当前句下挂中文；默认开 */
	showPlaySentenceZh?: boolean;
}) {
	const renderEn = (sentence: PlaySentence, indexInRun: number) => (
		<span
			data-si={sentence.si}
			className={
				activeSentenceIndex === sentence.si
					? 'rounded-sm bg-[rgba(135,207,92,0.15)]'
					: undefined
			}
		>
			{indexInRun > 0 ? ' ' : null}
			{sentence.words ? (
				<GlossSentence
					en={sentence.en}
					words={sentence.words}
					sentenceIndex={sentence.si}
					openKey={glossKey}
					onOpen={openGloss}
					playingWord={wordKey}
					onPlay={onPlayWord}
					playLabel={playLabel}
					stopLabel={stopLabel}
				/>
			) : (
				renderText(sentence.en)
			)}
		</span>
	);

	if (showSentenceZh) {
		return (
			<div className="flex flex-col gap-3">
				{sentences.map((sentence) => (
					<div key={sentence.si} className="flex flex-col gap-1">
						<p className="text-justify text-lg leading-7">
							{renderEn(sentence, 0)}
						</p>
						{sentence.zh?.trim() ? (
							<p className="text-sm font-normal leading-6 text-textcolor/80">
								{sentence.zh}
							</p>
						) : null}
					</div>
				))}
			</div>
		);
	}

	return (
		<p className="text-justify text-lg leading-7">
			{sentences.map((sentence, index) => {
				const playZhBelow =
					showPlaySentenceZh &&
					!!sentence.zh?.trim() &&
					activeSentenceIndex === sentence.si;
				return (
					<Fragment key={sentence.si}>
						{renderEn(sentence, index)}
						{playZhBelow ? (
							<span className="float-left clear-both w-full text-sm font-normal leading-6 text-textcolor/80">
								{sentence.zh}
							</span>
						) : null}
					</Fragment>
				);
			})}
		</p>
	);
}

/** 语法说明里的英文跟正文同一字号、字重和颜色。 */
function articleEnglish(text: string) {
	return text.split(/([A-Za-z]+(?:['’-][A-Za-z]+)*)/).map((part, index) =>
		index % 2 === 1 ? (
			<span
				key={index}
				className="text-lg font-normal leading-7 text-textcolor"
			>
				{part}
			</span>
		) : (
			part
		),
	);
}

export default function DailyReadingDetailPage() {
	const { t } = useI18n();
	const navigate = useNavigate();
	const { id } = useParams<{ id: string }>();
	const [searchParams, setSearchParams] = useSearchParams();
	const [row, setRow] = useState<EnglishDailyReadingItem | null>(null);
	const [loading, setLoading] = useState(true);
	/** 当前播放句；暂停保留，idle/打断/换篇清空 */
	const [activeSentenceIndex, setActiveSentenceIndex] = useState<number | null>(
		null,
	);
	const [wordKey, setWordKey] = useState<string | null>(null);
	const [showZh, setShowZh] = useState(false);
	/** 逐句中文：一句英文下一句中文 */
	const [showSentenceZh, setShowSentenceZh] = useState(false);
	/** 朗读时展示当前句中文；默认开 */
	const [showPlaySentenceZh, setShowPlaySentenceZh] = useState(true);
	const [glossKey, setGlossKey] = useState<string | null>(null);
	const [listOpen, setListOpen] = useState(false);
	const [origin, setOrigin] = useState<ReadingOrigin>(() =>
		parseOrigin(searchParams.get('origin')),
	);
	const originSeeded = useRef(searchParams.get('origin') != null);
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

	/**
	 * 朗读来源：header 全文 vs 选区菜单。共用一条底部条，但 header 图标只跟 article 联动。
	 */
	const [speakSource, setSpeakSource] = useState<
		'idle' | 'article' | 'selection'
	>('idle');

	/** 开播前清点词高亮；句高亮由 onSentenceIndex / idle effect 管 */
	const resetBeforeSpeak = useCallback(() => {
		setWordKey(null);
	}, []);

	const selectionSpeak = useAssistantSelectionSpeak(resetBeforeSpeak);
	/** playBlocks 在下方才算好；选区朗读用 ref 读最新句表 */
	const playSentencesRef = useRef<PlaySentence[]>([]);

	const startSelectionSpeak = useCallback(
		(text: string) => {
			setSpeakSource('selection');
			const syncSi = (selSi: number) => {
				const si = resolveArticleSiFromSelection(
					playSentencesRef.current,
					text,
					selSi,
				);
				if (si != null) setActiveSentenceIndex(si);
			};
			const ok = selectionSpeak.start(text, {
				onSentenceIndex: syncSi,
			});
			if (ok) syncSi(0);
			return ok;
		},
		[selectionSpeak.start],
	);

	const selectionMenuItems = useMemo(
		() => createSelectionSpeakMenu(t, startSelectionSpeak),
		[t, startSelectionSpeak],
	);

	const {
		onContextMenuCapture: onSelectionContextMenuCapture,
		onPointerDownCapture: onSelectionPointerDownCapture,
		menu: selectionContextMenu,
	} = useSelectionContextMenu(selectionMenuItems);

	useEffect(() => {
		if (!id) {
			// setLoading(false);
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
				// if (!cancelled) setLoading(false);
			}
		})();
		return () => {
			cancelled = true;
		};
	}, [id, t]);

	useEffect(() => {
		if (originSeeded.current || row?.origin !== 'manual') return;
		originSeeded.current = true;
		setOrigin('manual');
	}, [row?.origin]);

	useEffect(() => {
		scrollerRef.current?.scrollTo(0, 0);
		selectionSpeak.stop();
		setSpeakSource('idle');
		setActiveSentenceIndex(null);
		setWordKey(null);
		setShowSentenceZh(false);
		setShowPlaySentenceZh(true);
	}, [id, selectionSpeak.stop]);

	useEffect(() => {
		// 切换时 row 还是上一篇，不能拿它把地址栏标题盖回去
		if (!id || row?.id !== id) return;
		const title = row.titleEn?.trim();
		if (!title || searchParams.get('title') === title) return;
		const next = new URLSearchParams(searchParams);
		next.set('title', title);
		setSearchParams(next, { replace: true });
	}, [id, row, searchParams, setSearchParams]);

	useEffect(() => {
		if (selectionSpeak.status !== 'idle') return;
		setSpeakSource('idle');
		setActiveSentenceIndex(null);
	}, [selectionSpeak.status]);

	useLayoutEffect(() => {
		if (activeSentenceIndex == null) return;
		const root = scrollerRef.current;
		const el = root?.querySelector(`[data-si="${activeSentenceIndex}"]`);
		el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
	}, [activeSentenceIndex]);

	/** 右上角：仅全文开播/停止；与选区朗读互斥，互不抢对方的 header 态 */
	const toggleHeaderPlay = useCallback(() => {
		if (!row?.bodyEn) return;
		if (speakSource === 'article') {
			selectionSpeak.stop();
			return;
		}
		setSpeakSource('article');
		const ok = selectionSpeak.start(row.bodyEn, {
			onSentenceIndex: (si) => setActiveSentenceIndex(si),
		});
		if (!ok) {
			setSpeakSource('idle');
			Toast({ type: 'warning', title: t('assistant.tts.unsupported') });
			return;
		}
		setActiveSentenceIndex(0);
	}, [row, selectionSpeak, speakSource, t]);

	const onOrigin = useCallback((next: ReadingOrigin) => {
		originSeeded.current = true;
		setOrigin(next);
	}, []);

	const onOpenReading = useCallback(
		(item: EnglishDailyReadingItem) => {
			const params = new URLSearchParams({ title: item.titleEn });
			if (origin === 'manual') params.set('origin', 'manual');
			navigate(`/english-learning/daily-reading/${item.id}?${params}`);
		},
		[navigate, origin],
	);

	const playWord = useCallback(
		async (word: string) => {
			if (!row) return;
			if (wordKey === word) {
				stopAllPlayback();
				setWordKey(null);
				return;
			}
			selectionSpeak.stop();
			stopAllPlayback();
			setActiveSentenceIndex(null);
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
		[row, selectionSpeak.stop, t, wordKey],
	);

	const playBlocks = useMemo(() => {
		if (!row?.bodyEn) return [];
		const enCount = playSentenceCount(row.bodyEn);
		const aligned = alignBodyZhHeuristic(row.bodyZh, enCount);
		// 条数对不上时不信 extras，避免错句译文
		const sentenceZh =
			row.extras?.sentenceZh?.length === enCount
				? row.extras.sentenceZh
				: undefined;
		return buildPlaySentences(row.bodyEn, row.extras?.wordGloss, (si) =>
			resolveSentenceZh({
				si,
				sentenceZh,
				alignedHeuristic: aligned,
			}),
		);
	}, [row]);

	playSentencesRef.current = playBlocks.flat();

	const hasSentenceZh = useMemo(
		() => playBlocks.some((block) => block.some((s) => !!s.zh?.trim())),
		[playBlocks],
	);

	return (
		<div className="flex h-full min-h-0 w-full flex-col">
			<div className="box-border flex h-full min-h-0 w-full min-w-0 flex-col p-5.5 pt-0">
				<div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-md bg-theme-background">
					{/*
					 * key 随 listOpen 重建分栏，避免关上再打开时左栏宽度粘住。
					 */}
					<ResizablePanelGroup
						key={listOpen ? 'daily-reading-with-list' : 'daily-reading-article'}
						id={listOpen ? 'daily-reading-split' : 'daily-reading-only'}
						orientation="horizontal"
						className="min-h-0 min-w-0 flex-1"
						defaultLayout={
							listOpen
								? {
										'daily-reading-list': 35,
										'daily-reading-article': 65,
									}
								: { 'daily-reading-article': 100 }
						}
					>
						{listOpen ? (
							<>
								<ResizablePanel
									id="daily-reading-list"
									defaultSize="35%"
									minSize="15%"
									maxSize="45%"
									className="min-h-0 min-w-0"
								>
									<ReadingList
										currentId={id ?? ''}
										origin={origin}
										onOrigin={onOrigin}
										onOpen={onOpenReading}
									/>
								</ResizablePanel>
								<ResizableHandle withHandle className="w-0" />
							</>
						) : null}
						<ResizablePanel
							id="daily-reading-article"
							defaultSize={listOpen ? '65%' : '100%'}
							className="min-h-0 min-w-0"
						>
							<div className="relative flex h-full min-h-0 min-w-0 flex-col overflow-hidden bg-theme-background">
								{row ? (
									<div className="shrink-0 px-4 pt-2.5">
										<div className="mx-auto w-full max-w-2xl">
											<ArticleHeader
												row={row}
												playing={speakSource === 'article'}
												listOpen={listOpen}
												hasSentenceZh={hasSentenceZh}
												sentenceZhOpen={showSentenceZh}
												playSentenceZhOpen={showPlaySentenceZh}
												onPlay={toggleHeaderPlay}
												onToggleList={() => setListOpen((open) => !open)}
												onToggleSentenceZh={() =>
													setShowSentenceZh((open) => !open)
												}
												onTogglePlaySentenceZh={() =>
													setShowPlaySentenceZh((open) => !open)
												}
											/>
										</div>
									</div>
								) : null}
								<div
									className={cn(
										'flex min-h-0 min-w-0 flex-1 flex-col',
										loading && !row ? 'justify-center' : 'pt-4',
									)}
								>
									{loading && !row ? (
										<Loading />
									) : (
										<ScrollArea
											ref={scrollerRef}
											className="min-h-0 flex-1 mb-4"
										>
											<div className="px-4">
												{!loading && !row ? (
													<p className="flex items-center justify-center text-sm text-textcolor/60">
														{error ||
															t('englishLearning.dailyReading.notFound')}
													</p>
												) : null}
												{row ? (
													<article className="mx-auto flex w-full max-w-2xl flex-col gap-6">
														{/* 英文正文：选区右键 → 朗读 / 复制 */}
														<div
															onContextMenuCapture={
																onSelectionContextMenuCapture
															}
															onPointerDownCapture={
																onSelectionPointerDownCapture
															}
														>
															{playBlocks.map((block, blockIndex) => (
																<PlaySentenceRun
																	key={blockIndex}
																	sentences={block}
																	activeSentenceIndex={activeSentenceIndex}
																	glossKey={glossKey}
																	openGloss={openGloss}
																	wordKey={wordKey}
																	onPlayWord={(word) => void playWord(word)}
																	playLabel={t(
																		'englishLearning.vocab.playWord',
																	)}
																	stopLabel={t('englishLearning.tts.stop')}
																	showSentenceZh={showSentenceZh}
																	showPlaySentenceZh={showPlaySentenceZh}
																/>
															))}
															{selectionContextMenu}
														</div>
														<Button
															type="button"
															variant="link"
															className="h-auto w-fit justify-start gap-1.5 px-0! py-0 has-[>svg]:px-0! text-sm font-medium text-teal-500 hover:text-teal-400"
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
																		className="text-teal-500 underline w-fit"
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
																<h2 className="text-sm text-textcolor/80">
																	{t('englishLearning.dailyReading.glossary')}
																</h2>
																<div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,14rem),1fr))] gap-3">
																	{row.extras.glossary.map((item) => (
																		<div
																			key={item.word}
																			className="border-theme/10 bg-theme/5 rounded-md border px-3 py-2.5"
																		>
																			<WordLine
																				word={item.word}
																				zh={item.zh}
																				playing={wordKey === item.word}
																				onPlay={() => void playWord(item.word)}
																				playLabel={t(
																					'englishLearning.vocab.playWord',
																				)}
																				stopLabel={t(
																					'englishLearning.tts.stop',
																				)}
																			/>
																		</div>
																	))}
																</div>
															</section>
														) : null}
														{row.extras?.grammarNotes?.length ||
														row.extras?.grammarNote ? (
															<section className="flex flex-col gap-3">
																<h2 className="text-sm text-textcolor/80">
																	{t('englishLearning.dailyReading.grammar')}
																</h2>
																{(row.extras.grammarNotes?.length
																	? row.extras.grammarNotes
																	: [row.extras.grammarNote!]
																).map((note) =>
																	typeof note === 'string' ? (
																		<p
																			key={note}
																			className="border-theme/10 bg-theme/5 text-textcolor/80 rounded-md border px-3 py-2.5 text-sm leading-7"
																		>
																			{note}
																		</p>
																	) : (
																		<div
																			key={note.excerpt}
																			className="border-theme/10 bg-theme/5 flex flex-col gap-1 rounded-md border px-3 py-2.5"
																		>
																			<p className="text-sm font-medium text-textcolor">
																				{articleEnglish(note.point)}
																			</p>
																			<p className="text-lg leading-7 text-textcolor">
																				{note.excerpt}
																			</p>
																			<p className="text-sm leading-7 text-textcolor/80">
																				{articleEnglish(note.explain)}
																			</p>
																		</div>
																	),
																)}
															</section>
														) : null}
														{row.extras?.questions?.length ? (
															<Quiz items={row.extras.questions} />
														) : null}
													</article>
												) : null}
											</div>
										</ScrollArea>
									)}
								</div>
								{selectionSpeak.floatAbove ? (
									// 播放条用 bottom-full 贴在这个锚点上。锚点必须脱离文档流，
									// 否则 bottom 间距会变成 margin，把正文底边一起撑高。
									<div className="absolute inset-x-0 bottom-[7px]">
										<div className="relative mx-auto w-full max-w-2xl px-4">
											{selectionSpeak.floatAbove}
										</div>
									</div>
								) : null}
							</div>
						</ResizablePanel>
					</ResizablePanelGroup>
				</div>
			</div>
		</div>
	);
}
