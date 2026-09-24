/**
 * 练习报告详情 — 多轮明细 + 续练动作（对齐结算 Actions）
 */
import Confirm from '@design/Confirm';
import Loading from '@design/Loading';
import { Toast } from '@ui/index';
import { Spinner } from '@ui/spinner';
import { Trash2 } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router';
import { useI18n } from '@/hooks';
import {
	batchAddEnglishClassicQuoteMistakes,
	batchAddEnglishVocabularyMistakes,
	type EnglishPracticeReportDetail,
	getEnglishPracticeReport,
	removeEnglishPracticeReportsBatch,
} from '@/service';
import { formatDate } from '@/utils';
import {
	Actions,
	Board,
	BoardMeta,
	type BoardRound,
} from '../../components/result';
import { PracticePageShell } from '../components/shell';
import { englishPracticeUrl } from '../utils/paths';
import { reportItemToPracticeItem } from '../utils/reportItem';
import {
	practiceModeShortLabel,
	practiceOrderShortLabel,
} from '../utils/reportTitle';
import {
	normalizeReportRounds,
	resumeFromReport,
} from '../utils/resumeFromReport';

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
	const [removeConfirmOpen, setRemoveConfirmOpen] = useState(false);
	const [removing, setRemoving] = useState(false);
	const [continueLoading, setContinueLoading] = useState(false);
	const [saveMistakesLoading, setSaveMistakesLoading] = useState(false);

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

	const displayRounds = useMemo(
		() => (report ? normalizeReportRounds(report) : []),
		[report],
	);

	const latestRound = displayRounds[0];
	const latestWrong = useMemo(
		() => (latestRound?.items ?? []).filter((it) => !it.correct),
		[latestRound],
	);
	const latestCorrect = useMemo(
		() => (latestRound?.items ?? []).filter((it) => it.correct),
		[latestRound],
	);

	const allWrongDeduped = useMemo(() => {
		const seen = new Set<string>();
		const out: EnglishPracticeReportDetail['items'] = [];
		for (const r of displayRounds) {
			for (const it of r.items) {
				if (it.correct || seen.has(it.itemKey)) continue;
				seen.add(it.itemKey);
				out.push(it);
			}
		}
		return out;
	}, [displayRounds]);
	const hasWrongItems = allWrongDeduped.length > 0;

	const practicedUnique = useMemo(() => {
		const keys = new Set<string>();
		for (const r of displayRounds) {
			for (const it of r.items) {
				if (it.itemKey) keys.add(it.itemKey);
			}
		}
		return keys.size;
	}, [displayRounds]);

	const boardRounds: BoardRound[] = useMemo(
		() =>
			displayRounds.map((round) => ({
				roundIndex: round.roundIndex,
				entries: round.items.map((it) => ({
					key: it.itemKey,
					item: reportItemToPracticeItem(it),
					correct: it.correct,
					userInput: it.userInput,
					playText: it.answerText,
				})),
			})),
		[displayRounds],
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

	const navigateResume = useCallback(
		(intent: 'continue' | 'retryWrong' | 'setup') => {
			if (!report) return;
			const resume = resumeFromReport(report, intent);
			if (
				intent === 'retryWrong' &&
				(!resume.retryItems || resume.retryItems.length === 0)
			) {
				return;
			}
			setContinueLoading(intent === 'continue');
			const url = englishPracticeUrl({
				contentKind: resume.config.contentKind,
				source: resume.config.source,
				mode: resume.config.mode,
				libraryId: resume.config.libraryId,
				streamId: resume.config.streamId,
				sourceTitle: resume.config.sourceTitle,
				poolTotal: resume.config.poolTotal,
			});
			navigate(url, { state: { practiceResume: resume } });
		},
		[navigate, report],
	);

	const handleSaveMistakes = useCallback(async () => {
		if (!report || allWrongDeduped.length === 0) return;
		setSaveMistakesLoading(true);
		try {
			const res =
				report.contentKind === 'classic'
					? await batchAddEnglishClassicQuoteMistakes(
							allWrongDeduped.map((it) => ({
								english: it.answerText,
								translationZh: it.translationZh,
								source: '',
								noteZh: '',
								lastUserInput: it.userInput,
							})),
						)
					: await batchAddEnglishVocabularyMistakes(
							allWrongDeduped.map((it) => ({
								word: it.answerText,
								ipa: it.ipa ?? '',
								pos: it.pos ?? '',
								segmentation: '',
								translationZh: it.translationZh,
								example: '',
								lastUserInput: it.userInput,
							})),
							{
								source:
									report.source === 'dailyMemorize'
										? 'dailyMemorize'
										: 'practice',
							},
						);
			const added = res.data?.added ?? 0;
			const updated = res.data?.updated ?? 0;
			const skipped = res.data?.skipped ?? 0;
			if (added === 0 && updated === 0 && skipped > 0) {
				Toast({
					type: 'info',
					title: t('englishLearning.practice.saveMistakesAllSkipped'),
				});
			} else {
				Toast({
					type: 'success',
					title: t('englishLearning.practice.saveMistakesSuccessTitle'),
					message: t('englishLearning.practice.saveMistakesSuccess', {
						added,
						updated,
						skipped,
					}),
				});
			}
		} finally {
			setSaveMistakesLoading(false);
		}
	}, [allWrongDeduped, report, t]);

	const accuracyPct =
		report && latestRound && latestRound.items.length > 0
			? Math.round((latestCorrect.length / latestRound.items.length) * 100)
			: report && report.totalCount > 0
				? Math.round((report.correctCount / report.totalCount) * 100)
				: 0;
	const allAttemptCount = displayRounds.reduce((n, r) => n + r.items.length, 0);
	const allCorrectCount = displayRounds.reduce(
		(n, r) => n + r.items.filter((it) => it.correct).length,
		0,
	);
	const overallAccuracyPct =
		displayRounds.length > 1 && allAttemptCount > 0
			? Math.round((allCorrectCount / allAttemptCount) * 100)
			: undefined;
	const contentKind = report?.contentKind ?? 'vocab';
	const createdAtLabel = report?.createdAt ? formatDate(report.createdAt) : '';
	const shellTitle =
		contentKind === 'classic'
			? t('englishLearning.practice.reportsClassicNav')
			: t('englishLearning.practice.reportsVocabNav');
	const mistakesPath =
		contentKind === 'classic'
			? '/english-learning/mistakes?kind=classic'
			: '/english-learning/mistakes?kind=vocab';
	const isReview = report?.source === 'review';

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
								<Trash2 className="size-4 shrink-0" aria-hidden />
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
						<Board
							contentKind={contentKind}
							accuracyPct={accuracyPct}
							overallAccuracyPct={overallAccuracyPct}
							correctCount={latestCorrect.length}
							wrongCount={latestWrong.length}
							roundTotal={latestRound?.items.length ?? report.totalCount}
							practicedTotal={practicedUnique || report.totalCount}
							poolTotal={report.sourceMeta?.poolTotal}
							meta={
								<BoardMeta
									parts={[
										practiceModeShortLabel(report.mode, t),
										practiceOrderShortLabel(report.order, t),
										createdAtLabel || undefined,
									]}
								/>
							}
							rounds={boardRounds}
							footer={
								<Actions
									hasWrongItems={hasWrongItems}
									continueLoading={continueLoading}
									saveMistakesLoading={saveMistakesLoading}
									mistakesPath={mistakesPath}
									reportSaveState="hidden"
									labels={{
										retryWrong: t('englishLearning.practice.retryWrong'),
										practiceAgain: t('englishLearning.practice.practiceAgain'),
										continuePractice: isReview
											? t('englishLearning.practice.continueReview')
											: t('englishLearning.practice.continuePractice'),
										openMistakes:
											contentKind === 'classic'
												? t('englishLearning.mistakes.classicNav')
												: t('englishLearning.mistakes.vocabNav'),
										saveMistakes: t('englishLearning.practice.saveMistakes'),
										saveReport: t('englishLearning.practice.saveReport'),
										reportSaved: t('englishLearning.practice.reportSaved'),
										viewReports: t('englishLearning.practice.viewReports'),
									}}
									onRetryWrong={() => navigateResume('retryWrong')}
									onBackToSetup={() => navigateResume('setup')}
									onContinuePractice={() => navigateResume('continue')}
									onSaveMistakes={
										isReview ? undefined : () => void handleSaveMistakes()
									}
									onViewReports={() =>
										navigate(
											`/english-learning/practice/reports?kind=${contentKind}`,
										)
									}
								/>
							}
						/>
					</div>
				)}
			</PracticePageShell>
		</>
	);
}
