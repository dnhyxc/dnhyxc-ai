/**
 * 统一 Host Surface 模版：抽屉 / 顶栏触发器 / 内联 toolbar。
 * 插件内容一律走 PluginHostPage，保证 loading/error/隔离 UI 与路由页一致。
 */
import { Drawer } from '@design/Drawer';
import Tooltip from '@design/Tooltip';
import {
	claimPluginPortalTarget,
	clearPluginPortalClaim,
	type PluginDescriptor,
	pickPluginLocaleText,
	styleRealmKey,
} from '@dnhyxc-ai/federation-kit';
import { useHostSurfacePlugins } from '@dnhyxc-ai/federation-kit/react';
import { Button } from '@ui/index';
import { type CSSProperties, useEffect } from 'react';
import { useI18n } from '@/hooks';
import { cn } from '@/lib/utils';
import { PluginHostPage } from './PluginHostPage';
import { PluginIcon } from './PluginIcon';

export type PluginHostSurfacePart = 'toolbar' | 'drawer-triggers' | 'drawer';

export type PluginHostSurfaceProps = {
	/** registry `host.surface`，如 `ebook.read` */
	surface: string;
	/**
	 * - toolbar：slot=toolbar，顶栏内联 PluginHostPage
	 * - drawer-triggers：slot=drawer，顶栏图标按钮
	 * - drawer：slot=drawer，底部 Drawer + PluginHostPage
	 */
	part: PluginHostSurfacePart;
	openPluginId?: string | null;
	onOpenPluginIdChange?: (id: string | null) => void;
	chromeStyle?: CSSProperties;
	/** 过滤/排序；默认按 registry order */
	filterPlugins?: (list: PluginDescriptor[]) => PluginDescriptor[];
	className?: string;
	triggerClassName?: string;
	drawerBodyClassName?: string;
};

/**
 * 业务页插件槽统一模版。
 * 新增同 surface 插件只需改 registry，不必再写一套 Drawer/触发器。
 */
export function PluginHostSurface({
	surface,
	part,
	openPluginId = null,
	onOpenPluginIdChange,
	chromeStyle,
	filterPlugins,
	className,
	triggerClassName,
	drawerBodyClassName = 'py-2 pl-0',
}: PluginHostSurfaceProps) {
	const { locale } = useI18n();
	const listed = useHostSurfacePlugins(surface);
	const all = filterPlugins ? filterPlugins(listed) : listed;
	const drawerPlugins = all.filter((p) => p.host?.slot === 'drawer');
	const toolbarPlugins = all.filter((p) => p.host?.slot === 'toolbar');

	useEffect(() => {
		if (part !== 'drawer-triggers' && part !== 'drawer') return;
		if (
			openPluginId &&
			!drawerPlugins.some((p) => p.id === openPluginId) &&
			onOpenPluginIdChange
		) {
			onOpenPluginIdChange(null);
		}
	}, [drawerPlugins, openPluginId, onOpenPluginIdChange, part]);

	/** 渲染顶栏插件 */
	if (part === 'toolbar') {
		if (toolbarPlugins.length === 0) return null;
		return (
			<div className={cn('contents', className)}>
				{toolbarPlugins.map((p) => (
					<div
						key={p.id}
						className="flex min-w-0 shrink items-center"
						data-plugin-host-slot="toolbar"
						data-plugin-host-surface={surface}
						data-plugin-id={p.id}
					>
						<PluginHostPage
							pluginId={p.id}
							className="h-auto! min-h-0 w-full max-w-full"
							part="toolbar"
						/>
					</div>
				))}
			</div>
		);
	}

	/** 渲染抽屉触发器插件 */
	if (part === 'drawer-triggers') {
		if (drawerPlugins.length === 0) return null;
		return (
			<div className={cn('contents', className)}>
				{drawerPlugins.map((p) => {
					const label = pickPluginLocaleText(p.title, locale) || p.id;
					const open = openPluginId === p.id;
					return (
						<Tooltip
							key={p.id}
							side="bottom"
							sideOffset={6}
							delayDuration={200}
							shadow
							content={label}
						>
							<Button
								type="button"
								variant="ghost"
								size="icon-sm"
								className={cn(
									'lucide-stroke-draw-hover [&_svg]:overflow-visible',
									open
										? 'bg-theme/15 text-teal-500'
										: 'text-textcolor/80 hover:text-teal-500',
									triggerClassName,
								)}
								aria-pressed={open}
								aria-label={label}
								data-plugin-host-slot="drawer-trigger"
								data-plugin-host-surface={surface}
								data-plugin-id={p.id}
								onClick={() => {
									if (!open) {
										claimPluginPortalTarget(
											p.id,
											styleRealmKey(p.entry, p.remoteName, p.id),
										);
									} else {
										clearPluginPortalClaim(p.id);
									}
									onOpenPluginIdChange?.(open ? null : p.id);
								}}
							>
								<PluginIcon name={p.host?.icon} className="size-4" />
							</Button>
						</Tooltip>
					);
				})}
			</div>
		);
	}

	/** 渲染抽屉插件 */
	const openMeta = drawerPlugins.find((p) => p.id === openPluginId);
	if (!openMeta) return null;

	claimPluginPortalTarget(
		openMeta.id,
		styleRealmKey(openMeta.entry, openMeta.remoteName, openMeta.id),
	);

	return (
		<Drawer
			title={pickPluginLocaleText(openMeta.title, locale) || openMeta.id}
			open={!!openPluginId}
			onOpenChange={(open) => {
				if (!open) {
					clearPluginPortalClaim(openPluginId);
					onOpenPluginIdChange?.(null);
				}
			}}
			bodyClassName={drawerBodyClassName}
			contentStyle={chromeStyle}
		>
			<div
				className={cn('relative flex h-full min-h-0 flex-col', className)}
				data-plugin-host-slot="drawer"
				data-plugin-host-surface={surface}
				data-plugin-id={openMeta.id}
			>
				{openPluginId ? (
					<PluginHostPage pluginId={openPluginId} part="drawer" />
				) : null}
			</div>
		</Drawer>
	);
}
