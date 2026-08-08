/**
 * 插件独立路由页的 Host 统一外壳（边距 + 圆角内容区）。
 * 业务内嵌挂载不要用；影院全屏时收起边距以免挡画面。
 *
 * 勿在圆角容器上写 overflow-hidden：与 border-radius 同层时，
 * Chromium 会让子树 backdrop-filter 采不到更深的 video（本地独立跑正常、MF 嵌入失效）。
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
					'h-full min-h-0 bg-theme-background overflow-auto',
					theater ? 'rounded-none p-0' : 'rounded-md',
				)}
			>
				{children}
			</div>
		</div>
	);
}
