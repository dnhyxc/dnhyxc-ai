/**
 * 经典句整集标注进度页：列出全部任务 + 进度条与明细。
 */
import { Button, Spinner } from '@ui/index';
import { Toast } from '@ui/sonner';
import { ArrowLeft, Play, Trash2, X } from 'lucide-react';
import { observer } from 'mobx-react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { Progress } from '@/components/ui/progress';
import { useI18n } from '@/hooks';
import { cn } from '@/lib/utils';
import EnglishAnnotateSource, {
	type AnnotateTask,
	annotateTaskPercent,
} from '@/store/englishAnnotateSource';
import { getRequestErrorMessage } from '@/utils/fetch';

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

const TaskCard = observer(function TaskCard({ task }: { task: AnnotateTask }) {
	const { t } = useI18n();
	const [busy, setBusy] = useState(false);
	const p = task.progress;
	const percent = annotateTaskPercent(task);
	const streaming = EnglishAnnotateSource.hasOpenStream(task.id);
	const partialFailed =
		task.status === 'error' && (task.progress?.failed ?? 0) > 0;
	const sourceLabel =
		task.source === 'library'
			? t('englishLearning.annotateTasks.sourceLibrary')
			: t('englishLearning.annotateTasks.sourcePack');

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
		<article
			className={cn(
				'rounded-lg border border-theme/10 bg-theme-secondary/30 px-4 py-3.5 space-y-3',
				task.status === 'running' && streaming && 'border-teal-500/20',
				(task.status === 'paused' ||
					(task.status === 'running' && !streaming) ||
					partialFailed) &&
					'border-amber-500/20',
				task.status === 'error' && !partialFailed && 'border-rose-500/20',
			)}
		>
			<div className="flex items-start justify-between gap-3">
				<div className="min-w-0 space-y-1">
					<h2 className="truncate text-sm font-medium text-textcolor">
						{task.title}
					</h2>
					<p className="text-xs text-textcolor/55">
						{sourceLabel}
						{' · '}
						<span
							className={cn(
								task.status === 'running' &&
									streaming &&
									'text-teal-600 dark:text-teal-400',
								task.status === 'done' &&
									'text-emerald-600 dark:text-emerald-400',
								task.status === 'error' &&
									!partialFailed &&
									'text-rose-600 dark:text-rose-400',
								(task.status === 'paused' ||
									(task.status === 'running' && !streaming) ||
									partialFailed) &&
									'text-amber-600 dark:text-amber-400',
							)}
						>
							{task.status === 'running' && !streaming
								? t('englishLearning.annotateTasks.statusPaused')
								: statusLabel(task, t)}
						</span>
					</p>
				</div>
				<div className="flex shrink-0 items-center gap-1.5">
					{task.status === 'running' && streaming ? (
						<Button
							type="button"
							size="sm"
							variant="outline"
							className="h-8 gap-1.5 border-rose-500/20 bg-rose-500/10 text-rose-600 hover:bg-rose-500/15 dark:text-rose-400"
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
							className="h-8 gap-1.5 border-teal-500/25 bg-teal-500/10 text-teal-600 hover:bg-teal-500/15 dark:text-teal-300"
							onClick={() => void onResume()}
						>
							{busy ? (
								<Spinner className="size-3.5 text-rose-500" />
							) : (
								<Play className="size-3.5" />
							)}
							{t('englishLearning.annotateTasks.resume')}
						</Button>
					) : null}
					{task.status !== 'running' || !streaming ? (
						<Button
							type="button"
							size="sm"
							variant="ghost"
							className="h-8 w-8 p-0 text-textcolor/50 hover:text-textcolor"
							aria-label={t('englishLearning.annotateTasks.dismiss')}
							onClick={() => EnglishAnnotateSource.dismiss(task.id)}
						>
							<X className="size-3.5" />
						</Button>
					) : null}
				</div>
			</div>

			<div className="space-y-2">
				<div className="flex items-center justify-between gap-2 text-xs tabular-nums text-textcolor/70">
					<span>
						{p
							? t('englishLearning.annotateSource.progress', {
									hit: p.hit,
									annotated: p.annotated,
									miss: p.miss || p.remaining,
									remaining: p.remaining,
								})
							: t('englishLearning.annotateSource.preparing')}
					</span>
					<span className="shrink-0 font-medium text-textcolor/80">
						{percent}%
					</span>
				</div>
				<Progress value={percent} className="h-2" />
			</div>

			{p ? (
				<dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs sm:grid-cols-3">
					<div className="flex justify-between gap-2 sm:flex-col sm:justify-start">
						<dt className="text-textcolor/45">
							{t('englishLearning.annotateTasks.metricTotal')}
						</dt>
						<dd className="tabular-nums text-textcolor/80">{p.total}</dd>
					</div>
					<div className="flex justify-between gap-2 sm:flex-col sm:justify-start">
						<dt className="text-textcolor/45">
							{t('englishLearning.annotateTasks.metricHit')}
						</dt>
						<dd className="tabular-nums text-textcolor/80">{p.hit}</dd>
					</div>
					<div className="flex justify-between gap-2 sm:flex-col sm:justify-start">
						<dt className="text-textcolor/45">
							{t('englishLearning.annotateTasks.metricAnnotated')}
						</dt>
						<dd className="tabular-nums text-textcolor/80">{p.annotated}</dd>
					</div>
					<div className="flex justify-between gap-2 sm:flex-col sm:justify-start">
						<dt className="text-textcolor/45">
							{t('englishLearning.annotateTasks.metricFailed')}
						</dt>
						<dd className="tabular-nums text-textcolor/80">{p.failed}</dd>
					</div>
					<div className="flex justify-between gap-2 sm:col-span-2 sm:flex-col sm:justify-start">
						<dt className="text-textcolor/45">
							{t('englishLearning.annotateTasks.metricTokens')}
						</dt>
						<dd
							className="tabular-nums text-textcolor/80"
							title={t('englishLearning.annotateTasks.metricTokensDetail', {
								prompt: p.tokensPrompt ?? 0,
								completion: p.tokensCompletion ?? 0,
							})}
						>
							{t('englishLearning.annotateTasks.metricTokensValue', {
								total: p.tokensTotal ?? 0,
								prompt: p.tokensPrompt ?? 0,
								completion: p.tokensCompletion ?? 0,
							})}
						</dd>
					</div>
				</dl>
			) : null}

			{task.errorMessage ? (
				<p className="text-xs text-rose-600 dark:text-rose-400">
					{task.errorMessage}
				</p>
			) : null}
		</article>
	);
});

function AnnotateTasksPageInner() {
	const { t } = useI18n();
	const navigate = useNavigate();
	const tasks = EnglishAnnotateSource.orderedTasks;
	const running = EnglishAnnotateSource.runningCount;
	const hasFinished = tasks.some(
		(x) => x.status === 'done' || x.status === 'error',
	);

	useEffect(() => {
		void EnglishAnnotateSource.hydrate();
	}, []);

	return (
		<div className="mx-auto flex h-full min-h-0 w-full max-w-2xl flex-col px-4 py-5 sm:px-6">
			<header className="mb-5 flex shrink-0 items-start justify-between gap-3">
				<div className="min-w-0 space-y-1">
					<div className="flex items-center gap-2">
						<Button
							type="button"
							variant="ghost"
							size="sm"
							className="h-8 w-8 shrink-0 p-0"
							aria-label={t('englishLearning.annotateTasks.back')}
							onClick={() => navigate(-1)}
						>
							<ArrowLeft className="size-4" />
						</Button>
						<h1 className="truncate text-lg font-semibold text-textcolor">
							{t('englishLearning.annotateTasks.pageTitle')}
						</h1>
					</div>
					<p className="pl-10 text-xs text-textcolor/55">
						{running > 0
							? t('englishLearning.annotateTasks.pageRunningHint', {
									count: running,
								})
							: t('englishLearning.annotateTasks.pageIdleHint')}
					</p>
				</div>
				{hasFinished ? (
					<Button
						type="button"
						variant="ghost"
						size="sm"
						className="h-8 shrink-0 gap-1.5 text-textcolor/60"
						onClick={() => EnglishAnnotateSource.dismissFinished()}
					>
						<Trash2 className="size-3.5" />
						{t('englishLearning.annotateTasks.clearFinished')}
					</Button>
				) : null}
			</header>

			<div className="min-h-0 flex-1 space-y-3 overflow-y-auto pb-8">
				{tasks.length === 0 ? (
					<p className="rounded-lg border border-dashed border-theme/15 px-4 py-10 text-center text-sm text-textcolor/50">
						{t('englishLearning.annotateTasks.empty')}
					</p>
				) : (
					tasks.map((task) => <TaskCard key={task.id} task={task} />)
				)}
			</div>
		</div>
	);
}

export default observer(AnnotateTasksPageInner);
