import { Component, type ErrorInfo, type ReactNode } from 'react';
import { useI18n } from '@/hooks';

type Props = {
	pluginId: string;
	children: ReactNode;
};

type State = { error: Error | null };

function PluginErrorFallback({
	pluginId,
	message,
}: {
	pluginId: string;
	message: string;
}) {
	const { t } = useI18n();
	return (
		<div className="p-6 text-sm text-muted-foreground">
			<p className="font-medium text-foreground mb-1">
				{t('plugins.host.loadFailed', { id: pluginId })}
			</p>
			<p className="opacity-70">{message}</p>
		</div>
	);
}

export class PluginErrorBoundary extends Component<Props, State> {
	state: State = { error: null };

	static getDerivedStateFromError(error: Error): State {
		return { error };
	}

	componentDidCatch(error: Error, info: ErrorInfo) {
		console.error(`[plugin:${this.props.pluginId}]`, error, info);
	}

	render() {
		if (this.state.error) {
			return (
				<PluginErrorFallback
					pluginId={this.props.pluginId}
					message={this.state.error.message}
				/>
			);
		}
		return this.props.children;
	}
}
