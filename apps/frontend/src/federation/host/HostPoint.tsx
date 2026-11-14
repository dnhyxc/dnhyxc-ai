/**
 * 扩展点在页面上的挂载：没有已启用插件时不占位。
 * action 画按钮，toolbar 内联正文，drawer 在会话打开时画抽屉。
 */
import { Drawer } from '@design/Drawer';
import {
	claimPluginPortalTarget,
	clearPluginPortalClaim,
	pickPluginLocaleText,
	styleRealmKey,
} from '@dnhyxc-ai/federation-kit';
import { useHostSurfacePlugins } from '@dnhyxc-ai/federation-kit/react';
import { Button, Spinner } from '@ui/index';
import {
	type CSSProperties,
	useEffect,
	useRef,
	useSyncExternalStore,
} from 'react';
import { useI18n } from '@/hooks';
import { cn } from '@/lib/utils';
import { getHostPoint } from '../points/catalog';
import {
	closePoint,
	isPointPending,
	openPoint,
	readSignalRev,
	readSlot,
	subscribeSignals,
	subscribeSlot,
} from '../points/session';
import { PluginHostPage } from './PluginHostPage';
import { PluginIcon } from './PluginIcon';

const pointDrawerWidth = 'w-full sm:max-w-[420px]';

const NO_SLOT = Object.freeze({
	pluginId: null,
	open: false,
	payload: null,
	covered: false,
});

export { pointDrawerWidth };

export type HostPointProps = {
	pointId: string;
	slot: string;
	/** 动作槽点击时写入打开槽的载荷 */
	payload?: Record<string, unknown>;
	className?: string;
	drawerClassName?: string;
	drawerStyle?: CSSProperties;
};

function actionKey(payload: Record<string, unknown> | undefined): string {
	const raw =
		typeof payload?.word === 'string'
			? payload.word
			: typeof payload?.english === 'string'
				? payload.english
				: '';
	return raw.trim().replace(/\s+/g, ' ').toLowerCase();
}

export function HostPoint({
	pointId,
	slot,
	payload,
	className,
	drawerClassName,
	drawerStyle,
}: HostPointProps) {
	const { locale } = useI18n();
	const spec = getHostPoint(pointId);
	const slotSpec = spec?.slots.find((item) => item.name === slot);
	const plugins = useHostSurfacePlugins(pointId);
	const session = useSyncExternalStore(
		(listener) => subscribeSlot(pointId, slot, listener),
		() => readSlot(pointId, slot),
		() => readSlot(pointId, slot),
	);
	useSyncExternalStore(subscribeSignals, readSignalRev, () => 0);
	const layout = slotSpec?.layout;
	const yieldTo = layout?.yieldTo;
	const upper = useSyncExternalStore(
		(listener) =>
			yieldTo ? subscribeSlot(yieldTo.point, yieldTo.slot, listener) : () => {},
		() => (yieldTo ? readSlot(yieldTo.point, yieldTo.slot) : NO_SLOT),
		() => NO_SLOT,
	);
	const yielded = Boolean(yieldTo && upper.open && !upper.covered);
	const drawerPlugin =
		slotSpec?.kind === 'drawer'
			? plugins.find((item) => item.id === session.pluginId)
			: undefined;

	const claimedId = useRef<string | null>(null);
	// 曾经让位或被盖住。收回来时滑入距离为 0，避免 animation 从 none 恢复后又从右侧进一次
	const parked = useRef(false);
	const targetSlot = slotSpec?.opens ?? slot;
	const matched = plugins.filter((plugin) => plugin.host?.slot === slot);

	useEffect(() => {
		return () => {
			if (claimedId.current) clearPluginPortalClaim(claimedId.current);
		};
	}, []);

	useEffect(() => {
		if (!layout?.persist) return;
		if (session.open && session.pluginId && !drawerPlugin) {
			closePoint(pointId, slot);
		}
	}, [
		layout?.persist,
		drawerPlugin,
		session.open,
		session.pluginId,
		pointId,
		slot,
	]);

	// 让位时也保持锁滚动。这里解开再等详解去锁，中间一帧页面会跳
	useEffect(() => {
		if (layout?.modal !== false || !session.open) return;
		const prev = document.body.style.overflow;
		document.body.style.overflow = 'hidden';
		return () => {
			document.body.style.overflow = prev;
		};
	}, [layout?.modal, session.open]);

	const conceal = Boolean(session.covered || yielded);
	// 关掉之后下次再开仍要滑入。让位期间记下，收回来的那一帧用 0 位移
	if (!session.open) parked.current = false;
	else if (conceal) parked.current = true;
	if (!spec || !slotSpec) return null;

	if (slotSpec.kind === 'toolbar') {
		if (matched.length === 0) return null;
		return (
			<div className={cn('contents', className)}>
				{matched.map((plugin) => (
					<PluginHostPage
						key={plugin.id}
						pluginId={plugin.id}
						part="toolbar"
						className="h-auto! min-h-0 w-full max-w-full"
					/>
				))}
			</div>
		);
	}

	if (slotSpec.kind === 'action') {
		if (matched.length === 0) return null;
		return (
			<>
				{matched.map((plugin) => {
					const label = pickPluginLocaleText(plugin.title, locale) || plugin.id;
					const key = actionKey(payload);
					const pending =
						typeof payload?.word === 'string' && key
							? isPointPending(pointId, plugin.id, payload.word)
							: false;
					return (
						<Button
							key={plugin.id}
							type="button"
							variant="ghost"
							size="sm"
							disabled={Boolean(
								payload && ('word' in payload || 'english' in payload) && !key,
							)}
							aria-label={label}
							aria-busy={pending}
							className="h-7 w-7 shrink-0 rounded-md border border-theme/10 p-0 text-textcolor/55 hover:border-theme/20 hover:bg-theme/10 hover:text-teal-600"
							onPointerDown={(event) => event.stopPropagation()}
							onClick={(event) => {
								event.stopPropagation();
								const current = readSlot(pointId, targetSlot);
								if (
									current.open &&
									current.pluginId === plugin.id &&
									key &&
									key === actionKey(current.payload ?? undefined)
								) {
									closePoint(pointId, targetSlot);
									return;
								}
								openPoint(pointId, plugin.id, targetSlot, payload ?? {});
							}}
						>
							{pending ? (
								<Spinner className="size-3.5 text-textcolor/55" aria-hidden />
							) : (
								<PluginIcon name={plugin.host?.icon} className="size-3.5" />
							)}
						</Button>
					);
				})}
			</>
		);
	}

	const plugin = drawerPlugin;
	const persist = Boolean(layout?.persist);
	const mounted = persist
		? !(session.open === false && session.covered)
		: Boolean(session.open && plugin);
	if (!mounted) {
		if (claimedId.current) {
			clearPluginPortalClaim(claimedId.current);
			claimedId.current = null;
		}
		return null;
	}
	if (session.open && plugin) {
		claimPluginPortalTarget(
			plugin.id,
			styleRealmKey(plugin.entry, plugin.remoteName, plugin.id),
		);
		claimedId.current = plugin.id;
	} else if (claimedId.current) {
		clearPluginPortalClaim(claimedId.current);
		claimedId.current = null;
	}
	const title = plugin
		? pickPluginLocaleText(plugin.title, locale) || plugin.id
		: '';
	// 列表和导入的 openCard 带 source:list。这一帧详解直接出现，遮罩不要从 0 淡入
	const fromList =
		session.open && !session.covered && session.payload?.source === 'list';
	// opacity 写在 inline 上，压过 Sheet 打开态的 500ms transition。只加 invisible 时卡片层还会再画一帧
	const sheetStyle: CSSProperties = conceal
		? {
				...drawerStyle,
				animation: 'none',
				transition: 'none',
				opacity: 0,
				visibility: 'hidden',
			}
		: fromList || parked.current
			? ({
					...drawerStyle,
					'--tw-enter-translate-x': '0px',
					opacity: 1,
					transition: 'none',
				} as CSSProperties)
			: { ...drawerStyle };

	return (
		<Drawer
			open={Boolean(session.open && plugin)}
			modal={layout?.modal !== false}
			plainOverlay={layout?.modal === false}
			overlayClassName={
				yielded
					? 'pointer-events-none opacity-0'
					: fromList
						? '![--tw-enter-opacity:1]'
						: undefined
			}
			title={title}
			width={pointDrawerWidth}
			bodyClassName="overflow-hidden p-0"
			className={cn(conceal && 'pointer-events-none', drawerClassName)}
			contentStyle={sheetStyle}
			onInteractOutside={(event) => {
				if (yielded) event.preventDefault();
			}}
			onOpenChange={(next) => {
				if (!next) {
					if (yielded) return;
					if (claimedId.current) {
						clearPluginPortalClaim(claimedId.current);
						claimedId.current = null;
					}
					closePoint(pointId, slot);
				}
			}}
		>
			{plugin ? (
				<div className={cn('h-full min-h-0', className)}>
					<PluginHostPage
						pluginId={plugin.id}
						part="drawer"
						className="h-full min-h-0"
					/>
				</div>
			) : null}
		</Drawer>
	);
}
