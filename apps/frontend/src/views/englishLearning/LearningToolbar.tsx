/**
 * 英语学习左栏：学习设置（卡片化 + 快捷意图）
 */
import { Languages } from 'lucide-react';
import { observer } from 'mobx-react';
import { type ReactNode } from 'react';
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
		<div className={cn('rounded-none px-4 pb-4', className)}>{children}</div>
	);
}

export const EnglishLearningToolbar = observer(
	function EnglishLearningToolbar() {
		const { t } = useI18n();

		return (
			<SidebarPanel className="min-w-0">
				{/* 标题区 */}
				<div className="mb-4 flex items-start gap-3">
					<div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-linear-to-r from-cyan-500 to-blue-600">
						<Languages className="size-6 text-textcolor" aria-hidden />
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
				 * 快捷意图：按本卡片（容器查询）宽度弹性列数——极窄单列，随宽度增加自动多列。
				 * auto-fill + minmax：列最小约 7.25rem，放不下则自动降为 1 列。
				 */}
				<div className="mb-4 min-w-0">
					<div className="text-textcolor/45 mb-2 flex items-center gap-1.5 text-sm font-medium tracking-wide">
						{t('englishLearning.quickIntents')}
					</div>
					<div
						className={cn(
							'grid min-w-0 gap-2.5',
							'grid-cols-[repeat(auto-fill,minmax(min(100%,7.25rem),1fr))]',
						)}
					>
						{chipDefs.map((c) => {
							return (
								<Button
									key={c.key}
									variant="link"
									size="sm"
									className={cn(
										'border border-theme/10 bg-theme/5',
										englishAgentStore.pendingIntentPrefix === t(c.prefixKey)
											? 'text-teal-500 border-teal-500/20'
											: 'text-textcolor/60 hover:text-textcolor/90',
									)}
									onClick={() =>
										englishAgentStore.setIntentPrefix(t(c.prefixKey))
									}
								>
									{t(c.labelKey)}
								</Button>
							);
						})}
					</div>
				</div>

				{englishAgentStore.pendingIntentPrefix ? (
					<div className="bg-teal-500/10 rounded-md px-3 py-2.5 border border-theme/10">
						<div className="text-teal-700/85 dark:text-teal-400/90 mb-1 text-sm font-semibold uppercase tracking-wider">
							{t('englishLearning.pendingIntentShort')}
						</div>
						<div className="text-textcolor/80 line-clamp-5 text-sm leading-relaxed">
							{englishAgentStore.pendingIntentPrefix}
						</div>
					</div>
				) : null}
			</SidebarPanel>
		);
	},
);
