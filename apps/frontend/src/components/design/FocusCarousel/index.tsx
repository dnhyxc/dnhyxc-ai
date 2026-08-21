import { type MotionStyle, motion } from 'framer-motion';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import {
	type ForwardedRef,
	forwardRef,
	type ReactNode,
	type TouchEvent as ReactTouchEvent,
	type WheelEvent as ReactWheelEvent,
	useEffect,
	useImperativeHandle,
	useRef,
	useState,
} from 'react';
import { cn } from '@/lib/utils';

const DEFAULT_EASE = [0.22, 1, 0.36, 1] as const;
const DEFAULT_AUTOPLAY_MS = 5200;
const DEFAULT_SLIDE_OFFSET = 36;
const DEFAULT_SWIPE_THRESHOLD = 48;
const DEFAULT_WHEEL_THRESHOLD = 16;
const DEFAULT_WHEEL_COOLDOWN_MS = 450;

export type FocusCarouselSlide = {
	id: string;
	/** 计数器左侧文案，缺省用 (index+1).padStart(2,'0') */
	number?: string;
};

export type FocusCarouselRenderState = {
	index: number;
	active: boolean;
	dir: 1 | -1;
};

export type FocusCarouselHandle = {
	go: (delta: number) => void;
	setIndex: (index: number) => void;
	getIndex: () => number;
};

export type FocusCarouselProps<T extends FocusCarouselSlide> = {
	/** 轮播数据；每项至少含 `id`，可选 `number` 用于计数器展示 */
	slides: readonly T[];
	/** 单页内容渲染；`state` 含当前下标、是否激活、切页方向 */
	renderSlide: (slide: T, state: FocusCarouselRenderState) => ReactNode;
	/** 自动播放间隔（ms）；传 `false` 关闭。默认 5200 */
	autoplayMs?: number | false;
	/** 鼠标悬停在轮播区域时是否暂停自动播放。默认 true */
	pauseOnHover?: boolean;
	/** 是否启用触屏左右滑动切页。默认 true */
	swipe?: boolean;
	/** 是否启用水平滚轮 / 触控板切页。默认 true */
	wheel?: boolean;
	/** 触屏滑动触发切页的最小水平位移（px）。默认 48 */
	swipeThreshold?: number;
	/** 滚轮触发切页的最小水平 delta。默认 16 */
	wheelThreshold?: number;
	/** 滚轮切页冷却时间（ms），防止连续触发。默认 450 */
	wheelCooldownMs?: number;
	/** 非激活页水平位移像素（配合方向做进出动画）。默认 36 */
	slideOffset?: number;
	/** 切页过渡：时长（秒）与缓动曲线；默认 duration 0.45、ease [0.22,1,0.36,1] */
	transition?: {
		duration?: number;
		ease?: readonly [number, number, number, number];
	};
	/** 控制条左侧提示（仅 md+ 桌面可见）；字符串会包一层 `<p>` */
	leftHint?: ReactNode;
	/** 上一页按钮无障碍文案。默认「上一张」 */
	prevAriaLabel?: string;
	/** 下一页按钮无障碍文案。默认「下一张」 */
	nextAriaLabel?: string;
	/** 分页圆点无障碍文案生成器。默认「切换到第 n 张」 */
	pageAriaLabel?: (index: number) => string;
	/** 受控当前页下标（0-based）；传入后由外部驱动切页 */
	index?: number;
	/** 非受控初始页下标。默认 0 */
	defaultIndex?: number;
	/** 页码变化回调；`dir` 为 `1` 下一页 / `-1` 上一页 */
	onIndexChange?: (index: number, dir: 1 | -1) => void;
	/** 根节点 class（外层 `motion.div`） */
	className?: string;
	/** 根节点样式；可传入 framer-motion 的 `x`/`y` 等 Motion 值 */
	style?: MotionStyle;
	/** 叠层内容区 class（`max-w-3xl` 网格容器） */
	contentClassName?: string;
	/** 底部分页控制条 class */
	controlsClassName?: string;
	/** 是否显示底部分页控制条（箭头 / 圆点 / 计数）。默认 true */
	showControls?: boolean;
	/** 是否在控制条中显示 `当前/总数` 计数器。默认 true */
	showCounter?: boolean;
};

const FocusCarouselBase = forwardRef<
	FocusCarouselHandle,
	FocusCarouselProps<FocusCarouselSlide>
>(function FocusCarousel(
	{
		slides,
		renderSlide,
		autoplayMs = DEFAULT_AUTOPLAY_MS,
		pauseOnHover = true,
		swipe = true,
		wheel = true,
		swipeThreshold = DEFAULT_SWIPE_THRESHOLD,
		wheelThreshold = DEFAULT_WHEEL_THRESHOLD,
		wheelCooldownMs = DEFAULT_WHEEL_COOLDOWN_MS,
		slideOffset = DEFAULT_SLIDE_OFFSET,
		transition,
		leftHint,
		prevAriaLabel = '上一张',
		nextAriaLabel = '下一张',
		pageAriaLabel = (i) => `切换到第 ${i + 1} 张`,
		index: controlledIndex,
		defaultIndex = 0,
		onIndexChange,
		className,
		style,
		contentClassName,
		controlsClassName,
		showControls = true,
		showCounter = true,
	},
	ref,
) {
	const duration = transition?.duration ?? 0.45;
	const ease = transition?.ease ?? DEFAULT_EASE;
	const total = slides.length;

	const [uncontrolledIndex, setUncontrolledIndex] = useState(defaultIndex);
	const [dir, setDir] = useState<1 | -1>(1);
	const index = controlledIndex ?? uncontrolledIndex;
	const prevRef = useRef(index);
	const timerRef = useRef<number | null>(null);
	const hoverRef = useRef(false);
	const touchStartRef = useRef<{ x: number; y: number } | null>(null);
	const wheelLockRef = useRef(false);
	const wheelTimerRef = useRef<number | null>(null);
	const indexRef = useRef(index);
	indexRef.current = index;

	const resetTimer = () => {
		if (autoplayMs === false) return;
		if (timerRef.current != null) window.clearTimeout(timerRef.current);
		timerRef.current = window.setTimeout(tick, autoplayMs);
	};

	const go = (delta: number) => {
		if (total <= 0) return;
		const nextDir: 1 | -1 = delta >= 0 ? 1 : -1;
		if (controlledIndex != null) {
			const cur = controlledIndex;
			const next = (((cur + delta) % total) + total) % total;
			prevRef.current = cur;
			setDir(nextDir);
			onIndexChange?.(next, nextDir);
		} else {
			setDir(nextDir);
			setUncontrolledIndex((prev) => {
				prevRef.current = prev;
				const next = (((prev + delta) % total) + total) % total;
				indexRef.current = next;
				onIndexChange?.(next, nextDir);
				return next;
			});
		}
		resetTimer();
	};

	const setIndex = (idx: number) => {
		if (total <= 0) return;
		if (controlledIndex != null) {
			if (idx === controlledIndex) {
				resetTimer();
				return;
			}
			prevRef.current = controlledIndex;
			const nextDir: 1 | -1 = idx > controlledIndex ? 1 : -1;
			setDir(nextDir);
			onIndexChange?.(idx, nextDir);
		} else {
			setUncontrolledIndex((prev) => {
				if (idx === prev) return prev;
				prevRef.current = prev;
				const nextDir: 1 | -1 = idx > prev ? 1 : -1;
				setDir(nextDir);
				indexRef.current = idx;
				onIndexChange?.(idx, nextDir);
				return idx;
			});
		}
		resetTimer();
	};

	const tick = () => {
		if (autoplayMs === false) return;
		if (!(pauseOnHover && hoverRef.current) && total > 0) {
			if (controlledIndex != null) {
				const cur = controlledIndex;
				const next = (((cur + 1) % total) + total) % total;
				prevRef.current = cur;
				setDir(1);
				onIndexChange?.(next, 1);
			} else {
				setDir(1);
				setUncontrolledIndex((prev) => {
					prevRef.current = prev;
					const next = (((prev + 1) % total) + total) % total;
					indexRef.current = next;
					onIndexChange?.(next, 1);
					return next;
				});
			}
		}
		if (timerRef.current != null) window.clearTimeout(timerRef.current);
		timerRef.current = window.setTimeout(tick, autoplayMs);
	};

	useImperativeHandle(
		ref,
		() => ({
			go,
			setIndex,
			getIndex: () => indexRef.current,
		}),
		// ponytail: go/setIndex 闭包读 ref，对外句柄稳定即可
		// eslint-disable-next-line react-hooks/exhaustive-deps
		[total, autoplayMs, pauseOnHover],
	);

	useEffect(() => {
		if (autoplayMs === false || total <= 0) return;
		timerRef.current = window.setTimeout(tick, autoplayMs);
		return () => {
			if (timerRef.current != null) window.clearTimeout(timerRef.current);
			if (wheelTimerRef.current != null) {
				window.clearTimeout(wheelTimerRef.current);
				wheelTimerRef.current = null;
			}
		};
		// ponytail: 与首页一致，仅随 slides 数量重启自动播放
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [total, autoplayMs]);

	const onTouchStart = (e: ReactTouchEvent<HTMLDivElement>) => {
		if (!swipe) return;
		const t = e.touches[0];
		if (!t) return;
		touchStartRef.current = { x: t.clientX, y: t.clientY };
	};

	const onTouchEnd = (e: ReactTouchEvent<HTMLDivElement>) => {
		if (!swipe) return;
		const start = touchStartRef.current;
		touchStartRef.current = null;
		if (!start) return;
		const end = e.changedTouches[0];
		if (!end) return;
		const dx = end.clientX - start.x;
		const dy = end.clientY - start.y;
		if (Math.abs(dx) < swipeThreshold) return;
		if (Math.abs(dx) < Math.abs(dy) * 1.2) return;
		go(dx > 0 ? 1 : -1);
	};

	const onWheel = (e: ReactWheelEvent<HTMLDivElement>) => {
		if (!wheel) return;
		const dx = e.deltaX;
		const dy = e.deltaY;
		if (Math.abs(dx) <= Math.abs(dy)) return;
		if (Math.abs(dx) < wheelThreshold) return;
		if (wheelLockRef.current) return;
		wheelLockRef.current = true;
		wheelTimerRef.current = window.setTimeout(() => {
			wheelLockRef.current = false;
			wheelTimerRef.current = null;
		}, wheelCooldownMs);
		// 与触屏一致：水平正向 → 下一张
		go(dx > 0 ? 1 : -1);
	};

	const activeSlide = slides[index];
	const counterLeft = activeSlide?.number ?? String(index + 1).padStart(2, '0');
	const counterRight = String(total).padStart(2, '0');

	return (
		<motion.div
			style={style}
			className={className}
			onMouseEnter={() => {
				if (pauseOnHover) hoverRef.current = true;
			}}
			onMouseLeave={() => {
				if (pauseOnHover) hoverRef.current = false;
			}}
			onTouchStart={onTouchStart}
			onTouchEnd={onTouchEnd}
			onWheel={onWheel}
		>
			<div
				className={cn(
					'relative mx-auto grid w-full max-w-3xl overflow-hidden',
					contentClassName,
				)}
			>
				{slides.map((s, i) => {
					const isActive = i === index;
					const x = isActive
						? 0
						: i === prevRef.current
							? -slideOffset * dir
							: slideOffset * dir;
					return (
						<motion.div
							key={s.id}
							initial={false}
							animate={{
								opacity: isActive ? 1 : 0,
								x,
								filter: isActive ? 'blur(0px)' : 'blur(6px)',
							}}
							transition={{ duration, ease }}
							className={cn(
								'col-start-1 row-start-1 flex min-w-0 flex-col will-change-transform',
								isActive
									? 'pointer-events-auto z-10'
									: 'pointer-events-none z-0',
							)}
						>
							{renderSlide(s, { index: i, active: isActive, dir })}
						</motion.div>
					);
				})}
			</div>

			{showControls && (
				<div
					className={cn(
						'mx-auto mt-10 flex w-full max-w-3xl items-center justify-between gap-4 md:mt-12',
						controlsClassName,
					)}
				>
					{typeof leftHint === 'string' ? (
						<p className="hidden text-xs text-textcolor/35 md:block md:max-w-xs">
							{leftHint}
						</p>
					) : leftHint != null ? (
						<div className="hidden md:block md:max-w-xs">{leftHint}</div>
					) : (
						<div className="hidden md:block md:max-w-xs" />
					)}
					<div className="flex items-center gap-3">
						<button
							type="button"
							aria-label={prevAriaLabel}
							onClick={() => go(-1)}
							className="flex size-8 cursor-pointer items-center justify-center rounded-lg text-textcolor/30 transition-colors hover:border hover:border-teal-500/30 hover:bg-teal-500/15 hover:text-teal-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500/30"
							style={{ touchAction: 'manipulation' }}
						>
							<ChevronLeft className="size-4" strokeWidth={2} />
						</button>
						<div className="flex items-center gap-1.5">
							{slides.map((it, idx) => {
								const active = idx === index;
								return (
									<button
										key={`pg-${it.id}`}
										type="button"
										aria-label={pageAriaLabel(idx)}
										onClick={() => setIndex(idx)}
										className="relative h-1.5 cursor-pointer rounded-full transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400/40"
										style={{
											width: active ? 24 : 7,
											touchAction: 'manipulation',
										}}
									>
										<span
											className={cn(
												'absolute inset-0 rounded-full transition-colors',
												active
													? 'bg-linear-to-r from-teal-400 to-cyan-400'
													: 'bg-textcolor/15 hover:bg-textcolor/25',
											)}
										/>
									</button>
								);
							})}
						</div>
						<button
							type="button"
							aria-label={nextAriaLabel}
							onClick={() => go(1)}
							className="flex size-8 cursor-pointer items-center justify-center rounded-lg text-textcolor/30 transition-colors hover:border hover:border-teal-500/30 hover:bg-teal-500/15 hover:text-teal-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500/30"
							style={{ touchAction: 'manipulation' }}
						>
							<ChevronRight className="size-4" strokeWidth={2} />
						</button>
						{showCounter && (
							<span className="ml-1 font-mono text-xs tabular-nums tracking-wider text-textcolor/30">
								{counterLeft}
								<span className="mx-1 text-textcolor/15">/</span>
								{counterRight}
							</span>
						)}
					</div>
				</div>
			)}
		</motion.div>
	);
});

/**
 * 焦点轮播：叠层 fade + 方向位移 + blur，支持自动播放 / 悬停暂停 / 触屏与水平滚轮。
 * 与 `@ui/carousel`（Embla）不同，适合首屏文案焦点切换。
 */
export const FocusCarousel = FocusCarouselBase as <
	T extends FocusCarouselSlide,
>(
	props: FocusCarouselProps<T> & { ref?: ForwardedRef<FocusCarouselHandle> },
) => ReturnType<typeof FocusCarouselBase>;

export default FocusCarousel;
