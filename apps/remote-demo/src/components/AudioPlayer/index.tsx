import {
	forwardRef,
	type MouseEvent,
	useCallback,
	useEffect,
	useImperativeHandle,
	useRef,
	useState,
} from 'react';
import playPauseIcon from '../../assets/svgs/play-pause.svg';
import playStopIcon from '../../assets/svgs/play-total.svg';
import styles from './index.module.less';

export type TrackItem = {
	audioFileUrl: string;
	totalDuration?: number;
	beginTimeOffset?: number | null;
};

export type MultiAudioPlayerHandle = {
	jumpTrack: (index: number) => void;
};

export type MultiAudioPlayerProps = {
	tracksData: TrackItem[];
	updateActived: (index: number) => void;
};

function formatTotalMinutes(seconds: number): string {
	const totalSecs = Math.floor(seconds);
	const mins = Math.floor(totalSecs / 60);
	const secs = totalSecs % 60;
	return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

/**
 * 播放/seek 用 goTo（loadedmetadata 后再设 currentTime），避免原 canplaythrough 竞态。
 */
const MultiAudioPlayer = forwardRef<
	MultiAudioPlayerHandle,
	MultiAudioPlayerProps
>(({ updateActived, tracksData }, ref) => {
	const audioRef = useRef<HTMLAudioElement>(null);
	const currentIndexRef = useRef(0);
	const tracksRef = useRef<TrackItem[]>([]);
	const startTimesRef = useRef<number[]>([]);
	const playingRef = useRef(false);
	const totalRef = useRef(0);
	const goToRef = useRef<(i: number, local: number, autoPlay: boolean) => void>(
		() => undefined,
	);

	const [tracks, setTracks] = useState<TrackItem[]>([]);
	const [currentIndex, setCurrentIndex] = useState(0);
	const [isPlaying, setIsPlaying] = useState(false);
	const [totalDuration, setTotalDuration] = useState(0);
	const [currentProgress, setCurrentProgress] = useState(0);
	const [trackStartTimes, setTrackStartTimes] = useState<number[]>([]);

	tracksRef.current = tracks;
	startTimesRef.current = trackStartTimes;
	playingRef.current = isPlaying;
	totalRef.current = totalDuration;

	goToRef.current = (i, local, autoPlay) => {
		const a = audioRef.current;
		const list = tracksRef.current;
		if (!a || i < 0 || i >= list.length) return;

		const url = list[i].audioFileUrl || '';
		const apply = () => {
			a.currentTime = Math.max(0, local);
			setCurrentProgress((startTimesRef.current[i] || 0) + Math.max(0, local));
			if (autoPlay) {
				void a.play().then(() => {
					playingRef.current = true;
					setIsPlaying(true);
				});
			}
		};

		const srcReady =
			a.src !== '' &&
			a.src !== window.location.href &&
			(a.src === url || a.src.endsWith(url) || decodeURI(a.src).includes(url));
		const sameTrack = i === currentIndexRef.current && srcReady;

		if (sameTrack) {
			apply();
			return;
		}

		currentIndexRef.current = i;
		setCurrentIndex(i);
		const onMeta = () => {
			a.removeEventListener('loadedmetadata', onMeta);
			apply();
		};
		a.addEventListener('loadedmetadata', onMeta);
		a.src = url;
		a.load();
	};

	const handleStop = useCallback(() => {
		const audio = audioRef.current;
		if (!audio) return;
		audio.pause();
		audio.currentTime = 0;
		setIsPlaying(false);
		setCurrentIndex(0);
		setCurrentProgress(0);
		currentIndexRef.current = 0;
		playingRef.current = false;
	}, []);

	const playTrack = useCallback(
		(index: number): Promise<void> => {
			return new Promise((resolve) => {
				const currentTracks = tracksRef.current;
				if (index < 0 || index >= currentTracks.length) {
					handleStop();
					resolve();
					return;
				}
				if (!audioRef.current) {
					resolve();
					return;
				}
				goToRef.current(index, 0, true);
				resolve();
			});
		},
		[handleStop],
	);

	useImperativeHandle(ref, () => ({ jumpTrack: playTrack }), [playTrack]);

	useEffect(() => {
		setTracks(tracksData);
		tracksRef.current = tracksData;
		setCurrentIndex(0);
		currentIndexRef.current = 0;
		setCurrentProgress(0);
	}, [tracksData]);

	// 根据轨列表算出每段时长与在「全局时间轴」上的起点，供进度条与 seek 映射使用；list 变时由下方 effect 调用
	const loadAudioInfo = useCallback(async (list: TrackItem[]) => {
		// 与 list 下标一一对应的每段时长（秒），先声明后按轨填充
		const durs: number[] = [];
		// 逐段解析时长：有声明用声明，否则用临时 Audio 拉 metadata（串行 await，避免并发占带宽）
		for (const t of list) {
			// 后端已给正数 totalDuration 时直接采用，跳过网络探测
			if (t.totalDuration && t.totalDuration > 0) {
				// 写入本段声明时长，保证 durs[i] 与 list[i] 对齐
				durs.push(t.totalDuration);
				// 本段无需探测，进入下一轨
				continue;
			}
			// 声明缺失或为 0：创建隐藏 Audio，等 loadedmetadata 再取真实 duration
			const dur = await new Promise<number>((resolve) => {
				// 仅用于读时长，不挂到 DOM、不播放
				const a = new Audio();
				// 只要元数据（含 duration），不必缓冲整段媒体
				a.preload = 'metadata';
				// 元数据就绪：用有限 duration，NaN/Infinity 则当 0，避免污染总时长
				a.addEventListener('loadedmetadata', () => {
					resolve(Number.isFinite(a.duration) ? a.duration : 0);
				});
				// 地址无效或解码失败：该段按 0 秒计入，不中断后续轨
				a.addEventListener('error', () => resolve(0));
				// 赋值 src 触发加载；须在监听之后设置，避免竞态丢事件
				a.src = t.audioFileUrl;
			});
			// 探测结果写入 durs，与声明路径共用后续 startTimes 逻辑
			durs.push(dur);
		}

		// 累加游标：表示「下一段若无 beginTimeOffset 时」应落在的全局起点
		let acc = 0;
		// 每段在全局时间轴上的起点（秒），progress = startTimes[index] + audio.currentTime
		const startTimes: number[] = [];
		// 按序算出每段全局起点，并推进 acc 到「本段结束」位置
		for (let i = 0; i < list.length; i++) {
			// 第 0 段固定从 0；其后优先用后端 beginTimeOffset，否则用前面累计出的 acc
			const start =
				i === 0
					? 0
					: list[i].beginTimeOffset != null
						? (list[i].beginTimeOffset as number)
						: acc;
			// 记下本段全局起点，供 timeupdate / seek 反查用
			startTimes.push(start);
			// 本段结束后的全局时间 = 起点 + 本段时长；作为下一段默认起点
			acc = start + (durs[i] || 0);
		}

		// 写入各段全局起点，驱动 seek 时「点进度 → 落在哪一段」
		setTrackStartTimes(startTimes);
		// 总时长 = 各段时长之和，作为进度条分母与右侧总时间展示
		setTotalDuration(durs.reduce((s, d) => s + d, 0));
		// 无外部依赖：只通过入参 list 与 setState 工作，引用保持稳定
	}, []);

	useEffect(() => {
		void loadAudioInfo(tracks);
	}, [tracks, loadAudioInfo]);

	useEffect(() => {
		const audio = audioRef.current;
		if (!audio) return;

		const handleTimeUpdate = () => {
			const idx = currentIndexRef.current;
			if (idx < 0 || idx >= startTimesRef.current.length) return;
			setCurrentProgress((startTimesRef.current[idx] || 0) + audio.currentTime);
		};

		const handleTrackEnded = () => {
			const idx = currentIndexRef.current;
			const list = tracksRef.current;
			if (idx < list.length - 1) {
				goToRef.current(idx + 1, 0, true);
			} else {
				setIsPlaying(false);
				playingRef.current = false;
				currentIndexRef.current = list.length;
				setCurrentProgress(totalRef.current);
			}
		};

		const handleError = (e: Event) => {
			console.error('音频加载错误:', e);
			setIsPlaying(false);
			playingRef.current = false;
		};

		audio.addEventListener('timeupdate', handleTimeUpdate);
		audio.addEventListener('ended', handleTrackEnded);
		audio.addEventListener('error', handleError);
		return () => {
			audio.removeEventListener('timeupdate', handleTimeUpdate);
			audio.removeEventListener('ended', handleTrackEnded);
			audio.removeEventListener('error', handleError);
		};
	}, []);

	useEffect(() => {
		updateActived(currentIndex);
	}, [currentIndex, updateActived]);

	const togglePlay = async () => {
		const audio = audioRef.current;
		if (!audio || tracks.length === 0) return;

		if (isPlaying) {
			audio.pause();
			setIsPlaying(false);
			playingRef.current = false;
			return;
		}

		try {
			const isEnded = currentIndexRef.current >= tracks.length;
			if (isEnded) {
				handleStop();
				await playTrack(0);
			} else if (audio.src === '' || audio.src === window.location.href) {
				await playTrack(0);
			} else {
				await audio.play();
				setIsPlaying(true);
				playingRef.current = true;
			}
		} catch (err) {
			console.error('播放失败:', err);
			setIsPlaying(false);
			playingRef.current = false;
		}
	};

	const handleSeekTo = (e: MouseEvent<HTMLDivElement>) => {
		if (tracks.length === 0 || totalDuration === 0) return;

		const rect = e.currentTarget.getBoundingClientRect();
		const clickPercent = Math.max(
			0,
			Math.min(1, (e.clientX - rect.left) / rect.width),
		);
		const targetTime = clickPercent * totalDuration;

		let targetIndex = 0;
		for (let i = tracks.length - 1; i >= 0; i--) {
			if (targetTime >= (trackStartTimes[i] || 0)) {
				targetIndex = i;
				break;
			}
		}
		const trackStartTime = trackStartTimes[targetIndex] || 0;
		const trackCurrentTime = targetTime - trackStartTime;
		goToRef.current(targetIndex, trackCurrentTime, true);
	};

	const progressPercent =
		totalDuration > 0 ? (currentProgress / totalDuration) * 100 : 0;

	return (
		<div className={styles.multiAudioPlayer}>
			<div className={styles.customPlayer}>
				<img
					className={styles.playImg}
					src={isPlaying ? playPauseIcon : playStopIcon}
					alt=""
					onClick={() => void togglePlay()}
				/>
				<div className={styles.progressContainer} onClick={handleSeekTo}>
					<div
						className={styles.progressBar}
						style={{ width: `${progressPercent}%` }}
					>
						<div className={styles.progressCircle} />
					</div>
				</div>
				<div className={styles.timeDisplay}>
					<span className={styles.currentTime}>
						{formatTotalMinutes(currentProgress)}
					</span>
					/
					<span className={styles.totalTime}>
						{formatTotalMinutes(totalDuration)}
					</span>
				</div>
			</div>
			{/* 隐藏的audio元素用于实际播放 */}
			{/** biome-ignore lint/a11y/useMediaCaption: 隐藏的audio元素用于实际播放 */}
			<audio ref={audioRef} style={{ display: 'none' }} preload="auto" />
		</div>
	);
});

MultiAudioPlayer.displayName = 'MultiAudioPlayer';

export default MultiAudioPlayer;
