/**
 * 视频播放器插件入口（MF expose ./VideoPlayer）
 * 对齐其它插件：接收 HostBridgeProps，同步 Host locale，渲染 VideoPlayer。
 */
import { useHostLocale } from '@/hooks';
import type { Locale } from '@/i18n';
import VideoPlayer from './VideoPlayer';

type HostBridgeProps = {
	api: {
		theme: 'light' | 'dark';
		locale?: Locale;
		event?: {
			on: (event: string, handler: (data?: unknown) => void) => void;
			off: (event: string, handler: (data?: unknown) => void) => void;
			emit: (event: string, data?: unknown) => void;
		};
		ui?: {
			showToast: (options: {
				message: string;
				type?: 'success' | 'error' | 'info';
			}) => void;
			setAppFullscreen?: (full: boolean) => Promise<void>;
		};
	};
	plugin: { id: string; version: string; routePath: string };
	independent?: boolean;
};

export default function VideoPlayerApp({ api }: HostBridgeProps) {
	useHostLocale(api);
	return <VideoPlayer hostUi={api.ui} />;
}
