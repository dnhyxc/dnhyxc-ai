import { Puzzle } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import { resolveCosUrlForWebDisplay } from '@/utils';
import { isPluginIconUrl } from './pluginIconUrl';

export type PluginIconProps = {
	/** registry `menu.icon` / `host.icon`：图片 URL */
	name?: string;
	className?: string;
};

/**
 * 子应用图标：仅按 URL 渲染；非 URL / 加载失败回退 Puzzle。
 */
export function PluginIcon({ name, className }: PluginIconProps) {
	const [failed, setFailed] = useState(false);
	const url = isPluginIconUrl(name)
		? resolveCosUrlForWebDisplay(name!.trim())
		: '';

	if (!url || failed) {
		return <Puzzle className={cn('size-4 shrink-0', className)} aria-hidden />;
	}

	return (
		<img
			src={url}
			alt=""
			className={cn('size-4 shrink-0 object-contain', className)}
			draggable={false}
			onError={() => setFailed(true)}
		/>
	);
}
