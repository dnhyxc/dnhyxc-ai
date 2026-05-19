/**
 * 英语学习左栏：学习设置（卡片化 + 快捷意图）
 */
import { CircleChevronDown, CircleChevronRight, Cog } from 'lucide-react';
import { observer } from 'mobx-react';
import { type ReactNode, useMemo, useState } from 'react';
import { Button } from '@/components/ui';
import { useI18n } from '@/hooks';
import { cn } from '@/lib/utils';
import englishAgentStore from '@/store/englishAgent';

const chipDefs = [
	{
		key: 'vocabulary',
		labelKey: 'englishLearning.chip.vocabulary' as const,
		prefixKey: 'englishLearning.intent.vocabulary' as const,
	},
	{
		key: 'morphology',
		labelKey: 'englishLearning.chip.morphology' as const,
		prefixKey: 'englishLearning.intent.morphology' as const,
	},
	{
		key: 'translate',
		labelKey: 'englishLearning.chip.translate' as const,
		prefixKey: 'englishLearning.intent.translate' as const,
	},
	{
		key: 'pronunciation',
		labelKey: 'englishLearning.chip.pronunciation' as const,
		prefixKey: 'englishLearning.intent.pronunciation' as const,
	},
	{
		key: 'collocations',
		labelKey: 'englishLearning.chip.collocations' as const,
		prefixKey: 'englishLearning.intent.collocations' as const,
	},
	{
		key: 'confusables',
		labelKey: 'englishLearning.chip.confusables' as const,
		prefixKey: 'englishLearning.intent.confusables' as const,
	},
	{
		key: 'speaking',
		labelKey: 'englishLearning.chip.speaking' as const,
		prefixKey: 'englishLearning.intent.speaking' as const,
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

/** 折叠态默认展示的快捷意图条数（展开后展示全部） */
const QUICK_INTENTS_COLLAPSED_VISIBLE = 2;

/** 快捷意图与输入框联动：选中填入意图名，取消选中时由父级移除自动填入片段 */
export type QuickIntentInputSyncPayload =
	| { mode: 'select'; label: string }
	| { mode: 'clear' };

/** 左栏内统一卡片容器 */
function SidebarPanel({
	children,
	className,
}: {
	children: ReactNode;
	className?: string;
}) {
	return (
		<div className={cn('rounded-none px-4 pb-3', className)}>{children}</div>
	);
}

type EnglishLearningToolbarProps = {
	onQuickIntentInputSync?: (payload: QuickIntentInputSyncPayload) => void;
};

export const EnglishLearningToolbar = observer(function EnglishLearningToolbar({
	onQuickIntentInputSync,
}: EnglishLearningToolbarProps) {
	const { t } = useI18n();
	const [quickIntentsExpanded, setQuickIntentsExpanded] = useState(false);

	const showIntentExpandToggle =
		chipDefs.length > QUICK_INTENTS_COLLAPSED_VISIBLE;

	const visibleChipDefs = useMemo(() => {
		if (quickIntentsExpanded || !showIntentExpandToggle) {
			return chipDefs;
		}
		return chipDefs.slice(0, QUICK_INTENTS_COLLAPSED_VISIBLE);
	}, [quickIntentsExpanded, showIntentExpandToggle]);

	return (
		<SidebarPanel className="min-w-0">
			{/* 标题区 */}
			<div className="mb-2.5 flex items-start gap-3">
				<div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-linear-to-r from-lime-600 to-green-700">
					<Cog className="size-6 text-white" aria-hidden />
				</div>
				<div className="min-w-0">
					<div className="text-textcolor leading-tight font-semibold tracking-tight">
						{t('route.englishLearning.subtitle')}
					</div>
					<div className="text-textcolor/50 mt-1 text-xs leading-snug">
						{t('englishLearning.toolbarSubtitleShort')}
					</div>
				</div>
			</div>

			{/*
			 * 快捷意图：默认折叠仅展示前 2 条；点击右侧与单词列表一致的箭头展开全部。
			 * 条数不超过 2 时不显示折叠按钮。网格按容器宽度弹性列数。
			 */}
			<div className="min-w-0">
				<div className="mb-0.5 flex min-h-6 items-center justify-between gap-2">
					<div className="text-textcolor/45 flex items-center gap-1.5 text-sm font-medium tracking-wide">
						{t('englishLearning.quickIntents')}
					</div>
					{showIntentExpandToggle ? (
						<Button
							type="button"
							variant="link"
							size="sm"
							className="text-textcolor/55 hover:text-textcolor mt-0.5 -mr-2 h-8 w-8 shrink-0 p-0!"
							onClick={() => setQuickIntentsExpanded((v) => !v)}
							aria-expanded={quickIntentsExpanded}
							aria-label={
								quickIntentsExpanded
									? t('englishLearning.quickIntentsCollapse')
									: t('englishLearning.quickIntentsExpand')
							}
						>
							{quickIntentsExpanded ? (
								<CircleChevronDown
									className="h-full w-full transition-transform duration-200"
									aria-hidden
								/>
							) : (
								<CircleChevronRight
									className="h-full w-full transition-transform duration-200"
									aria-hidden
								/>
							)}
						</Button>
					) : null}
				</div>
				<div
					className={cn(
						'grid min-w-0 gap-3.5',
						'grid-cols-[repeat(auto-fill,minmax(min(100%,7.25rem),1fr))]',
					)}
				>
					{visibleChipDefs.map((c) => {
						const prefix = t(c.prefixKey);
						const selected = englishAgentStore.pendingIntentPrefix === prefix;
						return (
							<Button
								key={c.key}
								variant="outline"
								aria-pressed={selected}
								className={cn(
									'h-9 border-none bg-linear-to-r from-lime-600 to-green-700 text-lime-50',
									'hover:bg-linear-to-r hover:from-lime-400 hover:to-green-500 hover:text-lime-800',
									selected &&
										'bg-linear-to-r from-lime-400 to-green-500 text-lime-800',
								)}
								onClick={() => {
									if (selected) {
										englishAgentStore.setIntentPrefix('');
										onQuickIntentInputSync?.({ mode: 'clear' });
									} else {
										englishAgentStore.setIntentPrefix(prefix);
										onQuickIntentInputSync?.({
											mode: 'select',
											label: t(c.labelKey),
										});
									}
								}}
							>
								{t(c.labelKey)}
							</Button>
						);
					})}
				</div>
			</div>

			{englishAgentStore.pendingIntentPrefix ? (
				<div className="mt-2.5 bg-linear-to-r from-lime-400/8 to-green-500/8 rounded-md px-3 py-2.5 border border-theme/10">
					<div className="text-teal-700/85 mb-1 text-sm font-semibold uppercase tracking-wider">
						{t('englishLearning.pendingIntentShort')}
					</div>
					<div className="text-textcolor/80 line-clamp-5 text-sm leading-relaxed">
						{englishAgentStore.pendingIntentPrefix}
					</div>
				</div>
			) : null}
		</SidebarPanel>
	);
});
