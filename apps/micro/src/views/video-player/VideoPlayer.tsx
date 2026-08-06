/**
 * 视频播放器组件
 * 对齐 src/views/tools/VideoPlayer/index.vue（一比一复刻 UI 与交互，去除裁剪/转码/GIF/水印等功能）
 *
 * 保留功能：多文件上传、xgplayer 初始化、自定义控制条、进度条（hover tip/点击跳转/拖拽滑块/刻度尺）、
 * 播放暂停/上下集、时间显示、设置（播放方式/镜像）、选集、音量、倍速、画中画、全屏、mini timeline、
 * 音量 tip、视频名、中心播放按钮、键盘快捷键。
 */

import { ScrollArea } from '@ui/scroll-area';
import {
	FolderPlus,
	ListRestart,
	ListVideo,
	Maximize,
	Minimize,
	Pause,
	PictureInPicture2,
	Play,
	Settings,
	SkipBack,
	SkipForward,
	Upload,
	Volume1,
	Volume2,
	VolumeX,
} from 'lucide-react';
import {
	type ReactNode,
	useCallback,
	useEffect,
	useRef,
	useState,
} from 'react';
import Player from 'xgplayer';
import DragDropFileUpload, {
	type DragDropAcceptResult,
	type DragDropFileUploadHandle,
} from '@/components/design/DragDropFileUpload';
import { PlaybackRatePanel } from '@/components/design/PlaybackRatePanel';
import { useI18n } from '@/hooks';
import { cn } from '@/lib/utils';
import {
	enterFullscreen,
	exitFullscreen,
	formatTime,
	getFullscreenElement,
	LIMIT,
	PLAY_OPTIONS,
	type PlayType,
	SCREEN_TYPE,
	type ScreenType,
	setDocumentAppFullscreen,
	type VideoUrlList,
} from './tools';
import './styles.css';
import 'xgplayer/dist/index.min.css';

/** 底栏操作图标统一尺寸 */
const CTRL_ICON = 18;

function VolumeIcon({
	volume,
	size = CTRL_ICON,
}: {
	volume: number;
	size?: number;
}) {
	if (volume <= 0) return <VolumeX size={size} />;
	if (volume < 0.6) return <Volume1 size={size} />;
	return <Volume2 size={size} />;
}

/* --------------------------------- 弹出层 --------------------------------- */

function Tip({ label, children }: { label: string; children: ReactNode }) {
	return (
		<span className="vp-tip" data-tip={label}>
			{children}
		</span>
	);
}

function Popover({
	trigger,
	children,
	align = 'center',
	width,
	mode = 'click',
	contentClassName,
	contentPadding = 10,
	onOpenChange,
	onContentPointer,
}: {
	trigger: (open: boolean) => ReactNode;
	children: ReactNode | ((api: { close: () => void }) => ReactNode);
	align?: 'center' | 'start' | 'end';
	width?: number | string;
	/** click：点击切换；hover：悬停展示 */
	mode?: 'click' | 'hover';
	contentClassName?: string;
	contentPadding?: number | string;
	onOpenChange?: (open: boolean) => void;
	/** 指针在 POP 内容上时回调（用于保持底栏可见） */
	onContentPointer?: () => void;
}) {
	const [open, setOpen] = useState(false);
	const ref = useRef<HTMLDivElement>(null);
	const leaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	const clearLeaveTimer = useCallback(() => {
		if (leaveTimerRef.current) {
			clearTimeout(leaveTimerRef.current);
			leaveTimerRef.current = null;
		}
	}, []);

	const setOpenSafe = useCallback(
		(next: boolean | ((prev: boolean) => boolean)) => {
			setOpen((prev) => {
				const value = typeof next === 'function' ? next(prev) : next;
				if (value !== prev) onOpenChange?.(value);
				return value;
			});
		},
		[onOpenChange],
	);

	const close = useCallback(() => setOpenSafe(false), [setOpenSafe]);

	useEffect(() => {
		if (!open || mode !== 'click') return;
		const onDown = (e: MouseEvent) => {
			if (ref.current && !ref.current.contains(e.target as Node)) {
				setOpenSafe(false);
			}
		};
		document.addEventListener('mousedown', onDown);
		return () => document.removeEventListener('mousedown', onDown);
	}, [open, mode, setOpenSafe]);

	useEffect(() => () => clearLeaveTimer(), [clearLeaveTimer]);

	const onHoverEnter = () => {
		if (mode !== 'hover') return;
		clearLeaveTimer();
		setOpenSafe(true);
	};

	const onHoverLeave = () => {
		if (mode !== 'hover') return;
		clearLeaveTimer();
		leaveTimerRef.current = setTimeout(() => setOpenSafe(false), 120);
	};

	return (
		<div
			ref={ref}
			className="vp-popover relative inline-flex"
			onMouseEnter={onHoverEnter}
			onMouseLeave={onHoverLeave}
		>
			<div
				className="vp-popover-trigger inline-flex"
				onClick={mode === 'click' ? () => setOpenSafe((v) => !v) : undefined}
			>
				{trigger(open)}
			</div>
			{open ? (
				<div
					className={cn(
						'vp-popover-content absolute bottom-full z-50',
						align === 'center' && 'left-1/2 -translate-x-1/2',
						align === 'start' && 'left-0',
						align === 'end' && 'right-0',
						contentClassName,
					)}
					style={{
						marginBottom: 8,
						width: typeof width === 'number' ? `${width}px` : width,
						padding: contentPadding,
					}}
					onClick={(e) => e.stopPropagation()}
					onMouseEnter={onContentPointer}
					onMouseMove={onContentPointer}
				>
					{typeof children === 'function' ? children({ close }) : children}
				</div>
			) : null}
		</div>
	);
}

function Segmented<T extends string>({
	value,
	options,
	onChange,
}: {
	value: T;
	options: { label: string; value: T }[];
	onChange: (v: T) => void;
}) {
	return (
		<div className="vp-segmented">
			{options.map((o) => (
				<button
					key={o.value}
					type="button"
					className={cn(
						'vp-segmented-item',
						value === o.value && 'vp-segmented-active',
					)}
					onClick={() => onChange(o.value)}
				>
					{o.label}
				</button>
			))}
		</div>
	);
}

/* ------------------------------- 主播放器组件 ------------------------------ */

const PLAYBACK_RATES = [3, 2.5, 2, 1.5, 1, 0.75, 0.5];
const CHROME_HIDE_MS = 3000;

type HostUi = {
	showToast?: (options: {
		message: string;
		type?: 'success' | 'error' | 'info';
	}) => void;
	setAppFullscreen?: (full: boolean) => Promise<void>;
};

export default function VideoPlayer({ hostUi }: { hostUi?: HostUi } = {}) {
	const { t } = useI18n();
	/** Host 注入优先；独立运行无注入时用 document 全屏（与 mockHost 同源） */
	const setAppFullscreen = hostUi?.setAppFullscreen ?? setDocumentAppFullscreen;
	/** document 全屏路径（独立预览 / mockHost）；真 Host 影院态为 false */
	const usingDocumentFs =
		!hostUi?.setAppFullscreen ||
		hostUi.setAppFullscreen === setDocumentAppFullscreen;

	const playerRef = useRef<Player | null>(null);
	const animationRef = useRef<number | null>(null);
	const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const volumeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const screenTypeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const isFullscreenRef = useRef(false);
	/** Chromium：cursor:none 会合成 mousemove，短时忽略以免立刻又弹出 */
	const ignoreMouseRef = useRef(false);
	/** 底栏任一 POP 打开时 >0，期间不自动隐藏操作条 */
	const popoverOpenRef = useRef(0);

	const controlsRef = useRef<HTMLDivElement>(null);
	const durationRef = useRef<HTMLDivElement>(null);
	const currentTimeRef = useRef<HTMLDivElement>(null);
	const miniTimelineRef = useRef<HTMLDivElement>(null);
	const timeTipRef = useRef<HTMLDivElement>(null);
	const timePointRef = useRef<HTMLDivElement>(null);
	const volumeTipRef = useRef<HTMLDivElement>(null);
	const uploadRef = useRef<DragDropFileUploadHandle>(null);

	const [urlList, setUrlList] = useState<VideoUrlList[]>([]);
	const [playIndex, setPlayIndex] = useState(0);
	const [currentUrl, setCurrentUrl] = useState('');
	const [volume, setVolume] = useState(0.6);
	const [playType, setPlayType] = useState<PlayType>('auto');
	const [screenType, setScreenType] = useState<ScreenType>('auto');
	const [playbackRate, setPlaybackRate] = useState(1);
	const [playStatus, setPlayStatus] = useState(false);
	const [isFullscreen, setIsFullscreen] = useState(false);
	/** 标题/控制条是否可见（移动显示，静止隐藏；全屏与非全屏同一套） */
	const [uiChromeVisible, setUiChromeVisible] = useState(true);
	const [existDuration, setExistDuration] = useState(false);
	const [hoverTime, setHoverTime] = useState('');
	const [playTimeInfo, setPlayTimeInfo] = useState<{
		currentTime: number;
		duration: number;
	}>({ currentTime: 0, duration: 0 });

	const oldVolumeRef = useRef(0.6);
	const timePointMarginXRef = useRef(0);
	/** 播放列表/方式：xgplayer ended 闭包易过期，一律读 ref */
	const playTypeRef = useRef(playType);
	const playIndexRef = useRef(playIndex);
	const urlListRef = useRef(urlList);
	const currentUrlRef = useRef(currentUrl);
	playTypeRef.current = playType;
	playIndexRef.current = playIndex;
	urlListRef.current = urlList;
	currentUrlRef.current = currentUrl;
	/** 仅给 xgplayer 用，勿再挂 React 子节点（会与播放器抢 DOM） */
	const playerContainerRef = useRef<HTMLDivElement>(null);
	/** 画面 + 自定义控制条外壳，全屏目标 */
	const videoShellRef = useRef<HTMLDivElement>(null);

	const timeInfo = `${formatTime(playTimeInfo.currentTime)} / ${formatTime(playTimeInfo.duration)}`;
	const currentVideoName =
		urlList.find((i) => i.url === currentUrl)?.name ?? '';
	const chromeOn = uiChromeVisible;

	isFullscreenRef.current = isFullscreen;

	const clearVolumeTimer = useCallback(() => {
		if (volumeTimerRef.current) {
			clearTimeout(volumeTimerRef.current);
			volumeTimerRef.current = null;
		}
		volumeTimerRef.current = setTimeout(() => {
			if (volumeTipRef.current) volumeTipRef.current.style.opacity = '0';
		}, 2000);
	}, []);

	const setTimeBarWidth = useCallback(() => {
		const player = playerRef.current;
		if (!player?.duration) return;
		setPlayTimeInfo({
			currentTime: player.currentTime,
			duration: player.duration,
		});
		const percentage = (player.currentTime / player.duration) * 100;
		if (durationRef.current && currentTimeRef.current) {
			currentTimeRef.current.style.width = `${(durationRef.current.offsetWidth * percentage) / 100}px`;
		}
		if (controlsRef.current && miniTimelineRef.current) {
			miniTimelineRef.current.style.width = `${(controlsRef.current.offsetWidth * percentage) / 100}px`;
		}
	}, []);

	const trackProgress = useCallback(() => {
		setTimeBarWidth();
		animationRef.current = requestAnimationFrame(trackProgress);
	}, [setTimeBarWidth]);

	const setScreenTypeFn = useCallback(() => {
		if (screenTypeTimerRef.current) {
			clearTimeout(screenTypeTimerRef.current);
			screenTypeTimerRef.current = null;
		}
		screenTypeTimerRef.current = setTimeout(() => {
			const player = playerRef.current;
			if (player?.root) {
				const video = player.root.querySelector('video');
				if (video) {
					video.style.transform =
						screenType === 'mirror' ? 'scaleX(-1)' : 'scaleX(1)';
				}
			}
		});
	}, [screenType]);

	const onInPicture = useCallback(() => {}, []);

	/** 退出系统画中画后浏览器常会 pause，主动续播 */
	const onOutPicture = useCallback(() => {
		const player = playerRef.current;
		if (!player || player.ended) return;
		pipResumeRef.current = true;
		void player.play().finally(() => {
			pipResumeRef.current = false;
		});
	}, []);

	const setupPipListeners = useCallback(() => {
		const video = playerRef.current?.media as HTMLVideoElement | null;
		if (video) {
			video.addEventListener('enterpictureinpicture', onInPicture);
			video.addEventListener('leavepictureinpicture', onOutPicture);
		}
	}, [onInPicture, onOutPicture]);

	const removePipListeners = useCallback(() => {
		const video = playerRef.current?.media as HTMLVideoElement | null;
		if (video) {
			video.removeEventListener('enterpictureinpicture', onInPicture);
			video.removeEventListener('leavepictureinpicture', onOutPicture);
		}
	}, [onInPicture, onOutPicture]);

	const restoreTimeInfo = useCallback((time?: number) => {
		const player = playerRef.current;
		if (player?.duration) {
			setPlayTimeInfo({
				currentTime: time === 0 ? 0 : player.currentTime,
				duration: time === 0 ? 0 : player.duration,
			});
			if (currentTimeRef.current) currentTimeRef.current.style.width = '0px';
			if (miniTimelineRef.current) miniTimelineRef.current.style.width = '0px';
		}
	}, []);

	// 切换播放源
	const switchUrl = useCallback(
		(url: string, autoplay?: boolean, currentTime?: number) => {
			const player = playerRef.current;
			if (!player) return;
			trackProgress();
			setScreenTypeFn();
			if (currentTime) {
				player.currentTime = currentTime;
				setPlayTimeInfo({
					currentTime: player.currentTime,
					duration: player.duration,
				});
			}
			player.playNext({
				url,
				lang: 'zh-cn',
				autoplay,
				loop: false,
				pip: true,
				volume,
				playbackRate: PLAYBACK_RATES,
			} as ConstructorParameters<typeof Player>[0]);
		},
		[volume, trackProgress, setScreenTypeFn],
	);

	/** 切集过渡中：忽略 ended 触发的 pause，避免闪出重播/暂停 UI */
	const switchingRef = useRef(false);
	/** 退出画中画续播中：忽略浏览器 pause，避免按钮闪暂停 */
	const pipResumeRef = useRef(false);

	// 自动播放下一集（读 ref，避免 ended 监听器拿到过期 playType/index）
	// 返回是否已切到下一集
	const autoPlayNext = useCallback((): boolean => {
		const type = playTypeRef.current;
		const list = urlListRef.current;
		if (type === 'stop' || list.length === 0) return false;

		const found = list.findIndex((i) => i.url === currentUrlRef.current);
		const index = found >= 0 ? found : playIndexRef.current;

		if (type === 'auto') {
			if (index >= list.length - 1) return false;
			const nextIndex = index + 1;
			const nextUrl = list[nextIndex].url;
			switchingRef.current = true;
			setPlayIndex(nextIndex);
			setCurrentUrl(nextUrl);
			switchUrl(nextUrl, true);
			return true;
		}
		if (type === 'loop') {
			const nextIndex = index < list.length - 1 ? index + 1 : 0;
			const nextUrl = list[nextIndex].url;
			switchingRef.current = true;
			setPlayIndex(nextIndex);
			setCurrentUrl(nextUrl);
			switchUrl(nextUrl, true);
			return true;
		}
		return false;
	}, [switchUrl]);

	const autoPlayNextRef = useRef(autoPlayNext);
	autoPlayNextRef.current = autoPlayNext;

	// 初始化播放器
	const initPlayer = useCallback(
		(url: string, autoplay?: boolean, currentTime?: number) => {
			if (playerRef.current) {
				removePipListeners();
				playerRef.current.destroy();
				playerRef.current = null;
			}
			const container = playerContainerRef.current;
			if (!container) return;
			const player = new Player({
				el: container,
				url,
				lang: 'zh-cn',
				lastPlayTime: 0,
				lastPlayTimeHideDelay: 5,
				closeVideoClick: false,
				videoInit: true,
				// fluid + CSS 清掉 padding-top 会把画面高度压成 0；改铺满外壳
				fluid: false,
				width: '100%',
				height: '100%',
				autoplay,
				loop: false,
				pip: true,
				volume,
				controls: false,
				cssFullscreen: false,
				playbackRate: PLAYBACK_RATES,
				// 自定义切集，不要原生「重播」层
				ignores: ['replay'],
			} as ConstructorParameters<typeof Player>[0]);
			playerRef.current = player;

			trackProgress();
			setScreenTypeFn();

			if (currentTime) {
				player.currentTime = currentTime;
				setPlayTimeInfo({
					currentTime: player.currentTime,
					duration: player.duration,
				});
			}

			player.on('play', () => {
				switchingRef.current = false;
				player.playbackRate = playbackRate;
				trackProgress();
				setPlayStatus(true);
			});
			player.on('replay', () => {
				switchingRef.current = false;
				setPlayStatus(true);
				trackProgress();
			});
			player.on('pause', () => {
				// ended 会先 pause；切集 / 退出 PiP 续播时保持「播放中」视觉
				if (switchingRef.current || pipResumeRef.current || player.ended)
					return;
				setPlayStatus(false);
				if (animationRef.current) cancelAnimationFrame(animationRef.current);
			});
			player.on('ended', () => {
				if (animationRef.current) cancelAnimationFrame(animationRef.current);
				const switched = autoPlayNextRef.current();
				if (!switched) {
					switchingRef.current = false;
					setPlayStatus(false);
				}
			});
			player.on('destroy', () => {
				setPlayStatus(false);
				if (animationRef.current) cancelAnimationFrame(animationRef.current);
			});
			player.on('error', () => {
				switchingRef.current = false;
				setPlayStatus(false);
				if (animationRef.current) cancelAnimationFrame(animationRef.current);
			});

			setupPipListeners();
		},
		[
			volume,
			playbackRate,
			trackProgress,
			setScreenTypeFn,
			setupPipListeners,
			removePipListeners,
		],
	);

	const onFiles = useCallback((result: DragDropAcceptResult) => {
		if (result.accepted.length === 0) return;
		setUrlList((prev) => {
			const next = [...prev];
			for (const file of result.accepted) {
				if (next.length >= LIMIT) break;
				if (next.some((i) => i.name === file.name && i.size === file.size)) {
					continue;
				}
				next.push({
					url: window.URL.createObjectURL(file),
					name: file.name,
					size: file.size,
					type: file.type,
					file,
				});
			}
			return next.length === prev.length ? prev : next;
		});
	}, []);

	// 播放控制（play() 异步，状态交给 play/pause 事件；勿用即时 paused 反推）
	const onPlay = useCallback((e?: React.MouseEvent) => {
		e?.stopPropagation();
		void playerRef.current?.play();
	}, []);

	const onPause = useCallback((e?: React.MouseEvent) => {
		e?.stopPropagation();
		playerRef.current?.pause();
	}, []);

	const onShellClick = useCallback(() => {
		const player = playerRef.current;
		if (!player) return;
		if (player.paused) void player.play();
		else player.pause();
	}, []);

	const onPrev = useCallback(() => {
		if (playIndex === 0 && playType !== 'loop') return;
		if (urlList.length === 0) return;
		const curIndex = urlList.findIndex((i) => i.url === currentUrl);
		let index: number;
		if (curIndex > 0) index = curIndex - 1;
		else if (playType === 'loop') index = urlList.length - 1;
		else index = 0;
		setPlayIndex(index);
		const url = urlList[index].url;
		setCurrentUrl(url);
		switchUrl(url, true);
	}, [playIndex, playType, urlList, currentUrl, switchUrl]);

	const onNext = useCallback(() => {
		if (playIndex === urlList.length - 1 && playType !== 'loop') return;
		if (urlList.length === 0) return;
		const curIndex = urlList.findIndex((i) => i.url === currentUrl);
		let index: number;
		if (curIndex < urlList.length - 1) index = curIndex + 1;
		else if (playType === 'loop') index = 0;
		else index = urlList.length - 1;
		setPlayIndex(index);
		const url = urlList[index].url;
		setCurrentUrl(url);
		switchUrl(url, true);
	}, [playIndex, playType, urlList, currentUrl, switchUrl]);

	const onFull = useCallback(
		async (e?: React.MouseEvent) => {
			e?.stopPropagation();
			const shell = videoShellRef.current;

			if (isFullscreenRef.current) {
				shell?.classList.remove('vp-css-fullscreen');
				try {
					await setAppFullscreen(false);
				} catch {
					/* ignore */
				}
				await exitFullscreen();
				setIsFullscreen(false);
				setUiChromeVisible(true);
				return;
			}

			setIsFullscreen(true);
			setUiChromeVisible(true);
			if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
			hideTimerRef.current = setTimeout(() => {
				setUiChromeVisible(false);
				ignoreMouseRef.current = true;
				window.setTimeout(() => {
					ignoreMouseRef.current = false;
				}, 250);
			}, CHROME_HIDE_MS);

			try {
				await setAppFullscreen(true);
				// document 全屏失败时降级元素/CSS（真 Host 影院勿降级，避免 Tauri 误进元素全屏）
				if (usingDocumentFs && !getFullscreenElement() && shell) {
					const mode = await enterFullscreen(shell);
					if (mode === 'css') shell.classList.add('vp-css-fullscreen');
				}
			} catch (err) {
				console.warn('[video-player] enter fullscreen failed', err);
			}
		},
		[setAppFullscreen, usingDocumentFs],
	);

	const onPictureToPicture = useCallback(() => {
		const player = playerRef.current;
		if (!player) return;
		const video = player.media as HTMLVideoElement;
		if (!document.pictureInPictureEnabled || video.disablePictureInPicture) {
			return;
		}
		if (document.pictureInPictureElement) {
			pipResumeRef.current = true;
			void document
				.exitPictureInPicture()
				.then(() => {
					if (player.ended) {
						pipResumeRef.current = false;
						return;
					}
					return player.play();
				})
				.finally(() => {
					pipResumeRef.current = false;
				});
			return;
		}
		void video.requestPictureInPicture();
	}, []);

	const onChangePlaybackRate = useCallback((value: number) => {
		const player = playerRef.current;
		if (player) {
			player.playbackRate = value;
			setPlaybackRate(value);
		}
	}, []);

	const onVolumeChange = useCallback(() => {
		const player = playerRef.current;
		if (!player) return;
		if (player.volume !== 0) {
			oldVolumeRef.current = volume;
			setVolume(0);
		} else {
			setVolume(oldVolumeRef.current);
		}
	}, [volume]);

	const volumeSliderRef = useRef<HTMLDivElement>(null);

	/** 按指针 Y 直接映射音量，保证滑块中心贴住鼠标 */
	const setVolumeFromPointer = useCallback((clientY: number) => {
		const el = volumeSliderRef.current;
		if (!el) return;
		const { top, height } = el.getBoundingClientRect();
		if (height <= 0) return;
		const next = 1 - (clientY - top) / height;
		setVolume(Math.min(1, Math.max(0, next)));
	}, []);

	const onVolumePointerDown = useCallback(
		(e: React.PointerEvent<HTMLDivElement>) => {
			e.preventDefault();
			e.stopPropagation();
			e.currentTarget.setPointerCapture(e.pointerId);
			setVolumeFromPointer(e.clientY);
		},
		[setVolumeFromPointer],
	);

	const onVolumePointerMove = useCallback(
		(e: React.PointerEvent<HTMLDivElement>) => {
			if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;
			setVolumeFromPointer(e.clientY);
		},
		[setVolumeFromPointer],
	);

	const onCheckUrl = useCallback(
		(item: VideoUrlList, index: number) => {
			setCurrentUrl(item.url);
			setPlayIndex(index);
			switchUrl(item.url, true);
		},
		[switchUrl],
	);

	const onReset = useCallback(() => {
		setPlayStatus(false);
		restoreTimeInfo(0);
		if (animationRef.current) cancelAnimationFrame(animationRef.current);
		setUrlList([]);
		setPlayIndex(0);
		setCurrentUrl('');
		playerRef.current?.destroy();
		playerRef.current = null;
	}, [restoreTimeInfo]);

	/** 显示控制条+光标；静止后隐藏（已显示时 bump 不额外 setState；POP 打开时不隐藏） */
	const bumpChrome = useCallback(() => {
		if (ignoreMouseRef.current) return;
		setUiChromeVisible((v) => (v ? v : true));
		if (hideTimerRef.current) {
			clearTimeout(hideTimerRef.current);
			hideTimerRef.current = null;
		}
		if (popoverOpenRef.current > 0) return;
		hideTimerRef.current = setTimeout(() => {
			if (popoverOpenRef.current > 0) return;
			setUiChromeVisible(false);
			ignoreMouseRef.current = true;
			window.setTimeout(() => {
				ignoreMouseRef.current = false;
			}, 250);
		}, CHROME_HIDE_MS);
	}, []);

	const onControlsPopoverOpenChange = useCallback(
		(open: boolean) => {
			popoverOpenRef.current += open ? 1 : -1;
			if (popoverOpenRef.current < 0) popoverOpenRef.current = 0;
			if (open) {
				ignoreMouseRef.current = false;
				setUiChromeVisible(true);
				if (hideTimerRef.current) {
					clearTimeout(hideTimerRef.current);
					hideTimerRef.current = null;
				}
			} else {
				bumpChrome();
			}
		},
		[bumpChrome],
	);

	const onPlayerMouseMove = useCallback(() => {
		bumpChrome();
	}, [bumpChrome]);

	const onPlayerMouseEnter = useCallback(() => {
		bumpChrome();
	}, [bumpChrome]);

	const onPlayerMouseLeave = useCallback(() => {
		if (popoverOpenRef.current > 0) return;
		if (hideTimerRef.current) {
			clearTimeout(hideTimerRef.current);
			hideTimerRef.current = null;
		}
		ignoreMouseRef.current = false;
		setUiChromeVisible(false);
	}, []);

	const getCurrentTime = useCallback((e: MouseEvent | React.MouseEvent) => {
		const initData = { time: 0, offsetX: 0, width: 0, duration: 0, ratio: 0 };
		const rect = durationRef.current?.getBoundingClientRect();
		if (rect) {
			const offsetX = e.clientX - rect.left;
			const width = rect.width;
			const duration = playerRef.current?.duration;
			if (width && duration) {
				const ratio = offsetX / width;
				const _time = ratio * duration;
				const time = _time > duration ? duration : _time < 0 ? 0 : _time;
				return { time, offsetX, width, duration, ratio };
			}
		}
		return initData;
	}, []);

	const onMouseEnter = useCallback(
		(e: React.MouseEvent) => {
			const player = playerRef.current;
			if (!player || !existDuration) return;
			const { time, offsetX } = getCurrentTime(e);
			setHoverTime(formatTime(time));
			const rect = timeTipRef.current?.getBoundingClientRect();
			if (rect?.width && timeTipRef.current) {
				timeTipRef.current.style.left = `${offsetX - rect.width / 2}px`;
			}
		},
		[existDuration, getCurrentTime],
	);

	const onDurationClick = useCallback(
		(e: React.MouseEvent) => {
			const player = playerRef.current;
			if (!player || !existDuration) return;
			const { time } = getCurrentTime(e);
			player.seek(time);
		},
		[existDuration, getCurrentTime],
	);

	// 进度条滑块拖拽
	const onTimePointMove = useCallback(
		(e: MouseEvent) => {
			const player = playerRef.current;
			if (!player || !existDuration) return;
			const { time } = getCurrentTime(e);
			const moveWidth = e.pageX - timePointMarginXRef.current;
			if (
				moveWidth > 0 &&
				moveWidth < (durationRef.current?.clientWidth ?? 0)
			) {
				if (currentTimeRef.current)
					currentTimeRef.current.style.width = `${moveWidth}px`;
			} else if (moveWidth <= 0) {
				if (currentTimeRef.current) currentTimeRef.current.style.width = '0px';
			} else {
				if (playType === 'stop') {
					if (currentTimeRef.current && durationRef.current) {
						currentTimeRef.current.style.width = `${durationRef.current.clientWidth}px`;
					}
				} else {
					if (currentTimeRef.current)
						currentTimeRef.current.style.width = '0px';
				}
				onTimePointUp();
			}
			player.currentTime = time;
		},
		[existDuration, getCurrentTime, playType],
	);

	const onTimePointUp = useCallback(() => {
		playerRef.current?.play();
		document.removeEventListener('mousemove', onTimePointMove, true);
		document.removeEventListener('mouseup', onTimePointUp, true);
	}, [onTimePointMove]);

	const onTimePointDragStart = useCallback(
		(e: React.MouseEvent) => {
			if (!existDuration) return;
			playerRef.current?.pause();
			if (timePointRef.current) {
				timePointMarginXRef.current = e.pageX - timePointRef.current.offsetLeft;
			}
			document.addEventListener('mousemove', onTimePointMove, true);
			document.addEventListener('mouseup', onTimePointUp, true);
		},
		[existDuration, onTimePointMove, onTimePointUp],
	);

	// 键盘事件
	const onKeyDown = useCallback(
		(e: KeyboardEvent) => {
			switch (e.key) {
				case 'Escape':
					if (isFullscreenRef.current) {
						e.preventDefault();
						void onFull();
					}
					break;
				case 'ArrowLeft':
				case 'ArrowRight': {
					const player = playerRef.current;
					if (player?.paused) player.play();
					break;
				}
				case 'ArrowUp':
					setVolume((v) => Math.min(v + 0.05, 1));
					if (volumeTipRef.current) {
						volumeTipRef.current.style.opacity = '1';
						clearVolumeTimer();
					}
					break;
				case 'ArrowDown':
					setVolume((v) => Math.max(v - 0.05, 0));
					if (volumeTipRef.current) {
						volumeTipRef.current.style.opacity = '1';
						clearVolumeTimer();
					}
					break;
				default:
					break;
			}
		},
		[clearVolumeTimer, onFull],
	);

	const onFullscreenChange = useCallback(() => {
		const shell = videoShellRef.current;
		const native = !!getFullscreenElement();
		const cssFs = !!shell?.classList.contains('vp-css-fullscreen');

		if (!native && !cssFs && isFullscreenRef.current) {
			// 独立预览 / mockHost：Esc 退出 document 全屏时同步 UI
			// 真 Host（尤其 Tauri）靠 host:app-fullscreen，勿在此误清
			if (usingDocumentFs) {
				setIsFullscreen(false);
				setUiChromeVisible(true);
			}
			return;
		}
		if (cssFs && !native) setIsFullscreen(true);
	}, [usingDocumentFs]);

	const onVisibilityChange = useCallback(() => {
		if (
			document.visibilityState === 'visible' &&
			playerRef.current?.currentTime
		) {
			setTimeBarWidth();
		}
	}, [setTimeBarWidth]);

	useEffect(() => {
		const onHostFs = (e: Event) => {
			const next = !!(e as CustomEvent<{ full?: boolean }>).detail?.full;
			if (!next && isFullscreenRef.current) {
				videoShellRef.current?.classList.remove('vp-css-fullscreen');
				setIsFullscreen(false);
				setUiChromeVisible(true);
			}
		};
		window.addEventListener('host:app-fullscreen', onHostFs);
		return () => window.removeEventListener('host:app-fullscreen', onHostFs);
	}, []);

	// 副作用
	useEffect(() => {
		const player = playerRef.current;
		if (player) player.volume = volume;
	}, [volume]);

	useEffect(() => {
		setScreenTypeFn();
	}, [screenType, setScreenTypeFn]);

	useEffect(() => {
		setExistDuration(!timeInfo.includes('Infinity:NaN:NaN'));
	}, [timeInfo]);

	useEffect(() => {
		if (urlList.length === 0) return;
		if (!currentUrl) {
			setCurrentUrl(urlList[0].url);
			setPlayIndex(0);
			return;
		}
		if (playerContainerRef.current && !playerRef.current) {
			initPlayer(currentUrl, false, 0);
		}
	}, [urlList, currentUrl, initPlayer]);

	useEffect(() => {
		document.addEventListener('visibilitychange', onVisibilityChange);
		document.addEventListener('fullscreenchange', onFullscreenChange);
		document.addEventListener('keydown', onKeyDown);
		return () => {
			document.removeEventListener('visibilitychange', onVisibilityChange);
			document.removeEventListener('fullscreenchange', onFullscreenChange);
			document.removeEventListener('keydown', onKeyDown);
		};
	}, [onVisibilityChange, onFullscreenChange, onKeyDown]);

	useEffect(() => {
		return () => {
			playerRef.current?.destroy();
			playerRef.current = null;
			if (animationRef.current) cancelAnimationFrame(animationRef.current);
			if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
			if (volumeTimerRef.current) clearTimeout(volumeTimerRef.current);
			if (screenTypeTimerRef.current) clearTimeout(screenTypeTimerRef.current);
			removePipListeners();
			videoShellRef.current?.classList.remove('vp-css-fullscreen');
			void setAppFullscreen(false);
			void exitFullscreen();
		};
	}, [removePipListeners, setAppFullscreen]);

	const rulerCount = playerRef.current?.duration
		? Math.floor(playerRef.current.duration / 5)
		: 0;

	return (
		<div
			className={cn(
				'vp-wrap h-full w-full',
				isFullscreen && 'vp-theater',
				urlList.length > 0 && !chromeOn && 'vp-chrome-hidden',
			)}
		>
			<div className="vp-content">
				{/* 上传区始终挂载，便于底栏「继续选择」调用 open() */}
				<div
					className={cn(urlList.length > 0 ? 'sr-only' : 'vp-video-content')}
					aria-hidden={urlList.length > 0}
				>
					<DragDropFileUpload
						ref={uploadRef}
						className={urlList.length > 0 ? undefined : 'h-full w-full'}
						zoneClassName={
							urlList.length > 0
								? undefined
								: 'vp-upload-drag flex h-full w-full flex-1 flex-col items-center justify-center gap-2.5 border-0'
						}
						accept="video/*"
						multiple
						maxCount={LIMIT}
						ariaLabel={t('videoPlayer.selectVideo')}
						onFiles={onFiles}
					>
						{urlList.length > 0 ? null : (
							<>
								<Upload size={48} />
								<div className="text-sm">{t('videoPlayer.dragOrClick')}</div>
							</>
						)}
					</DragDropFileUpload>
				</div>

				{urlList.length > 0 ? (
					<div
						ref={videoShellRef}
						className="vp-video-content"
						onMouseMove={onPlayerMouseMove}
						onMouseEnter={onPlayerMouseEnter}
						onMouseLeave={onPlayerMouseLeave}
						onClick={onShellClick}
					>
						{/* xgplayer 独占此节点 */}
						<div ref={playerContainerRef} id="vp-player" />

						{currentVideoName ? (
							<div className="vp-video-name">{currentVideoName}</div>
						) : null}

						{!playStatus ? (
							<div
								className="vp-video-player-icon"
								onClick={(e) => {
									e.stopPropagation();
									onPlay();
								}}
							>
								<Play size={60} fill="currentColor" />
							</div>
						) : null}

						<div
							ref={controlsRef}
							className={cn(
								'vp-controls-bar',
								chromeOn && 'vp-show-controls-bar',
								chromeOn && 'vp-show-controls',
							)}
							onClick={(e) => e.stopPropagation()}
						>
							<div className="vp-progress">
								<div
									ref={durationRef}
									className="vp-duration"
									onMouseEnter={onMouseEnter}
									onMouseMove={onMouseEnter}
									onClick={onDurationClick}
								>
									{existDuration && hoverTime ? (
										<div ref={timeTipRef} className="vp-time-tip">
											{hoverTime}
										</div>
									) : null}
									<div ref={currentTimeRef} className="vp-current-time">
										{existDuration ? (
											<div
												ref={timePointRef}
												className="vp-time-point"
												onMouseDown={onTimePointDragStart}
											/>
										) : null}
									</div>
									{rulerCount > 0 && existDuration ? (
										<div className="vp-ruler">
											{Array.from({ length: rulerCount }).map((_, i) => (
												<div
													key={i}
													className={cn(
														'vp-ruler-line',
														(i + 1) % 5 === 0 && 'vp-long-line',
													)}
												/>
											))}
										</div>
									) : null}
								</div>
							</div>

							<div className="vp-player-actions">
								<div className="vp-player-actions-left">
									<div
										className={cn(
											'vp-prev',
											playIndex === 0 && playType !== 'loop' && 'vp-disabled',
										)}
										onClick={onPrev}
									>
										<SkipBack size={CTRL_ICON} />
									</div>
									<div className="vp-action-icon">
										{!playStatus ? (
											<Play size={CTRL_ICON} onClick={onPlay} />
										) : (
											<Pause size={CTRL_ICON} onClick={onPause} />
										)}
									</div>
									<div
										className={cn(
											'vp-next',
											playIndex === urlList.length - 1 &&
												playType !== 'loop' &&
												'vp-disabled',
										)}
										onClick={onNext}
									>
										<SkipForward size={CTRL_ICON} />
									</div>
									<div className="vp-player-time">
										{existDuration ? timeInfo : timeInfo.split('/')[0]}
									</div>
								</div>

								<div className="vp-player-actions-right">
									<Tip label={t('videoPlayer.continueSelect')}>
										<div
											className="vp-action-icon"
											onClick={() => uploadRef.current?.open()}
										>
											<FolderPlus size={CTRL_ICON} />
										</div>
									</Tip>
									<Tip label={t('videoPlayer.reset')}>
										<div className="vp-action-icon" onClick={onReset}>
											<ListRestart size={CTRL_ICON} />
										</div>
									</Tip>

									<Popover
										align="center"
										width={280}
										mode="hover"
										onOpenChange={onControlsPopoverOpenChange}
										onContentPointer={bumpChrome}
										trigger={() => (
											<div className="vp-action-icon">
												<Settings size={CTRL_ICON} />
											</div>
										)}
									>
										<div className="vp-url-list">
											<div className="vp-setting-item">
												<div className="vp-setting-row">
													<div className="vp-setting-label">
														{t('videoPlayer.playMode')}
													</div>
													<Segmented
														value={playType}
														options={PLAY_OPTIONS}
														onChange={(v) => setPlayType(v)}
													/>
												</div>
												<div className="vp-setting-row">
													<div className="vp-setting-label">
														{t('videoPlayer.screenMirror')}
													</div>
													<Segmented
														value={screenType}
														options={SCREEN_TYPE}
														onChange={(v) => setScreenType(v)}
													/>
												</div>
											</div>
										</div>
									</Popover>

									{urlList.length > 1 ? (
										<Popover
											align="end"
											width={360}
											mode="hover"
											contentPadding={0}
											contentClassName="vp-episodes-popover"
											onOpenChange={onControlsPopoverOpenChange}
											onContentPointer={bumpChrome}
											trigger={() => (
												<div
													className="vp-action-icon"
													title={t('videoPlayer.episodes')}
												>
													<ListVideo size={CTRL_ICON} />
												</div>
											)}
										>
											{({ close }) => (
												<div className="vp-episodes-body">
													<div className="vp-episodes-title">
														{t('videoPlayer.episodes')}
													</div>
													<ScrollArea
														type="always"
														className="vp-episodes-scroll"
														style={{ height: 300 }}
														viewportClassName="vp-episodes-viewport [&>div]:block! [&>div]:h-auto! [&>div]:min-h-0! [&>div]:min-w-0! [&>div]:max-w-full! [&>div]:w-full!"
														scrollbarClassName="vp-episodes-scrollbar"
														onWheel={(e) => e.stopPropagation()}
													>
														<div className="vp-url-list">
															{urlList.map((item, index) => (
																<div
																	key={item.url}
																	className={cn(
																		'vp-url-item',
																		playIndex === index && 'vp-active-url-item',
																	)}
																	onClick={() => {
																		onCheckUrl(item, index);
																		close();
																	}}
																>
																	{item.name}
																</div>
															))}
														</div>
													</ScrollArea>
												</div>
											)}
										</Popover>
									) : null}

									<Popover
										align="center"
										width={40}
										mode="hover"
										onOpenChange={onControlsPopoverOpenChange}
										onContentPointer={bumpChrome}
										trigger={() => (
											<div
												className="vp-action-icon"
												onClick={(e) => {
													e.stopPropagation();
													onVolumeChange();
												}}
											>
												<VolumeIcon volume={volume} />
											</div>
										)}
									>
										<div className="vp-volume-info">
											<div
												className="vp-volume-text"
												onClick={onVolumeChange}
												title={t('videoPlayer.muted')}
											>
												{(volume * 100).toFixed(0)}
											</div>
											<div
												ref={volumeSliderRef}
												className="vp-volume-slider"
												role="slider"
												tabIndex={0}
												aria-orientation="vertical"
												aria-valuemin={0}
												aria-valuemax={100}
												aria-valuenow={Math.round(volume * 100)}
												aria-valuetext={`${(volume * 100).toFixed(0)}%`}
												onPointerDown={onVolumePointerDown}
												onPointerMove={onVolumePointerMove}
												onKeyDown={(e) => {
													if (e.key === 'ArrowUp' || e.key === 'ArrowRight') {
														e.preventDefault();
														setVolume((v) => Math.min(1, v + 0.05));
													} else if (
														e.key === 'ArrowDown' ||
														e.key === 'ArrowLeft'
													) {
														e.preventDefault();
														setVolume((v) => Math.max(0, v - 0.05));
													}
												}}
											>
												<div className="vp-volume-track">
													<div
														className="vp-volume-fill"
														style={{ height: `${volume * 100}%` }}
													/>
													<div
														className="vp-volume-thumb"
														style={{ bottom: `${volume * 100}%` }}
													/>
												</div>
											</div>
										</div>
									</Popover>

									<Popover
										align="end"
										width={360}
										mode="hover"
										contentPadding={0}
										contentClassName="vp-rate-popover"
										onOpenChange={onControlsPopoverOpenChange}
										onContentPointer={bumpChrome}
										trigger={() => (
											<div className="vp-action-icon vp-action-rate">
												{playbackRate.toFixed(1)}x
											</div>
										)}
									>
										<PlaybackRatePanel
											rate={playbackRate}
											onRateChange={onChangePlaybackRate}
											label={t('videoPlayer.speed')}
										/>
									</Popover>

									<Tip label={t('videoPlayer.pip')}>
										<div
											className="vp-action-icon"
											onClick={onPictureToPicture}
										>
											<PictureInPicture2 size={CTRL_ICON} />
										</div>
									</Tip>
									<Tip
										label={
											isFullscreen
												? t('videoPlayer.exitFullscreen')
												: t('videoPlayer.fullscreen')
										}
									>
										<div className="vp-action-icon -mt-0.5" onClick={onFull}>
											{isFullscreen ? (
												<Minimize size={CTRL_ICON} />
											) : (
												<Maximize size={CTRL_ICON} />
											)}
										</div>
									</Tip>
								</div>
							</div>
						</div>

						<div
							ref={miniTimelineRef}
							className={cn(
								'vp-mini-timeline',
								!chromeOn && 'vp-show-controls-bar',
							)}
						/>

						<div ref={volumeTipRef} className="vp-volume-tip">
							<VolumeIcon volume={volume} />
							<span>
								{volume > 0
									? `${(volume * 100).toFixed(0)}%`
									: t('videoPlayer.muted')}
							</span>
						</div>
					</div>
				) : null}
			</div>
		</div>
	);
}
