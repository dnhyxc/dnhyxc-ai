/**
 * 拉取进度条（单词 / 经典句共用结构，配色由 kind 区分）
 */
import { Button, Spinner } from '@ui/index';
import { observer } from 'mobx-react';
import { useI18n } from '@/hooks';
import { cn } from '@/lib/utils';
import EnglishPackStore from '@/store/englishPack';
import type { PackStreamKind } from './PackStreamKindTabs';

type PackStreamProgressProps = {
	kind: PackStreamKind;
};

function PackStreamProgressInner({ kind }: PackStreamProgressProps) {
	const { t } = useI18n();
	const loading =
		kind === 'vocab'
			? EnglishPackStore.vocabLoading
			: EnglishPackStore.classicLoading;
	const progress =
		kind === 'vocab'
			? EnglishPackStore.vocabProgress
			: EnglishPackStore.classicProgress;
	const agentToolLine =
		kind === 'vocab'
			? EnglishPackStore.vocabAgentToolLine
			: EnglishPackStore.classicAgentToolLine;

	if (!loading || !progress) {
		return null;
	}

	const accentBar = kind === 'vocab' ? 'bg-teal-500/85' : 'bg-violet-500/85';
	const accentText =
		kind === 'vocab'
			? 'text-teal-600/90 dark:text-teal-400/90'
			: 'text-indigo-600/90 dark:text-indigo-400/90';
	const progressKey =
		kind === 'vocab'
			? 'englishLearning.vocab.progress'
			: 'englishLearning.classic.progress';
	const stopKey =
		kind === 'vocab'
			? 'englishLearning.vocab.stop'
			: 'englishLearning.classic.stop';

	const onStop = () => {
		if (kind === 'vocab') {
			EnglishPackStore.vocabCancelByUser();
		} else {
			EnglishPackStore.classicCancelByUser();
		}
	};

	return (
		<div className="border border-theme/10 space-y-3 rounded-md bg-theme-secondary/40 px-4 py-3">
			{agentToolLine ? (
				<div className={cn('text-xs leading-snug', accentText)}>
					{agentToolLine}
				</div>
			) : null}
			<div className="flex items-center justify-between">
				<div className="flex flex-col gap-2 flex-1 mr-4">
					<div className="text-textcolor/70 text-xs leading-snug">
						{t(progressKey, {
							collected: progress.collected,
							target: progress.target,
							round: progress.round,
						})}
					</div>
					<div className="bg-theme/10 h-1.5 w-full overflow-hidden rounded-md">
						<div
							className={cn(
								'h-full rounded-md transition-[width] duration-300 ease-out',
								accentBar,
							)}
							style={{
								width: `${Math.min(
									100,
									(progress.collected / Math.max(1, progress.target)) * 100,
								)}%`,
							}}
						/>
					</div>
				</div>
				<Button
					type="button"
					size="sm"
					onClick={onStop}
					className="h-8 pb-0.5 bg-linear-to-r from-rose-600/80 to-rose-600/80 hover:bg-linear-to-r hover:from-rose-500/80 hover:to-rose-600/80 text-white"
				>
					<Spinner className="size-3.5 shrink-0 text-white" />
					<span>{t(stopKey)}</span>
				</Button>
			</div>
		</div>
	);
}

export const PackStreamProgress = observer(PackStreamProgressInner);
