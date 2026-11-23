/**
 * 扩展点在页面上的挂载：没有已启用插件时不占位。
 * action 画按钮，toolbar 内联正文，drawer 在会话打开时画抽屉。
 */
import { Drawer } from '@design/Drawer';
import Tooltip from '@design/Tooltip';
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
	type ReactNode,
	useEffect,
	useMemo,
	useRef,
	useSyncExternalStore,
} from 'react';
import { useI18n } from '@/hooks';
import { cn } from '@/lib/utils';
import { getHostPoint } from '../points/catalog';
import {
	closePoint,
	concealOf,
	coversOpenTarget,
	isPointPending,
	openPoint,
	readSignalRev,
	readSlot,
	readStats,
	stackPeers,
	subscribeSignals,
	subscribeSlot,
} from '../points/session';
import { PluginHostPage } from './PluginHostPage';
import { PluginIcon } from './PluginIcon';

const pointDrawerWidth = 'w-full sm:max-w-[420px]';

export { pointDrawerWidth };

export type HostPointProps = {
	pointId: string;
	slot: string;
	/** 动作槽点击时写入打开槽的载荷 */
	payload?: Record<string, unknown>;
	/** page 角色的图标按钮。缺省只画抽屉正文 */
	part?: 'trigger' | 'body';
	/** 顶栏与旁边的文字按钮同一套：图标加标题，不再只放一个图标 */
	labeled?: boolean;
	/** 盖过插件标题。词库列表用来放统计 */
	title?: ReactNode;
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
	part = 'body',
	labeled = false,
	title: titleProp,
	className,
	drawerClassName,
	drawerStyle,
}: HostPointProps) {
	const { locale, t } = useI18n();
	const spec = getHostPoint(pointId);
	const slotSpec = spec?.slots.find((item) => item.name === slot);
	const plugins = useHostSurfacePlugins(pointId);
	const session = useSyncExternalStore(
		(listener) => subscribeSlot(pointId, slot, listener),
		() => readSlot(pointId, slot),
		() => readSlot(pointId, slot),
	);
	useSyncExternalStore(subscribeSignals, readSignalRev, () => 0);
	const peers = useMemo(() => stackPeers(pointId, slot), [pointId, slot]);
	useSyncExternalStore(
		(listener) => {
			const offs = peers.map((peer) =>
				subscribeSlot(peer.point, peer.slot, listener),
			);
			return () => {
				for (const off of offs) off();
			};
		},
		() =>
			peers
				.map((peer) => {
					const row = readSlot(peer.point, peer.slot);
					return row.open && !row.covered ? '1' : '0';
				})
				.join(''),
		() => '',
	);
	const layout = slotSpec?.layout;
	const keepUnderDetail = (event?: Event) => {
		if (!concealOf(pointId, slot)) return false;
		event?.preventDefault();
		return true;
	};
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
		if (!layout?.persist && !layout?.page) return;
		if (session.open && session.pluginId && !drawerPlugin) {
			closePoint(pointId, slot);
		}
	}, [
		layout?.persist,
		layout?.page,
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

	const conceal = concealOf(pointId, slot);
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

	if (part === 'trigger' && slotSpec.kind === 'drawer') {
		if (matched.length === 0) return null;
		return (
			<div className={cn('contents', className)}>
				{matched.map((plugin) => {
					const label =
						(typeof titleProp === 'string' ? titleProp : '') ||
						pickPluginLocaleText(plugin.title, locale) ||
						plugin.id;
					const open = session.open && session.pluginId === plugin.id;
					const toggle = () => {
						if (open) {
							clearPluginPortalClaim(plugin.id);
							closePoint(pointId, slot);
							return;
						}
						claimPluginPortalTarget(
							plugin.id,
							styleRealmKey(plugin.entry, plugin.remoteName, plugin.id),
						);
						const opened = openPoint(pointId, plugin.id, slot, {});
						if (!opened) clearPluginPortalClaim(plugin.id);
					};
					if (labeled) {
						return (
							<Button
								key={plugin.id}
								type="button"
								variant="link"
								className="lucide-stroke-draw-hover flex items-center gap-1 px-0! text-textcolor transition-none hover:text-teal-500 has-[>svg]:px-0!"
								aria-pressed={open}
								aria-label={label}
								onClick={toggle}
							>
								<span className="relative inline-flex size-4 shrink-0 items-center justify-center overflow-hidden [&_svg]:size-4">
									<PluginIcon name={plugin.host?.icon} />
								</span>
								<span>{label}</span>
							</Button>
						);
					}
					return (
						<Tooltip
							key={plugin.id}
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
								)}
								aria-pressed={open}
								aria-label={label}
								onClick={toggle}
							>
								<PluginIcon name={plugin.host?.icon} className="size-4" />
							</Button>
						</Tooltip>
					);
				})}
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
							className="h-7 w-7 shrink-0 rounded-md border border-theme/10 p-0 text-textcolor/55 hover:border-theme/20 hover:bg-theme/10 hover:text-teal-500"
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
	const titleText =
		titleProp ??
		(plugin ? pickPluginLocaleText(plugin.title, locale) || plugin.id : '');
	const commentStats =
		pointId === 'knowledge.article' ? readStats(pointId) : null;
	const title =
		commentStats == null ? (
			titleText
		) : (
			<span className="inline-flex min-w-0 items-baseline gap-2">
				<span className="shrink-0">{titleText}</span>
				<span className="truncate text-sm font-normal text-textcolor/50">
					{t('knowledge.comments.summary', {
						total: commentStats.total,
						loaded: commentStats.loaded,
					})}
				</span>
			</span>
		);
	// 列表和导入的 openCard 带 source:list。这一帧详解直接出现，遮罩不要从 0 淡入
	const fromList =
		session.open && !session.covered && session.payload?.source === 'list';
	const overOpen = coversOpenTarget(pointId, slot);
	// opacity 写在 inline 上，压过 Sheet 打开态的 500ms transition。只加 invisible 时卡片层还会再画一帧
	const sheetStyle: CSSProperties = conceal
		? {
				...drawerStyle,
				animation: 'none',
				transition: 'none',
				opacity: 0,
				visibility: 'hidden',
			}
		: fromList || parked.current || overOpen
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
				conceal
					? 'pointer-events-none opacity-0'
					: fromList || overOpen
						? '![--tw-enter-opacity:1]'
						: undefined
			}
			title={title}
			width={pointDrawerWidth}
			bodyClassName="overflow-hidden p-0"
			className={cn(conceal && 'pointer-events-none', drawerClassName)}
			contentStyle={sheetStyle}
			onInteractOutside={keepUnderDetail}
			onFocusOutside={keepUnderDetail}
			onOpenChange={(next) => {
				if (!next) {
					if (keepUnderDetail()) return;
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
