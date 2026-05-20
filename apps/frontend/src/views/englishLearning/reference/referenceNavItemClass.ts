import { cn } from '@/lib/utils';

/** 参考页左侧导航项（背景高亮，无描边） */
export function referenceNavItemClass(active: boolean, className?: string) {
	return cn(
		'transition-colors cursor-pointer',
		active
			? 'bg-theme/15 text-textcolor'
			: 'text-textcolor/80 hover:bg-theme/12',
		className,
	);
}
