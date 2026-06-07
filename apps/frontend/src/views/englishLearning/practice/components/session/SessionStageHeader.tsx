/**
 * 单题练习卡 — 顶栏（模式图标 + 标题）
 */
import type { SessionStageHeaderProps } from '../../types';

export function SessionStageHeader({
	icon,
	title,
	trailing,
}: SessionStageHeaderProps) {
	return (
		<div className="border-theme/10 bg-teal-500/10 flex shrink-0 items-center gap-2.5 border-b px-4 py-2.5">
			<div className="bg-teal-500/15 text-teal-600 dark:text-teal-400 flex size-8 shrink-0 items-center justify-center rounded-md">
				{icon}
			</div>
			<span className="text-textcolor min-w-0 flex-1 text-sm font-semibold">
				{title}
			</span>
			{trailing ? (
				<div className="flex shrink-0 items-center">{trailing}</div>
			) : null}
		</div>
	);
}
