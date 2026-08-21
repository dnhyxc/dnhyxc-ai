import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion';
import {
	type MouseEvent as ReactMouseEvent,
	type ReactNode,
	useEffect,
	useRef,
} from 'react';
import { cn } from '@/lib/utils';

export type StageCardEntry = {
	/** 列表 key；缺省用 title */
	id?: string;
	title: string;
	subtitle?: string;
	onClick?: () => void;
};

export type StageCardProps = {
	className?: string;
	/** 顶栏品牌；与 headline / status 组成默认顶栏 */
	brand?: ReactNode;
	headline?: ReactNode;
	status?: ReactNode;
	/** 自定义顶栏；传入则忽略 brand / headline / status */
	header?: ReactNode;
	/** 近景主内容（如 FocusCarousel）；自动套近景视差层 */
	children: ReactNode;
	/** 底栏入口（按列均分，常见 3 项） */
	entries?: readonly StageCardEntry[];
	entriesAriaLabel?: string;
	/** 底部水印文案；`false` 关闭。默认 "DNHYXC" */
	watermark?: string | false;
	/** 鼠标跟随 3D 倾斜。默认 true */
	tilt?: boolean;
	/** 远景氛围光晕。默认 true */
	glow?: boolean;
	/** 底栏毛玻璃遮罩。默认 true */
	mask?: boolean;
};

/**
 * 首页首屏舞台卡片：顶栏 + 近景内容 + 水印 + 底栏入口，可选鼠标 3D 倾斜与分层视差。
 */
export function StageCard({
	className,
	brand,
	headline,
	status,
	header,
	children,
	entries,
	entriesAriaLabel,
	watermark = 'DNHYXC',
	tilt = true,
	glow = true,
	mask = true,
}: StageCardProps) {
	const tiltCardRef = useRef<HTMLDivElement>(null);
	const tiltMx = useMotionValue(0);
	const tiltMy = useMotionValue(0);
	const tiltIdleRef = useRef<number | null>(null);
	const tiltRafRef = useRef(0);
	const tiltPendingRef = useRef<{ x: number; y: number } | null>(null);
	const tiltRectRef = useRef<DOMRect | null>(null);
	const tiltVisibleRef = useRef(true);
	const tiltReducedRef = useRef(false);
	const tiltHotRef = useRef(false);

	const rotateY = useSpring(useTransform(tiltMx, [-0.5, 0.5], [-3, 3]), {
		stiffness: 70,
		damping: 13,
	});
	const rotateX = useSpring(useTransform(tiltMy, [-0.5, 0.5], [3, -3]), {
		stiffness: 70,
		damping: 13,
	});
	const glowX = useSpring(useTransform(tiltMx, [-0.5, 0.5], [-5, 5]), {
		stiffness: 50,
		damping: 18,
	});
	const glowY = useSpring(useTransform(tiltMy, [-0.5, 0.5], [-3, 3]), {
		stiffness: 50,
		damping: 18,
	});
	const midX = useSpring(useTransform(tiltMx, [-0.5, 0.5], [-10, 10]), {
		stiffness: 70,
		damping: 15,
	});
	const midY = useSpring(useTransform(tiltMy, [-0.5, 0.5], [-6, 6]), {
		stiffness: 70,
		damping: 15,
	});
	const nearX = useSpring(useTransform(tiltMx, [-0.5, 0.5], [-18, 18]), {
		stiffness: 90,
		damping: 16,
	});
	const nearY = useSpring(useTransform(tiltMy, [-0.5, 0.5], [-12, 12]), {
		stiffness: 90,
		damping: 16,
	});
	const wmX = useSpring(useTransform(tiltMx, [-0.5, 0.5], [-3, 3]), {
		stiffness: 40,
		damping: 20,
	});

	const tiltReset = () => {
		tiltMx.set(0);
		tiltMy.set(0);
	};

	const syncTiltRect = (el: HTMLElement) => {
		tiltRectRef.current = el.getBoundingClientRect();
	};

	const setTiltWillChange = (on: boolean) => {
		tiltHotRef.current = on;
		const el = tiltCardRef.current;
		if (el) el.style.willChange = on ? 'transform' : 'auto';
	};

	const flushTiltMove = () => {
		tiltRafRef.current = 0;
		const p = tiltPendingRef.current;
		const rect = tiltRectRef.current;
		if (!p || !rect || rect.width <= 0 || rect.height <= 0) return;
		tiltMx.set((p.x - rect.left) / rect.width - 0.5);
		tiltMy.set((p.y - rect.top) / rect.height - 0.5);
		if (tiltIdleRef.current != null) window.clearTimeout(tiltIdleRef.current);
		tiltIdleRef.current = window.setTimeout(tiltReset, 1500);
	};

	const endTiltSession = () => {
		if (tiltRafRef.current !== 0) {
			window.cancelAnimationFrame(tiltRafRef.current);
			tiltRafRef.current = 0;
		}
		tiltPendingRef.current = null;
		if (tiltIdleRef.current != null) {
			window.clearTimeout(tiltIdleRef.current);
			tiltIdleRef.current = null;
		}
		tiltReset();
		setTiltWillChange(false);
	};

	const onTiltEnter = (e: ReactMouseEvent<HTMLDivElement>) => {
		if (!tilt || tiltReducedRef.current || !tiltVisibleRef.current) return;
		syncTiltRect(e.currentTarget);
		setTiltWillChange(true);
	};

	const onTiltMove = (e: ReactMouseEvent<HTMLDivElement>) => {
		if (!tilt || tiltReducedRef.current || !tiltVisibleRef.current) return;
		tiltPendingRef.current = { x: e.clientX, y: e.clientY };
		if (!tiltRectRef.current) syncTiltRect(e.currentTarget);
		if (tiltRafRef.current !== 0) return;
		tiltRafRef.current = window.requestAnimationFrame(flushTiltMove);
	};

	const onTiltLeave = () => endTiltSession();

	useEffect(() => {
		if (!tilt) {
			endTiltSession();
			return;
		}
		const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
		const syncMq = () => {
			tiltReducedRef.current = mq.matches;
			if (mq.matches) endTiltSession();
		};
		syncMq();
		mq.addEventListener('change', syncMq);

		const el = tiltCardRef.current;
		const io =
			el &&
			new IntersectionObserver(
				([entry]) => {
					tiltVisibleRef.current = entry?.isIntersecting ?? true;
					if (!tiltVisibleRef.current) endTiltSession();
				},
				{ threshold: 0.05 },
			);
		if (el && io) io.observe(el);

		const onResize = () => {
			if (tiltCardRef.current && tiltHotRef.current) {
				syncTiltRect(tiltCardRef.current);
			}
		};
		window.addEventListener('resize', onResize);

		return () => {
			mq.removeEventListener('change', syncMq);
			io?.disconnect();
			window.removeEventListener('resize', onResize);
			if (tiltRafRef.current !== 0) {
				window.cancelAnimationFrame(tiltRafRef.current);
			}
			if (tiltIdleRef.current != null) window.clearTimeout(tiltIdleRef.current);
		};
		// ponytail: tilt 开关变化时重建监听；handlers 读 ref
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [tilt]);

	const entryCount = entries?.length ?? 0;

	return (
		<motion.div
			ref={tiltCardRef}
			className={cn(
				'relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-md bg-theme-background',
				className,
			)}
			style={{
				rotateX: tilt ? rotateX : 0,
				rotateY: tilt ? rotateY : 0,
				transformPerspective: 1000,
				transformStyle: 'preserve-3d',
				// 圆角裁剪：避免开启 3D 倾斜后圆角失效
				clipPath: 'inset(0 round 0.375rem)',
			}}
			onMouseEnter={onTiltEnter}
			onMouseMove={onTiltMove}
			onMouseLeave={onTiltLeave}
		>
			{glow && (
				<motion.div
					className="pointer-events-none absolute inset-0"
					style={{
						x: glowX,
						y: glowY,
						scale: 1.08,
						background:
							'radial-gradient(90% 70% at 70% 30%, color-mix(in oklch, #2dd4bf 10%, transparent), transparent 58%), radial-gradient(70% 55% at 10% 85%, color-mix(in oklch, #22d3ee 7%, transparent), transparent 52%)',
					}}
					aria-hidden
				/>
			)}

			{header != null ? (
				header
			) : (
				<motion.header
					style={{ x: midX, y: midY }}
					className="relative z-10 flex h-16 shrink-0 items-center justify-between gap-4 px-8"
				>
					<div className="flex min-w-0 items-center gap-3">
						{brand != null &&
							(typeof brand === 'string' ? (
								<span className="bg-linear-to-r from-teal-400 to-cyan-400 bg-clip-text text-2xl font-black text-transparent">
									{brand}
								</span>
							) : (
								brand
							))}
						{headline != null &&
							(typeof headline === 'string' ? (
								<span className="hidden truncate text-sm text-textcolor/50 md:inline">
									{headline}
								</span>
							) : (
								headline
							))}
					</div>
					{status != null &&
						(typeof status === 'string' ? (
							<span className="hidden shrink-0 items-center gap-2 text-xs tracking-wide text-textcolor/35 sm:inline-flex">
								<span className="relative flex size-1.5">
									<span className="absolute inline-flex size-full animate-ping rounded-full bg-teal-400/50" />
									<span className="relative size-1.5 rounded-full bg-teal-500" />
								</span>
								{status}
							</span>
						) : (
							status
						))}
				</motion.header>
			)}

			{/* 近景层：主内容视差最大 */}
			<motion.div
				style={{ x: nearX, y: nearY }}
				className="relative z-10 flex min-h-0 flex-1 flex-col"
			>
				{children}
			</motion.div>

			{mask && (
				<div
					className="absolute bottom-0 left-0 z-1 h-full w-full bg-transparent backdrop-blur-md"
					style={{ transform: 'translateZ(0)', isolation: 'isolate' }}
				/>
			)}

			{watermark !== false && (
				<motion.div
					className="pointer-events-none absolute inset-x-0 bottom-0 z-0 flex items-end justify-center overflow-hidden"
					style={{ x: wmX }}
					aria-hidden
				>
					<span
						className="select-none font-black tracking-tight leading-none text-[clamp(7rem,18.78vw,18rem)]"
						style={{
							background:
								'linear-gradient(135deg, var(--brand-accent-light) 0%, var(--brand-accent) 50%, var(--brand-accent-light) 100%)',
							WebkitBackgroundClip: 'text',
							backgroundClip: 'text',
							color: 'transparent',
							WebkitTextStroke:
								'1px color-mix(in oklch, var(--brand-accent) 18%, transparent)',
							filter:
								'drop-shadow(0 0 30px color-mix(in oklch, var(--brand-accent) 15%, transparent))',
							transformOrigin: 'bottom center',
							transform: 'translateY(13%) scaleY(0.72)',
							maskImage: 'linear-gradient(to top, black 0%, transparent 90%)',
							WebkitMaskImage:
								'linear-gradient(to top, black 0%, transparent 90%)',
						}}
					>
						{watermark}
					</span>
				</motion.div>
			)}

			{entryCount > 0 && (
				<motion.nav
					style={{ x: midX, y: midY }}
					aria-label={entriesAriaLabel}
					className="relative z-10 h-16 shrink-0"
				>
					<div
						className="grid h-full"
						style={{
							gridTemplateColumns: `repeat(${entryCount}, minmax(0, 1fr))`,
						}}
					>
						{entries!.map((feature, i) => (
							<button
								key={feature.id ?? feature.title}
								type="button"
								onClick={feature.onClick}
								className={cn(
									'group flex h-full cursor-pointer items-center justify-center gap-2 px-8 transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-teal-400/35',
									i === 0 && 'justify-start text-left',
									i > 0 && i < entryCount - 1 && 'justify-center text-center',
									i === entryCount - 1 &&
										entryCount > 1 &&
										'justify-end text-right',
									entryCount === 3 && i === 1 && 'justify-end pr-5 text-center',
								)}
							>
								<span className="text-sm font-semibold tracking-normal text-textcolor transition-colors group-hover:text-teal-500">
									{feature.title}
								</span>
								{feature.subtitle != null && (
									<span className="truncate text-sm text-textcolor/40">
										{feature.subtitle}
									</span>
								)}
							</button>
						))}
					</div>
				</motion.nav>
			)}
		</motion.div>
	);
}

export default StageCard;
