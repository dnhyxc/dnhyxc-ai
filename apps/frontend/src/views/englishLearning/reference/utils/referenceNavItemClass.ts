import { cn } from '@/lib/utils';

/** 参考页左侧导航项（背景高亮，无描边） */
export function referenceNavItemClass(active: boolean, className?: string) {
	return cn(
		'transition-colors cursor-pointer',
		active ? 'text-teal-500' : 'text-textcolor/80',
		className,
	);
}
