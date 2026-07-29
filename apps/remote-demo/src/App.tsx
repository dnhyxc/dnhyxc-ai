import { useCallback, useMemo, useRef, useState } from 'react';
import AUDIO1 from './assets/audios/audio1.m4a';
import AUDIO2 from './assets/audios/audio2.m4a';
import AUDIO3 from './assets/audios/audio3.m4a';
import AudioPlayer, {
	type MultiAudioPlayerHandle,
	type TrackItem,
} from './components/AudioPlayer';

type HostBridgeProps = {
	api: {
		theme: 'light' | 'dark';
		locale?: 'zh-CN' | 'en-US';
		navigate: (to: string) => void;
		event: {
			on: (event: string, handler: (data?: unknown) => void) => void;
			off: (event: string, handler: (data?: unknown) => void) => void;
			emit: (event: string, data?: unknown) => void;
		};
		ui?: { showToast: (options: { message: string }) => void };
	};
	plugin: { id: string; version: string; routePath: string };
};

export default function App({ api, plugin }: HostBridgeProps) {
	const playerRef = useRef<MultiAudioPlayerHandle>(null);
	const [active, setActive] = useState(0);
	const updateActived = useCallback((i: number) => setActive(i), []);

	const tracksData = useMemo<TrackItem[]>(
		() => [
			{ audioFileUrl: AUDIO1 },
			{ audioFileUrl: AUDIO2 },
			{ audioFileUrl: AUDIO3 },
		],
		[],
	);

	return (
		<div
			className={`plugin-${plugin.id}`}
			style={{
				padding: 24,
				minHeight: '100%',
				fontFamily: 'ui-sans-serif, system-ui, sans-serif',
			}}
		>
			<h1 style={{ fontSize: 28, marginBottom: 8 }}>Remote Demo</h1>
			<p style={{ opacity: 0.75, marginBottom: 16 }}>
				MF 插件页 · {plugin.id}@{plugin.version} · theme={api.theme}
			</p>
			<section style={{ marginBottom: 24 }}>
				<p style={{ opacity: 0.75, marginBottom: 12, fontSize: 14 }}>
					三段音频连续播放 · 进度按累计时长 · 当前第 {active + 1} 段
				</p>
				<AudioPlayer
					ref={playerRef}
					tracksData={tracksData}
					updateActived={updateActived}
				/>
				<div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
					{[0, 1, 2].map((i) => (
						<button
							key={i}
							type="button"
							onClick={() => playerRef.current?.jumpTrack(i)}
							style={{
								padding: '4px 10px',
								borderRadius: 6,
								border: '1px solid #ccc',
								cursor: 'pointer',
								background: active === i ? '#c8152d' : '#fff',
								color: active === i ? '#fff' : '#333',
							}}
						>
							跳到第 {i + 1} 段
						</button>
					))}
				</div>
			</section>
			<button
				type="button"
				onClick={() =>
					api.ui?.showToast({ message: `hello from ${plugin.id}` })
				}
				style={{
					padding: '8px 14px',
					borderRadius: 8,
					border: '1px solid #ccc',
					cursor: 'pointer',
				}}
			>
				通过 HostBridge 弹 Toast
			</button>
		</div>
	);
}
