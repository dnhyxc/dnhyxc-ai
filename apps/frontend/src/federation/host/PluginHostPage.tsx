/**
 * 本仓 design slots 包装 `<FederationPlugin />`。
 * 任意项目可直接用 kit 的 FederationPlugin + 自己的 slots。
 */
import Tooltip from '@design/Tooltip';
import {
	FederationPlugin,
	type PluginHostViewSlots,
} from '@dnhyxc-ai/federation-kit/react';
import {
	CircleQuestionMark,
	CloudBackup,
	Puzzle,
	TreePalm,
} from 'lucide-react';
import { type ReactNode, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import Loading from '@/components/design/Loading';
import { Button, Spinner } from '@/components/ui';
import { useI18n } from '@/hooks';
import { cn } from '@/lib/utils';
import { openExternalUrl } from '@/utils';
import { getPluginDevGuideAbsoluteUrl } from '@/views/pluginDevGuide/paths';
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

/** 挂载表面：决定 loading/error 布局与按钮集 */
type Surface = 'toolbar' | 'drawer' | 'page' | 'embed';

function resolveSurface(
	part: Props['part'],
	pageShell: boolean | undefined,
): Surface {
	if (part === 'toolbar') return 'toolbar';
	if (part === 'drawer') return 'drawer';
	if (pageShell) return 'page';
	return 'embed';
}

const identityShell = (node: ReactNode) => node;

const pageShellFn = (node: ReactNode) => (
	<PluginPageShell>{node}</PluginPageShell>
);

function pagePad(surface: Surface, node: ReactNode) {
	if (surface !== 'page') return node;
	return (
		<div className="mx-auto text-textcolor h-full flex flex-col gap-3 p-5.5 pt-0">
			{node}
		</div>
	);
}

/** 工具栏错误：hover 打开；已打开时点击图标不关闭 */
function ToolbarErrorHint({
	pluginId,
	error,
	retry,
	busy,
}: {
	pluginId: string;
	error: string;
	retry: () => void;
	busy: boolean;
}) {
	const { t } = useI18n();
	const [open, setOpen] = useState(false);
	const keepOpenRef = useRef(false);
	const title = t('plugins.host.unavailable', { id: pluginId });

	return (
		<Tooltip
			side="bottom"
			align="center"
			sideOffset={6}
			delayDuration={200}
			shadow
			open={open}
			onOpenChange={(next) => {
				if (!next && keepOpenRef.current) {
					keepOpenRef.current = false;
					return;
				}
				setOpen(next);
			}}
			content={
				<div className="flex flex-col gap-3 pt-1 pb-2 text-textcolor">
					<div className="text-sm max-w-[280px] whitespace-normal wrap-break-word">
						<div>{title}</div>
						<div className="mt-2 text-rose-400">{error}</div>
					</div>
					<ErrorActions busy={busy} retry={retry} showHome={false} size="sm" />
				</div>
			}
		>
			<Button
				type="button"
				variant="ghost"
				size="icon-sm"
				className="text-orange-500"
				aria-label={title}
				onPointerDown={(e) => {
					e.preventDefault();
					if (open) keepOpenRef.current = true;
				}}
				onClick={(e) => {
					e.preventDefault();
					if (open) setOpen(true);
				}}
			>
				<CircleQuestionMark className="size-4" />
			</Button>
		</Tooltip>
	);
}

function ErrorActions({
	busy,
	retry,
	showHome,
	size = 'default',
}: {
	busy: boolean;
	retry: () => void;
	showHome: boolean;
	size?: 'default' | 'sm';
}) {
	const { locale, t } = useI18n();
	const navigate = useNavigate();

	return (
		<div className="flex justify-center w-full gap-3">
			<Button
				size={size}
				type="button"
				className="w-fit"
				disabled={busy}
				onClick={retry}
			>
				{busy ? (
					<Spinner className="size-4 text-textcolor" />
				) : (
					<CloudBackup className="size-4.5" />
				)}
				{t('plugins.host.reload')}
			</Button>
			{showHome ? (
				<Button
					size={size}
					type="button"
					variant="outline"
					className="w-fit"
					onClick={() => navigate('/')}
				>
					<TreePalm className="size-4.5" />
					{t('notFound.backHome')}
				</Button>
			) : null}
			<Button
				size={size}
				type="button"
				variant="outline"
				className="w-fit"
				onClick={() =>
					void openExternalUrl(getPluginDevGuideAbsoluteUrl(locale))
				}
			>
				<Puzzle className="size-4" />
				{t('home.steps.pluginDev.guide')}
			</Button>
		</div>
	);
}

function ToolbarLoading() {
	return (
		<div className="text-textcolor h-full w-full flex items-center justify-center">
			<div className="flex items-center gap-2 px-2">
				<Spinner className="text-muted-foreground size-4" />
				loading...
			</div>
		</div>
	);
}

function CardLoading({ text }: { text: string }) {
	return (
		<div className="bg-theme-background h-full p-4.5 rounded-md">
			<Loading text={text} className="flex items-center h-full" />
		</div>
	);
}

function CardError({
	title,
	error,
	busy,
	retry,
	showHome,
}: {
	title: string;
	error?: string;
	busy: boolean;
	retry: () => void;
	showHome: boolean;
}) {
	return (
		<div className="bg-theme-background flex flex-col items-center justify-center gap-3 h-full pt-4.5 rounded-md">
			<div className="flex flex-col gap-3">
				<span>
					{title}
					{error ? (
						<>
							: <span className="text-rose-400">{error}</span>
						</>
					) : null}
				</span>
				<ErrorActions busy={busy} retry={retry} showHome={showHome} />
			</div>
		</div>
	);
}

export function PluginHostPage({
	pluginId,
	className,
	part,
	pageShell,
	slots: slotsOverride,
}: Props) {
	const { locale, t } = useI18n();
	const surface = resolveSurface(part, pageShell);
	const hostLocale = locale === 'en-US' ? 'en-US' : 'zh-CN';

	const slots = useMemo((): PluginHostViewSlots => {
		const base: PluginHostViewSlots = {
			rootClassName: cn(className),
			shell: pageShellFn,
			missingIframeUrl: ({ pluginId: id }) => (
				<div className="text-muted-foreground p-6 text-sm">
					{t('plugins.host.missingIframeUrl', { id })}
				</div>
			),
			loading: ({ pluginId: id, variant }) => {
				if (variant === 'toolbar' || surface === 'toolbar') {
					return <ToolbarLoading />;
				}
				return pagePad(
					surface,
					<CardLoading text={t('plugins.host.loadingNamed', { id })} />,
				);
			},
			error: ({ pluginId: id, error, retry, busy, variant }) => {
				if (variant === 'toolbar' || surface === 'toolbar') {
					return (
						<div className="text-textcolor h-full w-full flex items-center justify-center">
							<span className="text-sm pl-2 text-textcolor/80">
								{t('plugins.host.loadingNamed', { id })}
							</span>
							<ToolbarErrorHint
								pluginId={id}
								error={error}
								retry={retry}
								busy={busy}
							/>
						</div>
					);
				}
				return pagePad(
					surface,
					<CardError
						title={t('plugins.host.unavailable', { id })}
						error={error || undefined}
						busy={busy}
						retry={retry}
						showHome={surface !== 'drawer'}
					/>,
				);
			},
		};

		return {
			...base,
			...slotsOverride,
			shell: slotsOverride?.shell ?? (pageShell ? pageShellFn : identityShell),
		};
	}, [className, pageShell, slotsOverride, surface, t]);

	return (
		<FederationPlugin
			host={mf}
			name={pluginId}
			className={className}
			pageShell={pageShell}
			part={part}
			locale={hostLocale}
			slots={slots}
			ErrorBoundary={PluginErrorBoundary}
		/>
	);
}

registerPluginHostPage(PluginHostPage);
