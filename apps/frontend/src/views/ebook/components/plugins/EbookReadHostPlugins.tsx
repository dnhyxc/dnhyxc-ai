import { Drawer } from '@design/Drawer';
import Tooltip from '@design/Tooltip';
import { Button } from '@ui/index';
import {
	BookMarked,
	Highlighter,
	Lightbulb,
	type LucideIcon,
	Puzzle,
	Sparkles,
} from 'lucide-react';
import { type CSSProperties, useEffect } from 'react';
import { useI18n } from '@/hooks';
import { cn } from '@/lib/utils';
import {
	PluginHostPage,
	pickPluginLocaleText,
	useHostSurfacePlugins,
} from '@/plugins';

const ICON_BY_NAME: Record<string, LucideIcon> = {
	Lightbulb,
	Puzzle,
	Sparkles,
	BookMarked,
	Highlighter,
};

function pluginIcon(name?: string): LucideIcon {
	if (!name) return Puzzle;
	return ICON_BY_NAME[name] ?? Puzzle;
}

type Props = {
	/**
	 * - toolbar：slot=toolbar，顶栏内联 PluginHostPage
	 * - drawer-triggers：slot=drawer，顶栏图标按钮
	 * - drawer：slot=drawer，底部 Drawer 宿主
	 */
	part: 'toolbar' | 'drawer-triggers' | 'drawer';
	openPluginId?: string | null;
	onOpenPluginIdChange?: (id: string | null) => void;
	chromeStyle?: CSSProperties;
};

/**
 * 阅读页 Host 插件槽：按 registry `host.surface === 'ebook.read'` 自动渲染。
 * 新增插件只需改 registry，不必再改 read.tsx。
 */
export function EbookReadHostPlugins({
	part,
	openPluginId = null,
	onOpenPluginIdChange,
	chromeStyle,
}: Props) {
	const { locale } = useI18n();
	const all = useHostSurfacePlugins('ebook.read');
	const drawerPlugins = all.filter((p) => p.host?.slot === 'drawer');
	const toolbarPlugins = all.filter((p) => p.host?.slot === 'toolbar');

	useEffect(() => {
		if (part !== 'drawer-triggers' && part !== 'drawer') {
			return;
		}
		if (
			openPluginId &&
			!drawerPlugins.some((p) => p.id === openPluginId) &&
			onOpenPluginIdChange
		) {
			onOpenPluginIdChange(null);
		}
	}, [drawerPlugins, openPluginId, onOpenPluginIdChange, part]);

	if (part === 'toolbar') {
		if (toolbarPlugins.length === 0) return null;
		return (
			<>
				{toolbarPlugins.map((p) => (
					<div
						key={p.id}
						className="flex max-w-[min(280px,40vw)] min-w-0 shrink items-center"
						data-ebook-host-slot="toolbar"
						data-plugin-id={p.id}
					>
						<PluginHostPage
							pluginId={p.id}
							className="h-auto! min-h-0 w-full max-w-full"
						/>
					</div>
				))}
			</>
		);
	}

	if (part === 'drawer-triggers') {
		if (drawerPlugins.length === 0) return null;
		return (
			<>
				{drawerPlugins.map((p) => {
					const Icon = pluginIcon(p.host?.icon);
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
									open
										? 'bg-theme/15 text-teal-500'
										: 'text-textcolor/80 hover:text-teal-500',
								)}
								aria-pressed={open}
								aria-label={label}
								onClick={() => onOpenPluginIdChange?.(open ? null : p.id)}
							>
								<Icon className="size-4" />
							</Button>
						</Tooltip>
					);
				})}
			</>
		);
	}

	const openMeta = drawerPlugins.find((p) => p.id === openPluginId);
	if (!openMeta) return null;

	return (
		<Drawer
			title={pickPluginLocaleText(openMeta.title, locale) || openMeta.id}
			open={!!openPluginId}
			onOpenChange={(open) => {
				if (!open) onOpenPluginIdChange?.(null);
			}}
			bodyClassName="pt-2 pb-2 pl-0"
			contentStyle={chromeStyle}
		>
			<div className="relative flex h-full min-h-0 flex-col">
				{openPluginId ? <PluginHostPage pluginId={openPluginId} /> : null}
			</div>
		</Drawer>
	);
}
