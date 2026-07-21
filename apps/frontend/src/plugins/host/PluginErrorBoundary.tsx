import { Component, type ErrorInfo, type ReactNode } from 'react';

type Props = {
	pluginId: string;
	children: ReactNode;
};

type State = { error: Error | null };

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
				<div className="p-6 text-sm text-muted-foreground">
					<p className="font-medium text-foreground mb-1">
						插件「{this.props.pluginId}」加载失败
					</p>
					<p className="opacity-70">{this.state.error.message}</p>
				</div>
			);
		}
		return this.props.children;
	}
}
