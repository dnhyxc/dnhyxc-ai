/**
 * 每日阅读详情：英文在上，中文在下，只朗读英文。
 */
import Loading from '@design/Loading';
import Tooltip from '@design/Tooltip';
import { Button, Toast } from '@ui/index';
import {
	CircleChevronDown,
	CircleChevronRight,
	PanelLeftClose,
	PanelLeftOpen,
	WandSparkles,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
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
import { Card } from '../components/vocab/Card';
import { DailyPlayIconButton } from '../daily/components/DailyPlayIconButton';
import { ttsCacheScopeDailyReading } from '../utils/ttsCacheFolder';
import { GlossSentence } from './components/GlossSentence';
import { Quiz } from './components/Quiz';
import { ReadingList } from './components/ReadingList';
import {
	glossParagraphs,
	paragraphs,
	renderText,
	sourceList,
} from './utils/body';
import { parseOrigin, type ReadingOrigin } from './utils/origin';

const SECTION = 'text-textcolor text-sm font-semibold';
const PANEL = 'border-theme/10 bg-theme/5 rounded-md border';

export default function DailyReadingDetailPage() {
	const { t } = useI18n();
	const navigate = useNavigate();
	const { id } = useParams<{ id: string }>();
	const [searchParams, setSearchParams] = useSearchParams();
	const [row, setRow] = useState<EnglishDailyReadingItem | null>(null);
	const [loading, setLoading] = useState(true);
	const [playing, setPlaying] = useState(false);
	const [wordKey, setWordKey] = useState<string | null>(null);
	const [showZh, setShowZh] = useState(false);
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
		if (originSeeded.current || row?.origin !== 'manual') return;
		originSeeded.current = true;
		setOrigin('manual');
	}, [row?.origin]);

	useEffect(() => {
		scrollerRef.current?.scrollTo(0, 0);
	}, [id]);

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
										'daily-reading-list': 28,
										'daily-reading-article': 72,
									}
								: { 'daily-reading-article': 100 }
						}
					>
						{listOpen ? (
							<>
								<ResizablePanel
									id="daily-reading-list"
									defaultSize="28%"
									minSize="18%"
									maxSize="42%"
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
							defaultSize={listOpen ? '72%' : '100%'}
							className="min-h-0 min-w-0"
						>
							<div
								className={cn(
									'flex h-full min-h-0 min-w-0 flex-col overflow-hidden bg-theme-background',
									listOpen && 'px-4 pt-2.5 pb-4',
								)}
							>
								<div
									ref={scrollerRef}
									className={cn(
										'min-h-0 flex-1 overflow-auto',
										!listOpen && 'p-6',
									)}
								>
									{loading ? <Loading /> : null}
									{!loading && !row ? (
										<p className="text-sm text-textcolor/60">
											{error || t('englishLearning.dailyReading.notFound')}
										</p>
									) : null}
									{row ? (
										<article className="mx-auto flex max-w-2xl flex-col gap-6">
											<div className="flex flex-col gap-2">
												<div className="flex items-center justify-between gap-3">
													<h1 className="min-w-0 flex-1 text-xl font-semibold leading-snug">
														{row.titleEn}
													</h1>
													<div className="flex shrink-0 items-center">
														{row.bodyEn ? (
															<DailyPlayIconButton
																playing={playing}
																playLabel={
																	playing
																		? t('englishLearning.tts.stop')
																		: t('englishLearning.dailyReading.play')
																}
																onPlay={() => void togglePlay()}
															/>
														) : null}
														<Tooltip
															side="top"
															content={t(
																'englishLearning.dailyReading.continueGenerate',
															)}
														>
															<Button
																type="button"
																variant="link"
																size="sm"
																tabIndex={-1}
																aria-label={t(
																	'englishLearning.dailyReading.continueGenerate',
																)}
																className="h-8 w-8 shrink-0 cursor-pointer rounded-md border-0 p-0 text-teal-500 shadow-none transition-colors hover:text-teal-400 focus-visible:border-transparent focus-visible:ring-0 focus-visible:shadow-none"
																onClick={(event) => {
																	navigate(
																		'/english-learning/daily-reading/settings',
																	);
																	event.currentTarget.blur();
																}}
															>
																<WandSparkles className="size-4" aria-hidden />
															</Button>
														</Tooltip>
														<Tooltip
															side="top"
															content={t(
																listOpen
																	? 'englishLearning.dailyReading.listHide'
																	: 'englishLearning.dailyReading.listShow',
															)}
														>
															<Button
																type="button"
																variant="link"
																size="sm"
																tabIndex={-1}
																aria-pressed={listOpen}
																aria-label={t(
																	listOpen
																		? 'englishLearning.dailyReading.listHide'
																		: 'englishLearning.dailyReading.listShow',
																)}
																className="h-8 w-8 shrink-0 cursor-pointer rounded-md border-0 p-0 text-teal-500 shadow-none transition-colors hover:text-teal-400 focus-visible:border-transparent focus-visible:ring-0 focus-visible:shadow-none"
																onClick={(event) => {
																	setListOpen((open) => !open);
																	event.currentTarget.blur();
																}}
															>
																{listOpen ? (
																	<PanelLeftClose
																		className="size-4"
																		aria-hidden
																	/>
																) : (
																	<PanelLeftOpen
																		className="size-4"
																		aria-hidden
																	/>
																)}
															</Button>
														</Tooltip>
													</div>
												</div>
												<div className="flex items-center text-sm text-textcolor/80">
													<span className="-mb-0.5 text-base">
														{row.publishDate}
													</span>
													<span>
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
													</span>
												</div>
											</div>
											{row.extras?.wordGloss?.length
												? glossParagraphs(row.bodyEn, row.extras.wordGloss).map(
														(block, blockIndex) => (
															<p
																key={blockIndex}
																className="text-justify text-lg leading-7"
															>
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
																				stopLabel={t(
																					'englishLearning.tts.stop',
																				)}
																			/>
																		) : (
																			renderText(sentence.en)
																		)}
																	</span>
																))}
															</p>
														),
													)
												: paragraphs(row.bodyEn).map((part, index) => (
														<p
															key={index}
															className="text-justify text-lg leading-7"
														>
															{renderText(part)}
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
																className="**:data-word:text-xl"
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
											{row.extras?.grammarNotes?.length ||
											row.extras?.grammarNote ? (
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
						</ResizablePanel>
					</ResizablePanelGroup>
				</div>
			</div>
		</div>
	);
}
