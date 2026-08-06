/**
 * 插件独立路由页的 Host 统一外壳（边距 + 圆角内容区）。
 * 业务内嵌挂载不要用；影院全屏时收起边距以免挡画面。
 */
import { type ReactNode, useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import {
	getAppFullscreen,
	subscribeAppFullscreen,
} from '../host-api/appFullscreen';

export function PluginPageShell({
	children,
	className,
}: {
	children: ReactNode;
	className?: string;
}) {
	const [theater, setTheater] = useState(getAppFullscreen);
	useEffect(() => subscribeAppFullscreen(setTheater), []);

	return (
		<div
			className={cn(
				'mx-auto flex h-full min-h-0 flex-col',
				theater ? 'p-0' : 'p-5.5 pt-0',
				className,
			)}
		>
			<div
				className={cn(
					'h-full min-h-0 overflow-hidden bg-theme-background',
					theater ? 'rounded-none  p-0' : 'rounded-md',
				)}
			>
				{children}
			</div>
		</div>
	);
}
