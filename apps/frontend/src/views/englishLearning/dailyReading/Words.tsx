import {
	type CSSProperties,
	useEffect,
	useState,
	useSyncExternalStore,
} from 'react';
import {
	closePoint,
	PluginHostPage,
	PluginHostSurface,
	POINT,
	pointDrawerWidth,
	readSlot,
	subscribeSlot,
} from '@/federation';

function readingScope(slot: string): boolean {
	return readSlot(POINT.vocabLibrary, slot).payload?.scope === 'dailyReading';
}

function detailCoveringList(): boolean {
	const card = readSlot(POINT.vocabCard, 'drawer');
	return card.open && !card.covered;
}

export default function DailyReadingWordsPage() {
	const [openPluginId, setOpenPluginId] = useState<string | null>(null);
	const [listStill, setListStill] = useState(false);
	const detail = useSyncExternalStore(
		(listener) => subscribeSlot(POINT.vocabCard, 'drawer', listener),
		() => readSlot(POINT.vocabCard, 'drawer'),
		() => readSlot(POINT.vocabCard, 'drawer'),
	);
	const detailOpen = detail.open && !detail.covered;
	const tucked = Boolean(openPluginId && detailOpen);

	useEffect(() => {
		if (tucked) setListStill(true);
	}, [tucked]);

	useEffect(() => {
		if (!openPluginId) return;
		const prev = document.body.style.overflow;
		document.body.style.overflow = 'hidden';
		return () => {
			document.body.style.overflow = prev;
		};
	}, [openPluginId]);

	useEffect(() => {
		const sync = () => {
			const slot = readSlot(POINT.vocabLibrary, 'drawer');
			setOpenPluginId(
				slot.open && slot.payload?.scope === 'dailyReading'
					? slot.pluginId
					: null,
			);
		};
		sync();
		return subscribeSlot(POINT.vocabLibrary, 'drawer', sync);
	}, []);

	useEffect(() => {
		return () => {
			if (readingScope('drawer')) closePoint(POINT.vocabLibrary, 'drawer');
			if (readingScope('import-drawer')) {
				closePoint(POINT.vocabLibrary, 'import-drawer');
			}
		};
	}, []);

	return (
		<>
			<PluginHostPage
				pluginId="dailyReadingWords"
				pageShell
				className="h-full min-h-0"
			/>
			<PluginHostSurface
				surface={POINT.vocabLibrary}
				part="drawer"
				openPluginId={openPluginId}
				onOpenPluginIdChange={(id) => {
					if (!id) {
						if (detailCoveringList()) return;
						setListStill(false);
						closePoint(POINT.vocabLibrary, 'drawer');
					}
				}}
				filterPlugins={(list) =>
					list.filter((plugin) => plugin.id === 'vocabDetailList')
				}
				chromeStyle={
					tucked
						? {
								animation: 'none',
								transition: 'none',
								opacity: 0,
								visibility: 'hidden',
							}
						: listStill
							? ({
									'--tw-enter-translate-x': '0px',
									opacity: 1,
									transition: 'none',
								} as CSSProperties)
							: undefined
				}
				drawerBodyClassName="overflow-hidden p-0"
				drawerWidth={pointDrawerWidth}
				drawerModal={false}
				drawerPlainOverlay
				drawerOverlayClassName={
					tucked ? 'pointer-events-none opacity-0' : undefined
				}
				drawerPreventDismiss={detailCoveringList}
				drawerClassName={tucked ? 'pointer-events-none' : undefined}
				onDrawerInteractOutside={(event) => {
					if (detailCoveringList()) event.preventDefault();
				}}
			/>
		</>
	);
}
