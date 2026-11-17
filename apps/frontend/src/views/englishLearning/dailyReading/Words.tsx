import { useEffect } from 'react';
import {
	closePoint,
	HostPoint,
	PluginHostPage,
	POINT,
	readSlot,
} from '@/federation';

function readingScope(slot: string): boolean {
	return readSlot(POINT.vocabLibrary, slot).payload?.scope === 'dailyReading';
}

export default function DailyReadingWordsPage() {
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
			<HostPoint pointId={POINT.vocabLibrary} slot="drawer" />
		</>
	);
}
