/**
 * 本仓 design slots 包装 `<FederationPlugin />`。
 * 任意项目可直接用 kit 的 FederationPlugin + 自己的 slots。
 */
import Tooltip from '@design/Tooltip';
import {
	FederationPlugin,
	type PluginHostViewSlots,
} from '@dnhyxc-ai/federation-kit/react';
import { CircleQuestionMark } from 'lucide-react';
import type { ReactNode } from 'react';
import Loading from '@/components/design/Loading';
import { Button, Spinner } from '@/components/ui';
import { useI18n } from '@/hooks';
import { cn } from '@/lib/utils';
import { mf, registerPluginHostPage } from '../runtime';
import { PluginErrorBoundary } from './PluginErrorBoundary';
import { PluginPageShell } from './PluginPageShell';

type Props = {
	pluginId: string;
	className?: string;
	part?: 'toolbar' | 'drawer-triggers' | 'drawer';
	pageShell?: boolean;
	slots?: PluginHostViewSlots;
};

export function PluginHostPage({
	pluginId,
	className,
	part,
	pageShell,
	slots: slotsOverride,
}: Props) {
	const { locale, t } = useI18n();

	const defaultSlots: PluginHostViewSlots = {
		rootClassName: cn(className),
		shell: (node) => <PluginPageShell>{node}</PluginPageShell>,
		missingIframeUrl: ({ pluginId: id }) => (
			<div className="text-muted-foreground p-6 text-sm">
				{t('plugins.host.missingIframeUrl', { id })}
			</div>
		),
		loading: ({ pluginId: id, variant: v }) => {
			if (v === 'toolbar') {
				return (
					<div className="text-textcolor h-full w-full flex items-center justify-center">
						<div className="flex items-center gap-2 px-2">
							<Spinner className="text-muted-foreground size-4" />
							loading...
						</div>
					</div>
				);
			}
			// 白底圆角卡与原先一致；外层 p-5.5 仅路由 pageShell（内嵌页已自带边距）
			const card = (
				<div className="bg-theme-background h-full p-4.5 rounded-md">
					<Loading
						text={t('plugins.host.loadingNamed', { id })}
						className="flex items-center h-full"
					/>
				</div>
			);
			if (!pageShell) return card;
			return (
				<div className="mx-auto text-textcolor h-full flex flex-col gap-3 p-5.5 pt-0">
					{card}
				</div>
			);
		},
		error: ({ pluginId: id, error, retry, busy, variant: v }) => {
			if (v === 'toolbar') {
				return (
					<div className="text-textcolor h-full w-full flex items-center justify-center">
						<span className="text-sm pl-2 text-textcolor/80">
							{t('plugins.host.loadingNamed', { id })}
						</span>
						<Tooltip
							side="bottom"
							sideOffset={-2}
							delayDuration={200}
							shadow
							content={
								<div className="flex flex-col gap-3 pt-1 pb-2 text-textcolor">
									<div className="text-sm max-w-[280px] whitespace-normal wrap-break-word">
										<div className="text-sm">
											{t('plugins.host.unavailable', { id })}
										</div>
										<div className="text-sm mt-2 text-rose-400">{error}</div>
									</div>
									<Button
										type="button"
										variant={busy ? 'loading' : 'default'}
										className="w-fit"
										disabled={busy}
										onClick={retry}
									>
										{t('plugins.host.reload')}
									</Button>
								</div>
							}
						>
							<Button
								type="button"
								variant="ghost"
								size="icon-sm"
								className="text-orange-500"
							>
								<CircleQuestionMark className="size-4" />
							</Button>
						</Tooltip>
					</div>
				);
			}
			const card = (
				<div className="bg-theme-background h-full p-4.5 rounded-md">
					<div className="flex flex-col gap-3">
						<span>
							{t('plugins.host.unavailable', { id })}
							{error ? `: ${error}` : ''}
						</span>
						<Button
							type="button"
							variant={busy ? 'loading' : 'default'}
							className="w-fit"
							disabled={busy}
							onClick={retry}
						>
							{t('plugins.host.reload')}
						</Button>
					</div>
				</div>
			);
			if (!pageShell) return card;
			return (
				<div className="mx-auto text-textcolor h-full flex flex-col gap-3 p-5.5 pt-0">
					{card}
				</div>
			);
		},
	};

	const slots: PluginHostViewSlots = {
		...defaultSlots,
		...slotsOverride,
		shell:
			slotsOverride?.shell ??
			(pageShell ? defaultSlots.shell : (node: ReactNode) => node),
	};

	return (
		<FederationPlugin
			host={mf}
			name={pluginId}
			className={className}
			pageShell={pageShell}
			part={part}
			locale={locale === 'en-US' ? 'en-US' : 'zh-CN'}
			slots={slots}
			ErrorBoundary={PluginErrorBoundary}
		/>
	);
}

registerPluginHostPage(PluginHostPage);
