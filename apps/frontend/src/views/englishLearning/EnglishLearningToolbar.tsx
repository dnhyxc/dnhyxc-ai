/**
 * 英语学习左栏：学习设置（卡片化 + 分段难度 + 规整快捷意图）
 */
import { Button } from '@ui/index';
import { Languages, RefreshCw, Sparkles } from 'lucide-react';
import { observer } from 'mobx-react';
import { type ReactNode, useMemo } from 'react';
import { useI18n } from '@/hooks';
import { cn } from '@/lib/utils';
import englishAgentStore, { type EnglishLevelTier } from '@/store/englishAgent';

const LEVEL_KEYS: EnglishLevelTier[] = ['basic', 'intermediate', 'advanced'];

const chipDefs = [
	{
		key: 'vocabulary',
		labelKey: 'englishLearning.chip.vocabulary' as const,
		prefixKey: 'englishLearning.intent.vocabulary' as const,
	},
	{
		key: 'translate',
		labelKey: 'englishLearning.chip.translate' as const,
		prefixKey: 'englishLearning.intent.translate' as const,
	},
	{
		key: 'reading',
		labelKey: 'englishLearning.chip.reading' as const,
		prefixKey: 'englishLearning.intent.reading' as const,
	},
	{
		key: 'literature',
		labelKey: 'englishLearning.chip.literature' as const,
		prefixKey: 'englishLearning.intent.literature' as const,
	},
	{
		key: 'grammar',
		labelKey: 'englishLearning.chip.grammar' as const,
		prefixKey: 'englishLearning.intent.grammar' as const,
	},
] as const;

/** 左栏内统一卡片容器 */
function SidebarPanel({
	children,
	className,
}: {
	children: ReactNode;
	className?: string;
}) {
	return (
		<div
			className={cn(
				'border-theme/10 bg-theme-background shadow-sm',
				'rounded-2xl border p-4',
				'ring-1 ring-black/3 dark:ring-white/6',
				className,
			)}
		>
			{children}
		</div>
	);
}

export const EnglishLearningToolbar = observer(function EnglishLearningToolbar({
	onNewChat,
}: {
	onNewChat: () => void;
}) {
	const { t } = useI18n();

	const levelLabel = useMemo(
		() => t(`englishLearning.level.${englishAgentStore.levelTier}`),
		[t, englishAgentStore.levelTier],
	);

	return (
		<SidebarPanel>
			{/* 标题区 */}
			<div className="mb-5 flex items-start justify-between gap-3">
				<div className="flex min-w-0 gap-3">
					<div className="flex size-11 shrink-0 items-center justify-center rounded-2xl border border-teal-500/25 bg-teal-500/12">
						<Languages
							className="size-[22px] text-teal-600 dark:text-teal-400"
							aria-hidden
						/>
					</div>
					<div className="min-w-0 pt-0.5">
						<h1 className="text-textcolor leading-tight font-semibold tracking-tight">
							{t('route.englishLearning.title')}
						</h1>
						<p className="text-textcolor/50 mt-1 text-[11px] leading-snug">
							{t('englishLearning.toolbarSubtitleShort', { level: levelLabel })}
						</p>
					</div>
				</div>
				<Button
					type="button"
					size="sm"
					variant="outline"
					className="border-theme/18 text-textcolor/80 hover:bg-theme/8 h-9 shrink-0 gap-1.5 px-2.5 text-xs"
					onClick={onNewChat}
					title={t('englishLearning.newChat')}
				>
					<RefreshCw className="size-3.5" aria-hidden />
					<span className="hidden min-[340px]:inline">
						{t('englishLearning.newChat')}
					</span>
				</Button>
			</div>

			{/* 难度：分段控件 */}
			<div className="mb-5">
				<p className="text-textcolor/45 mb-2 text-[11px] font-medium tracking-wide">
					{t('englishLearning.levelLabel')}
				</p>
				<div
					className="bg-theme-secondary/70 grid grid-cols-3 gap-0.5 rounded-xl p-1"
					role="tablist"
					aria-label={t('englishLearning.levelLabel')}
				>
					{LEVEL_KEYS.map((tier) => {
						const active = englishAgentStore.levelTier === tier;
						return (
							<button
								key={tier}
								type="button"
								role="tab"
								aria-selected={active}
								onClick={() => englishAgentStore.setLevelTier(tier)}
								className={cn(
									'rounded-lg px-1 py-2 text-center text-[11px] font-medium transition-all duration-150 sm:text-xs',
									active
										? 'bg-theme-background text-textcolor shadow-sm ring-1 ring-theme/8'
										: 'text-textcolor/60 hover:text-textcolor/90',
								)}
							>
								{t(`englishLearning.level.${tier}`)}
							</button>
						);
					})}
				</div>
			</div>

			{/* 快捷意图：两列对齐 */}
			<div className="mb-4">
				<p className="text-textcolor/45 mb-2 flex items-center gap-1.5 text-[11px] font-medium tracking-wide">
					<Sparkles className="size-3.5 shrink-0 opacity-60" aria-hidden />
					{t('englishLearning.quickIntents')}
				</p>
				<div className="grid grid-cols-2 gap-2">
					{chipDefs.map((c) => {
						const active =
							englishAgentStore.pendingIntentPrefix === t(c.prefixKey);
						return (
							<button
								key={c.key}
								type="button"
								className={cn(
									'rounded-xl border px-2.5 py-2 text-left text-[11px] font-medium leading-snug transition-colors sm:text-xs',
									active
										? 'border-teal-500/35 bg-teal-500/10 text-textcolor'
										: 'border-theme/10 bg-theme-secondary/50 text-textcolor/75 hover:border-theme/18 hover:bg-theme-secondary/80',
								)}
								onClick={() =>
									englishAgentStore.setIntentPrefix(t(c.prefixKey))
								}
							>
								{t(c.labelKey)}
							</button>
						);
					})}
				</div>
			</div>

			{englishAgentStore.pendingIntentPrefix ? (
				<div className="border-teal-500/20 bg-teal-500/5 mb-4 rounded-xl border px-3 py-2.5">
					<p className="text-teal-700/85 dark:text-teal-400/90 mb-1 text-[10px] font-semibold uppercase tracking-wider">
						{t('englishLearning.pendingIntentShort')}
					</p>
					<p className="text-textcolor/80 line-clamp-5 text-[11px] leading-relaxed">
						{englishAgentStore.pendingIntentPrefix}
					</p>
				</div>
			) : null}

			<p className="text-textcolor/40 border-theme/8 border-t pt-3 text-center text-[10px] leading-relaxed">
				{t('englishLearning.disclaimerShort')}
			</p>
		</SidebarPanel>
	);
});
