/**
 * 练习报告详情 — 复用 WrongListItem；系统 Header 面包屑展示标题
 */
import Confirm from '@design/Confirm';
import Loading from '@design/Loading';
import { ScrollArea, Toast } from '@ui/index';
import { Spinner } from '@ui/spinner';
import { Trash2 } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router';
import { useI18n } from '@/hooks';
import {
	type EnglishPracticeReportDetail,
	getEnglishPracticeReport,
	removeEnglishPracticeReportsBatch,
} from '@/service';
import { formatDate } from '@/utils';
import {
	isPlaybackAvailable,
	playPreferred,
	stopAllPlayback,
} from '@/utils/speech';
import { PracticeCard, PracticePageShell } from '../components/shell';
import { SummaryStatsPanel, WrongListItem } from '../components/summary';
import { practiceRoundListGridClass } from '../constants';
import { reportItemToPracticeItem } from '../utils/reportItem';

const LINK_CLASS =
	'flex shrink-0 cursor-pointer items-center gap-1.5 whitespace-nowrap text-sm font-medium text-teal-500 hover:text-teal-400 disabled:cursor-not-allowed disabled:opacity-50';

export default function PracticeReportDetailPage() {
	const { t } = useI18n();
	const navigate = useNavigate();
	const { id } = useParams<{ id: string }>();
	const [searchParams] = useSearchParams();
	const [report, setReport] = useState<EnglishPracticeReportDetail | null>(
		null,
	);
	const [loading, setLoading] = useState(true);
	const [playingKey, setPlayingKey] = useState<string | null>(null);
	const [removeConfirmOpen, setRemoveConfirmOpen] = useState(false);
	const [removing, setRemoving] = useState(false);

	useEffect(() => {
		if (!id?.trim()) {
			setLoading(false);
			return;
		}
		let cancelled = false;
		void (async () => {
			setLoading(true);
			try {
				const res = await getEnglishPracticeReport(id.trim(), { silent: true });
				if (!cancelled) setReport(res.data ?? null);
			} catch {
				if (!cancelled) {
					setReport(null);
					Toast({
						type: 'warning',
						title: t('englishLearning.practice.reportDetailLoadFailed'),
					});
				}
			} finally {
				if (!cancelled) setLoading(false);
			}
		})();
		return () => {
			cancelled = true;
		};
	}, [id, t]);

	// 把标题/kind 写进 URL，供系统 Header 面包屑读取（对齐练习页 run/mode）
	useEffect(() => {
		if (!report) return;
		const kind = report.contentKind === 'classic' ? 'classic' : 'vocab';
		const title = report.title.trim();
		const next = new URLSearchParams(searchParams);
		let dirty = false;
		if (next.get('kind') !== kind) {
			next.set('kind', kind);
			dirty = true;
		}
		if (title && next.get('title') !== title) {
			next.set('title', title);
			dirty = true;
		}
		if (!dirty) return;
		navigate(
			`/english-learning/practice/reports/${report.id}?${next.toString()}`,
			{ replace: true },
		);
	}, [navigate, report, searchParams]);

	useEffect(() => () => stopAllPlayback(), []);

	const wrongEntries = useMemo(
		() =>
			(report?.items ?? [])
				.filter((it) => !it.correct)
				.map((it) => ({
					item: reportItemToPracticeItem(it),
					userInput: it.userInput,
				})),
		[report],
	);
	const correctEntries = useMemo(
		() =>
			(report?.items ?? [])
				.filter((it) => it.correct)
				.map((it) => ({
					item: reportItemToPracticeItem(it),
					userInput: it.userInput,
				})),
		[report],
	);

	const togglePlay = useCallback(
		async (text: string, key: string) => {
			if (playingKey === key) {
				stopAllPlayback();
				setPlayingKey(null);
				return;
			}
			if (!isPlaybackAvailable()) {
				Toast({
					type: 'warning',
					title: t('englishLearning.tts.unsupported'),
				});
				return;
			}
			stopAllPlayback();
			setPlayingKey(key);
			try {
				await playPreferred(text, { cloudSingleUtterance: true });
			} catch {
				Toast({
					type: 'warning',
					title: t('englishLearning.tts.unsupported'),
				});
			} finally {
				setPlayingKey((k) => (k === key ? null : k));
			}
		},
		[playingKey, t],
	);

	const executeRemove = useCallback(async () => {
		if (!report) {
			setRemoveConfirmOpen(false);
			return;
		}
		setRemoving(true);
		try {
			await removeEnglishPracticeReportsBatch([report.id]);
			setRemoveConfirmOpen(false);
			Toast({
				type: 'success',
				title: t('englishLearning.practice.reportsRemoveSuccess'),
			});
			const kind = report.contentKind === 'classic' ? 'classic' : 'vocab';
			navigate(`/english-learning/practice/reports?kind=${kind}`, {
				replace: true,
			});
		} catch (e) {
			Toast({
				type: 'error',
				title:
					e instanceof Error
						? e.message
						: t('englishLearning.practice.reportsRemoveFail'),
			});
			setRemoveConfirmOpen(false);
		} finally {
			setRemoving(false);
		}
	}, [navigate, report, t]);

	const accuracyPct =
		report && report.totalCount > 0
			? Math.round((report.correctCount / report.totalCount) * 100)
			: 0;
	const wrongCount = report ? report.totalCount - report.correctCount : 0;
	const hasWordList = wrongEntries.length > 0 || correctEntries.length > 0;
	const contentKind = report?.contentKind ?? 'vocab';
	const createdAtLabel = report?.createdAt ? formatDate(report.createdAt) : '';
	const shellTitle =
		contentKind === 'classic'
			? t('englishLearning.practice.reportsClassicNav')
			: t('englishLearning.practice.reportsVocabNav');

	return (
		<>
			<Confirm
				open={removeConfirmOpen}
				onOpenChange={setRemoveConfirmOpen}
				title={t('englishLearning.practice.reportsRemoveConfirmTitle')}
				description={
					report
						? t('englishLearning.practice.reportsRemoveConfirmDesc', {
								title: report.title,
							})
						: '\u00a0'
				}
				descriptionClassName="text-left"
				confirmText={t('englishLearning.practice.reportsRemoveConfirmAction')}
				cancelText={t('common.cancel')}
				confirmVariant="destructive"
				closeOnConfirm={false}
				onConfirm={() => void executeRemove()}
			/>
			<PracticePageShell
				title={<span className="min-w-0 truncate">{shellTitle}</span>}
				contentLayout="fill"
				headerRight={
					report && !loading ? (
						<button
							type="button"
							disabled={removing}
							className={LINK_CLASS}
							onClick={() => setRemoveConfirmOpen(true)}
							aria-label={t('englishLearning.practice.reportsRemoveAction')}
						>
							{removing ? (
								<Spinner className="size-4 shrink-0 text-teal-500" />
							) : (
								<Trash2 className="size-4 shrink-0 opacity-90" aria-hidden />
							)}
							<span>
								{removing
									? t('englishLearning.practice.reportsRemoving')
									: t('englishLearning.practice.reportsRemoveAction')}
							</span>
						</button>
					) : undefined
				}
			>
				{loading ? (
					<div className="flex flex-1 items-center justify-center py-16">
						<Loading />
					</div>
				) : !report ? (
					<p className="text-textcolor/55 py-16 text-center text-sm">
						{t('englishLearning.practice.reportDetailMissing')}
					</p>
				) : (
					<div className="mx-auto flex h-full min-h-0 w-full flex-1 flex-col">
						<PracticeCard className="border-theme/10 flex h-full min-h-0 flex-1 flex-col overflow-hidden p-0 shadow-sm">
							<SummaryStatsPanel
								compact={hasWordList}
								accuracyPct={accuracyPct}
								correctCount={report.correctCount}
								wrongCount={wrongCount}
								roundTotal={report.totalCount}
								practicedTotal={report.totalCount}
								labels={{
									accuracy: t('englishLearning.practice.summaryAccuracy'),
									correct: t('englishLearning.practice.summaryStatCorrect'),
									wrong: t('englishLearning.practice.summaryStatWrong'),
									roundTotal: t('englishLearning.practice.summaryStatTotal'),
									practiced: t('englishLearning.practice.summaryStatPracticed'),
								}}
							/>
							{hasWordList ? (
								<div className="flex min-h-0 flex-1 flex-col">
									<div className="border-theme/10 bg-theme/5 flex shrink-0 items-center justify-between gap-2 border-b px-3 py-1.5">
										<p className="text-textcolor text-xs font-semibold sm:text-sm">
											{t('englishLearning.practice.roundWordListTitle')}
										</p>
										{createdAtLabel ? (
											<p className="text-textcolor/50 shrink-0 text-xs tabular-nums sm:text-sm">
												{createdAtLabel}
											</p>
										) : null}
									</div>
									<ScrollArea
										className="min-h-0 flex-1"
										viewportClassName="max-h-full"
									>
										<div className={practiceRoundListGridClass(contentKind)}>
											{wrongEntries.map(({ item, userInput }) => (
												<WrongListItem
													key={`w-${item.key}`}
													item={item}
													variant="wrong"
													userInput={userInput}
													playing={playingKey === item.key}
													onTogglePlay={() =>
														void togglePlay(
															item.contentKind === 'classic'
																? item.english
																: item.word,
															item.key,
														)
													}
													playLabel={
														contentKind === 'classic'
															? t('englishLearning.classic.playQuote')
															: t('englishLearning.vocab.playWord')
													}
													stopLabel={t('englishLearning.tts.stop')}
												/>
											))}
											{correctEntries.map(({ item, userInput }) => (
												<WrongListItem
													key={`c-${item.key}`}
													item={item}
													variant="correct"
													userInput={userInput}
													playing={playingKey === item.key}
													onTogglePlay={() =>
														void togglePlay(
															item.contentKind === 'classic'
																? item.english
																: item.word,
															item.key,
														)
													}
													playLabel={
														contentKind === 'classic'
															? t('englishLearning.classic.playQuote')
															: t('englishLearning.vocab.playWord')
													}
													stopLabel={t('englishLearning.tts.stop')}
												/>
											))}
										</div>
									</ScrollArea>
								</div>
							) : null}
						</PracticeCard>
					</div>
				)}
			</PracticePageShell>
		</>
	);
}
