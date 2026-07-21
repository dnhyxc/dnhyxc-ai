import {
	type ComponentProps,
	type ComponentType,
	useEffect,
	useState,
} from 'react';
import { connectIframeHost } from '@/utils/iframeHostClient';
import IdeasListApp from '@/views/ideas-list';
import LearningNotesApp from '@/views/learning-notes';

type Bridge = {
	api: ComponentProps<typeof IdeasListApp>['api'];
	plugin: ComponentProps<typeof IdeasListApp>['plugin'];
};

function EmbedShell({
	pluginId,
	App,
}: {
	pluginId: string;
	App: ComponentType<Bridge>;
}) {
	const [bridge, setBridge] = useState<Bridge | null>(null);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		let cancelled = false;
		void connectIframeHost(pluginId)
			.then((b) => {
				if (!cancelled) setBridge(b as Bridge);
			})
			.catch((e) => {
				if (!cancelled) {
					setError(e instanceof Error ? e.message : String(e));
				}
			});
		return () => {
			cancelled = true;
		};
	}, [pluginId]);

	if (error) {
		return (
			<div
				className="plugin-standalone text-destructive h-full p-3 text-sm"
				data-plugin-root
			>
				{error}
			</div>
		);
	}
	if (!bridge) {
		return (
			<div
				className="plugin-standalone text-textcolor/55 h-full p-3 text-sm"
				data-plugin-root
			>
				连接 Host…
			</div>
		);
	}

	return (
		<div
			className="plugin-standalone h-full min-h-0"
			data-plugin-root
			data-theme={bridge.api.theme}
		>
			<App {...bridge} />
		</div>
	);
}

export function EmbedIdeasList() {
	return <EmbedShell pluginId="ebookIdeasList" App={IdeasListApp} />;
}

export function EmbedLearningNotes() {
	return <EmbedShell pluginId="learningNotes" App={LearningNotesApp} />;
}
