/**
 * 插件 registry 字段说明（信息图标下拉，对齐听写/拼写 PracticeShortcutsMenu）
 */
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from '@ui/dropdown-menu';
import { ScrollArea } from '@ui/index';
import { FileBracesCorner } from 'lucide-react';
import { useMemo } from 'react';
import { useI18n } from '@/hooks';

type FieldRow = { field: string; descKey: string };
type FieldSection = { titleKey: string; rows: FieldRow[] };

const SECTIONS: FieldSection[] = [
	{
		titleKey: 'plugins.registry.help.sectionRoot',
		rows: [
			{ field: 'updatedAt', descKey: 'plugins.registry.help.updatedAt' },
			{ field: 'plugins', descKey: 'plugins.registry.help.plugins' },
		],
	},
	{
		titleKey: 'plugins.registry.help.sectionBasic',
		rows: [
			{ field: 'id', descKey: 'plugins.registry.help.id' },
			{ field: 'title', descKey: 'plugins.registry.help.fieldTitle' },
			{ field: 'description', descKey: 'plugins.registry.help.description' },
			{ field: 'routePath', descKey: 'plugins.registry.help.routePath' },
			{ field: 'entry', descKey: 'plugins.registry.help.entry' },
			{ field: 'version', descKey: 'plugins.registry.help.version' },
			{ field: 'hostApiRange', descKey: 'plugins.registry.help.hostApiRange' },
			{ field: 'enabled', descKey: 'plugins.registry.help.enabled' },
			{ field: 'trust', descKey: 'plugins.registry.help.trust' },
		],
	},
	{
		titleKey: 'plugins.registry.help.sectionMf',
		rows: [
			{ field: 'remoteName', descKey: 'plugins.registry.help.remoteName' },
			{ field: 'expose', descKey: 'plugins.registry.help.expose' },
			{ field: 'framework', descKey: 'plugins.registry.help.framework' },
			{ field: 'injectRoute', descKey: 'plugins.registry.help.injectRoute' },
			{ field: 'preload', descKey: 'plugins.registry.help.preload' },
			{ field: 'permissions', descKey: 'plugins.registry.help.permissions' },
		],
	},
	{
		titleKey: 'plugins.registry.help.sectionHost',
		rows: [
			{ field: 'menu', descKey: 'plugins.registry.help.menu' },
			{ field: 'host', descKey: 'plugins.registry.help.host' },
			{ field: 'iframeUrl', descKey: 'plugins.registry.help.iframeUrl' },
			{ field: 'integrity', descKey: 'plugins.registry.help.integrity' },
			{ field: 'signature', descKey: 'plugins.registry.help.signature' },
		],
	},
];

function FieldRowView({ field, desc }: { field: string; desc: string }) {
	return (
		<div className="flex flex-col gap-0.5 py-1.5 text-sm">
			<div className="text-textcolor w-fit rounded bg-theme/5 py-px mb-1 font-mono leading-none">
				{field}
			</div>
			<span className="text-textcolor/75 text-justify leading-snug">
				{desc}
			</span>
		</div>
	);
}

export function RegistryFieldsHelp({ dirty }: { dirty?: boolean }) {
	const { t } = useI18n();

	const sections = useMemo(
		() =>
			SECTIONS.map((s) => ({
				title: t(s.titleKey),
				rows: s.rows.map((r) => ({
					field: r.field,
					desc: t(r.descKey),
				})),
			})),
		[t],
	);

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<div className="relative flex items-center mr-1.5 pl-1.5 cursor-pointer hover:text-teal-500 lucide-stroke-draw-hover">
					<FileBracesCorner className="size-4" aria-hidden />
					{dirty ? (
						<span
							className="pointer-events-none absolute -right-1 -top-1 size-2 rounded-full bg-orange-500"
							aria-hidden
						/>
					) : null}
				</div>
			</DropdownMenuTrigger>
			<DropdownMenuContent
				align="start"
				sideOffset={8}
				scrollable={false}
				className="w-[min(22rem,calc(100vw-2rem))] p-0"
			>
				<DropdownMenuLabel className="text-textcolor px-3 py-2.5 text-sm font-semibold">
					{t('plugins.registry.help.panelTitle')}
				</DropdownMenuLabel>
				<DropdownMenuSeparator className="mx-0" />
				<ScrollArea
					className="max-h-[min(24rem,70dvh)] w-full min-h-0 border-0"
					viewportClassName="max-h-[min(24rem,70dvh)] box-border py-1 pe-3 ps-3"
				>
					{sections.map((section, index) => (
						<div key={section.title}>
							{index > 0 ? <DropdownMenuSeparator className="my-1" /> : null}
							<div className="py-0.5">
								<p className="text-textcolor/45 pt-1.5 pb-0.5 text-[11px] font-medium tracking-wide">
									{section.title}
								</p>
								{section.rows.map((row) => (
									<FieldRowView
										key={row.field}
										field={row.field}
										desc={row.desc}
									/>
								))}
							</div>
						</div>
					))}
				</ScrollArea>
				<DropdownMenuSeparator className="mx-0" />
				<p className="text-textcolor/45 px-3 py-2 text-xs leading-relaxed">
					{t('plugins.registry.help.footnote')}
				</p>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
