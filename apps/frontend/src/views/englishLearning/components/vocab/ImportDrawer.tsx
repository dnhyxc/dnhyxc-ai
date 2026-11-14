import { Drawer } from '@design/Drawer';
import { useEffect, useRef, useSyncExternalStore } from 'react';
import {
	claimPluginPortalTarget,
	clearPluginPortalClaim,
	closePoint,
	POINT,
	pickPluginLocaleText,
	readSlot,
	styleRealmKey,
	subscribeSlot,
	useHostSurfacePlugins,
} from '@/federation';
import { PluginHostPage } from '@/federation/host/PluginHostPage';
import { useI18n } from '@/hooks';
import { vocabDrawerWidth } from './DetailDrawer';

/** 词库列表上唯一的导入抽屉。插件正文只加载一次。 */
export function VocabImportDrawer() {
	const { locale } = useI18n();
	const plugins = useHostSurfacePlugins(POINT.vocabLibrary);
	const session = useSyncExternalStore(
		(listener) => subscribeSlot(POINT.vocabLibrary, 'import-drawer', listener),
		() => readSlot(POINT.vocabLibrary, 'import-drawer'),
		() => readSlot(POINT.vocabLibrary, 'import-drawer'),
	);
	const detail = useSyncExternalStore(
		(listener) => subscribeSlot(POINT.vocabCard, 'drawer', listener),
		() => readSlot(POINT.vocabCard, 'drawer'),
		() => readSlot(POINT.vocabCard, 'drawer'),
	);
	const detailOpen = detail.open && !detail.covered;

	const plugin = plugins.find(
		(item) =>
			item.id === 'vocabDetailImport' &&
			item.host?.slot === 'library-card-action',
	);
	const open = session.open && Boolean(plugin);
	const claimedId = useRef<string | null>(null);
	if (open && plugin) {
		claimPluginPortalTarget(
			plugin.id,
			styleRealmKey(plugin.entry, plugin.remoteName, plugin.id),
		);
		claimedId.current = plugin.id;
	} else if (claimedId.current) {
		clearPluginPortalClaim(claimedId.current);
		claimedId.current = null;
	}

	useEffect(() => {
		if (session.open && !plugin)
			closePoint(POINT.vocabLibrary, 'import-drawer');
	}, [plugin, session.open]);

	// 不跟详解抽屉抢滚动锁，只在导入自己打开时把页面滚定住
	useEffect(() => {
		if (!open) return;
		const prev = document.body.style.overflow;
		document.body.style.overflow = 'hidden';
		return () => {
			document.body.style.overflow = prev;
		};
	}, [open]);

	const title = plugin
		? pickPluginLocaleText(plugin.title, locale) || plugin.id
		: '';
	const covered = open && detailOpen;

	return (
		<Drawer
			open={open}
			modal={false}
			plainOverlay
			overlayClassName={covered ? 'pointer-events-none opacity-0' : undefined}
			className={covered ? 'invisible' : undefined}
			title={title}
			width={vocabDrawerWidth}
			bodyClassName="overflow-hidden p-0"
			onInteractOutside={(event) => {
				if (covered) event.preventDefault();
			}}
			onOpenChange={(next) => {
				if (!next) {
					if (detailOpen) return;
					if (claimedId.current) {
						clearPluginPortalClaim(claimedId.current);
						claimedId.current = null;
					}
					closePoint(POINT.vocabLibrary, 'import-drawer');
				}
			}}
		>
			{plugin ? (
				<div className="h-full min-h-0">
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
