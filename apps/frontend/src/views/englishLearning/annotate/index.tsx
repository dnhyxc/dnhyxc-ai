/**
 * 经典句整集标注进度页：列表布局对齐练习报告，指标对齐侧栏统计格。
 */
import { Button, Spinner } from '@ui/index';
import { Toast } from '@ui/sonner';
import { Play, Trash2 } from 'lucide-react';
import { observer } from 'mobx-react';
import { useEffect, useState } from 'react';
import { useI18n } from '@/hooks';
import { cn } from '@/lib/utils';
import EnglishAnnotateSource, {
	type AnnotateTask,
	annotateTaskPercent,
} from '@/store/englishAnnotateSource';
import { getRequestErrorMessage } from '@/utils/fetch';
import { PracticePageShell } from '../practice/components/shell';

const LINK_CLASS =
	'flex shrink-0 cursor-pointer items-center gap-1.5 whitespace-nowrap text-sm font-medium text-teal-500 hover:text-teal-400 disabled:cursor-not-allowed disabled:opacity-50';

const CARD_SHELL =
	'border-theme/10 bg-theme/5 hover:border-teal-500/35 hover:bg-teal-500/10 flex min-w-0 flex-col gap-2 rounded-md border px-3 py-3 transition-colors';

const ICON_BTN =
	'h-7 w-7 shrink-0 rounded-md border p-0 transition-colors border-destructive/20 bg-destructive/10 text-destructive/55 hover:border-destructive/35 hover:bg-destructive/20 hover:text-destructive';

function statusLabel(
	task: AnnotateTask,
	t: (key: string, params?: Record<string, string | number>) => string,
) {
	switch (task.status) {
		case 'running':
			return t('englishLearning.annotateTasks.statusRunning');
		case 'done':
			return t('englishLearning.annotateTasks.statusDone');
		case 'paused':
			return t('englishLearning.annotateTasks.statusPaused');
		case 'error':
			return (task.progress?.failed ?? 0) > 0
				? t('englishLearning.annotateTasks.statusPartialFailed')
				: t('englishLearning.annotateTasks.statusError');
	}
}

type TaskTone = 'running' | 'done' | 'warn' | 'error';

function taskTone(
	task: AnnotateTask,
	streaming: boolean,
	partialFailed: boolean,
): TaskTone {
	if (task.status === 'done') return 'done';
	if (task.status === 'error' && !partialFailed) return 'error';
	if (
		task.status === 'paused' ||
		(task.status === 'running' && !streaming) ||
		partialFailed
	) {
		return 'warn';
	}
	return 'running';
}

const TONE = {
	running: {
		shell: 'border-teal-500/25 bg-linear-to-r from-teal-500/12 to-cyan-600/10',
		bar: 'bg-teal-500/85',
		status: 'text-teal-600 dark:text-teal-400',
	},
	done: {
		shell: '',
		bar: 'bg-emerald-500/80',
		status: 'text-emerald-600 dark:text-emerald-400',
	},
	warn: {
		shell:
			'border-amber-500/25 bg-linear-to-r from-amber-500/12 to-orange-500/10',
		bar: 'bg-amber-500/80',
		status: 'text-amber-600 dark:text-amber-400',
	},
	error: {
		shell: 'border-rose-500/25 bg-linear-to-r from-rose-500/12 to-rose-600/10',
		bar: 'bg-rose-500/80',
		status: 'text-rose-600 dark:text-rose-400',
	},
} as const;

/** 对齐侧栏 DailySession 统计格 */
function StatCell({
	label,
	value,
	shell,
	valueClass,
}: {
	label: string;
	value: string | number;
	shell: string;
	valueClass: string;
}) {
	return (
		<div
			className={cn(
				'flex min-w-0 items-center justify-between gap-2 rounded-md border px-2.5 pt-1.5 pb-2',
				shell,
			)}
		>
			<span className="shrink-0 text-sm font-medium text-textcolor/55">
				{label}
			</span>
			<span
				className={cn(
					'min-w-0 truncate text-lg font-semibold tabular-nums leading-none',
					valueClass,
				)}
			>
				{value}
			</span>
		</div>
	);
}

const TaskCard = observer(function TaskCard({ task }: { task: AnnotateTask }) {
	const { t } = useI18n();
	const [busy, setBusy] = useState(false);
	const p = task.progress;
	const percent = annotateTaskPercent(task);
	const streaming = EnglishAnnotateSource.hasOpenStream(task.id);
	const partialFailed =
		task.status === 'error' && (task.progress?.failed ?? 0) > 0;
	const toneKey = taskTone(task, streaming, partialFailed);
	const tone = TONE[toneKey];
	const sourceLabel =
		task.source === 'library'
			? t('englishLearning.annotateTasks.sourceLibrary')
			: t('englishLearning.annotateTasks.sourcePack');
	const displayStatus =
		task.status === 'running' && !streaming
			? t('englishLearning.annotateTasks.statusPaused')
			: statusLabel(task, t);
	const showLiveSummary = !p || task.status !== 'done';

	const onResume = async () => {
		if (busy) return;
		setBusy(true);
		try {
			await EnglishAnnotateSource.resume(task.id);
		} catch (e) {
			Toast({
				type: 'error',
				title: getRequestErrorMessage(e),
			});
		} finally {
			setBusy(false);
		}
	};

	return (
		<article className={cn(CARD_SHELL, tone.shell)}>
			{/* 顶行：仅标题 + 操作 */}
			<div className="flex min-w-0 items-center gap-2">
				<h2 className="min-w-0 flex-1 truncate text-base font-semibold text-textcolor sm:text-lg">
					{task.title}
				</h2>
				<div className="flex shrink-0 items-center gap-1.5">
					{task.status === 'running' && streaming ? (
						<Button
							type="button"
							size="sm"
							variant="outline"
							className="h-7 gap-1.5 border-rose-500/25 bg-rose-500/10 text-rose-600 hover:bg-rose-500/15 dark:text-rose-400"
							onClick={() => EnglishAnnotateSource.abort(task.id)}
						>
							<Spinner className="size-3.5 text-rose-500" />
							{t('englishLearning.annotateSource.cancelRunning')}
						</Button>
					) : null}
					{task.status === 'paused' ||
					task.status === 'error' ||
					(task.status === 'running' && !streaming) ? (
						<Button
							type="button"
							size="sm"
							variant="outline"
							disabled={busy}
							className="h-7 gap-1.5 border-teal-500/30 bg-teal-500/10 text-teal-600 hover:border-teal-500/45 hover:bg-teal-500/15 dark:text-teal-400"
							onClick={() => void onResume()}
						>
							{busy ? (
								<Spinner className="size-3.5 text-teal-500" />
							) : (
								<Play className="size-3.5" />
							)}
							{t('englishLearning.annotateTasks.resume')}
						</Button>
					) : null}
					{task.status !== 'running' || !streaming ? (
						<Button
							type="button"
							variant="ghost"
							size="sm"
							className={ICON_BTN}
							aria-label={t('englishLearning.annotateTasks.dismiss')}
							onClick={() => EnglishAnnotateSource.dismiss(task.id)}
						>
							<Trash2 className="size-3.5" />
						</Button>
					) : null}
				</div>
			</div>

			{/* title 以下统一 gap-3；title 与正文间距仍由 CARD_SHELL gap-2 控制 */}
			<div className="flex flex-col gap-3">
				<p className="flex min-w-0 flex-nowrap items-center gap-x-1.5 overflow-x-auto text-sm whitespace-nowrap tabular-nums">
					<span className="text-textcolor/50 shrink-0">{sourceLabel}</span>
					<span className="text-textcolor/35 shrink-0" aria-hidden>
						·
					</span>
					<span className={cn('shrink-0 font-medium', tone.status)}>
						{displayStatus}
					</span>
					<span className="text-textcolor/35 shrink-0" aria-hidden>
						·
					</span>
					<span className={cn('shrink-0 font-semibold', tone.status)}>
						{percent}%
					</span>
				</p>
				{showLiveSummary ? (
					<p className="text-textcolor/60 text-sm leading-snug">
						{p
							? t('englishLearning.annotateSource.progress', {
									hit: p.hit,
									annotated: p.annotated,
									miss: p.miss || p.remaining,
									remaining: p.remaining,
								})
							: t('englishLearning.annotateSource.preparing')}
					</p>
				) : null}
				<div className="h-1.5 w-full overflow-hidden rounded-md bg-theme/10">
					<div
						className={cn(
							'h-full rounded-md transition-[width] duration-300 ease-out',
							tone.bar,
						)}
						style={{ width: `${percent}%` }}
					/>
				</div>

				{p ? (
					<div className="flex flex-col gap-3">
						<div className="grid grid-cols-2 gap-3">
							<StatCell
								label={t('englishLearning.annotateTasks.metricTotal')}
								value={p.total}
								shell="border-sky-500/20 bg-linear-to-r from-sky-400/10 to-cyan-500/10"
								valueClass="text-sky-700 dark:text-cyan-400"
							/>
							<StatCell
								label={t('englishLearning.annotateTasks.metricHit')}
								value={p.hit}
								shell="border-emerald-500/20 bg-linear-to-r from-emerald-400/10 to-teal-500/10"
								valueClass="text-emerald-600 dark:text-emerald-400"
							/>
							<StatCell
								label={t('englishLearning.annotateTasks.metricAnnotated')}
								value={p.annotated}
								shell="border-teal-500/20 bg-linear-to-r from-teal-400/10 to-cyan-500/10"
								valueClass="text-teal-700 dark:text-teal-400"
							/>
							<StatCell
								label={t('englishLearning.annotateTasks.metricFailed')}
								value={p.failed}
								shell={
									p.failed > 0
										? 'border-rose-500/20 bg-linear-to-r from-rose-400/10 to-rose-600/10'
										: 'border-theme/10 bg-theme/5'
								}
								valueClass={
									p.failed > 0
										? 'text-rose-600 dark:text-rose-400'
										: 'text-textcolor/70'
								}
							/>
						</div>
						<p
							className="text-textcolor/50 truncate text-sm tabular-nums"
							title={t('englishLearning.annotateTasks.metricTokensDetail', {
								prompt: p.tokensPrompt ?? 0,
								completion: p.tokensCompletion ?? 0,
							})}
						>
							{t('englishLearning.annotateTasks.metricTokens')}
							{' · '}
							{t('englishLearning.annotateTasks.metricTokensValue', {
								total: p.tokensTotal ?? 0,
								prompt: p.tokensPrompt ?? 0,
								completion: p.tokensCompletion ?? 0,
							})}
						</p>
					</div>
				) : null}
			</div>
		</article>
	);
});

function AnnotateTasksPageInner() {
	const { t } = useI18n();
	const tasks = EnglishAnnotateSource.orderedTasks;
	const running = EnglishAnnotateSource.runningCount;
	const hasFinished = tasks.some(
		(x) => x.status === 'done' || x.status === 'error',
	);

	useEffect(() => {
		void EnglishAnnotateSource.hydrate();
	}, []);

	return (
		<PracticePageShell
			title={
				<span className="min-w-0 truncate font-semibold">
					{t('englishLearning.annotateTasks.pageTitle')}
				</span>
			}
			contentLayout="start"
			headerRight={
				hasFinished ? (
					<button
						type="button"
						className={LINK_CLASS}
						onClick={() => EnglishAnnotateSource.dismissFinished()}
					>
						<Trash2 className="size-4 shrink-0 opacity-90" aria-hidden />
						<span>{t('englishLearning.annotateTasks.clearFinished')}</span>
					</button>
				) : null
			}
		>
			<div className="flex w-full flex-col gap-3">
				<p className="text-textcolor/55 text-base">
					{running > 0
						? t('englishLearning.annotateTasks.pageRunningHint', {
								count: running,
							})
						: t('englishLearning.annotateTasks.pageIdleHint')}
				</p>

				{tasks.length === 0 ? (
					<p className="text-textcolor/55 py-16 text-center text-base">
						{t('englishLearning.annotateTasks.empty')}
					</p>
				) : (
					<div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,18rem),1fr))] gap-4 pb-4">
						{tasks.map((task) => (
							<TaskCard key={task.id} task={task} />
						))}
					</div>
				)}
			</div>
		</PracticePageShell>
	);
}

export default observer(AnnotateTasksPageInner);
