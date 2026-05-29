/**
 * 侧边栏入口：拉取进度 + 跳转至拉取结果页（流式进行中或已有条目时展示）
 */
import { Button } from '@ui/index';
import { ExternalLink, Globe } from 'lucide-react';
import { observer } from 'mobx-react';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import SearchOrganics from '@/components/design/ChatAssistantMessage/SearchOrganics';
import { useI18n } from '@/hooks';
import { cn } from '@/lib/utils';
import EnglishPackStore from '@/store/englishPack';
import type { PackStreamKind } from '../types';

type PackStreamLiveLinkProps = {
	kind: PackStreamKind;
	className?: string;
};

function PackStreamLiveLinkInner({ kind, className }: PackStreamLiveLinkProps) {
	const { t } = useI18n();
	const navigate = useNavigate();
	const [webSearchDrawerOpen, setWebSearchDrawerOpen] = useState(false);

	const loading =
		kind === 'vocab'
			? EnglishPackStore.vocabLoading
			: EnglishPackStore.classicLoading;
	const items =
		kind === 'vocab'
			? EnglishPackStore.vocabItems
			: EnglishPackStore.classicItems;
	const progress =
		kind === 'vocab'
			? EnglishPackStore.vocabProgress
			: EnglishPackStore.classicProgress;
	const agentToolLine =
		kind === 'vocab'
			? EnglishPackStore.vocabAgentToolLine
			: EnglishPackStore.classicAgentToolLine;
	const masterSearchOrganic =
		kind === 'vocab'
			? EnglishPackStore.vocabMasterSearchOrganic
			: EnglishPackStore.classicMasterSearchOrganic;

	const count = items.length;
	const webSearchCount = masterSearchOrganic.length;
	const show = loading || count > 0;
	if (!show) {
		return null;
	}

	const isVocab = kind === 'vocab';
	const progressKey = isVocab
		? 'englishLearning.vocab.progress'
		: 'englishLearning.classic.progress';
	const accentBar = isVocab ? 'bg-teal-500/85' : 'bg-violet-500/85';
	const accentToolLine = isVocab
		? 'text-teal-600/90 dark:text-teal-400/90'
		: 'text-indigo-600/90 dark:text-indigo-400/90';
	const accentBorder = isVocab
		? 'border-teal-500/6 bg-linear-to-r from-teal-500/18 to-cyan-600/18'
		: 'border-violet-500/6 bg-linear-to-r from-violet-500/18 to-indigo-600/18';
	const bgColor = isVocab
		? 'bg-linear-to-r from-teal-500/35 to-cyan-600/30'
		: 'bg-linear-to-r from-violet-500/30 to-indigo-600/30';

	return (
		<div
			className={cn(
				'rounded-md border px-3 py-2.5 space-y-2',
				accentBorder,
				className,
			)}
		>
			{loading && progress ? (
				<div className="space-y-2">
					{agentToolLine ? (
						<div className={cn('text-xs leading-snug', accentToolLine)}>
							{agentToolLine}
						</div>
					) : null}
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
			) : count > 0 ? (
				<p className="text-textcolor/70 text-xs leading-snug">
					{t('englishLearning.stream.liveSummaryCount', { count })}
				</p>
			) : null}
			<div className="flex min-w-0 items-stretch gap-3">
				<Button
					type="button"
					size="sm"
					variant="outline"
					className={cn(
						'h-8 min-w-0 pb-0.5 items-center border-none flex-1 justify-center gap-1.5 px-2 text-xs',
						bgColor,
					)}
					onClick={() => {
						const activeStreamId =
							kind === 'vocab'
								? EnglishPackStore.vocabActiveStreamId
								: EnglishPackStore.classicActiveStreamId;
						const q = new URLSearchParams({ kind });
						if (activeStreamId) {
							q.set('streamId', activeStreamId);
						}
						navigate(`/english-learning/stream?${q.toString()}`);
					}}
				>
					<ExternalLink className="size-3.5 shrink-0 opacity-70" aria-hidden />
					<span className="truncate">
						{t('englishLearning.stream.openLivePage')}
					</span>
				</Button>
				{webSearchCount > 0 ? (
					<Button
						type="button"
						size="sm"
						variant="outline"
						className={cn(
							'h-8 min-w-0 pb-0.5 flex-1 items-center justify-center gap-1.5 border-none px-2 text-xs',
							bgColor,
						)}
						onClick={() => setWebSearchDrawerOpen(true)}
					>
						<Globe className="size-3.5 mt-px shrink-0 opacity-70" aria-hidden />
						<span className="truncate">
							{t('englishLearning.webSearch.viewWebPages')}
						</span>
						<span className="mt-0.5">{webSearchCount}</span>
					</Button>
				) : null}
			</div>
			{webSearchCount > 0 ? (
				<SearchOrganics
					open={webSearchDrawerOpen}
					onOpenChange={setWebSearchDrawerOpen}
					organics={masterSearchOrganic}
					title={t('englishLearning.webSearch.viewPagesTitle', {
						n: webSearchCount,
					})}
					t={t}
				/>
			) : null}
		</div>
	);
}

export const PackStreamLiveLink = observer(PackStreamLiveLinkInner);
