import {
	type CSSProperties,
	type RefObject,
	useLayoutEffect,
	useRef,
} from 'react';

type Corner = 'bl' | 'tr';

const watermarkStyle = (corner: Corner): CSSProperties => ({
	background:
		'linear-gradient(135deg, var(--brand-accent-light) 0%, var(--brand-accent) 50%, var(--brand-accent-light) 100%)',
	WebkitBackgroundClip: 'text',
	backgroundClip: 'text',
	color: 'transparent',
	WebkitTextStroke:
		'1px color-mix(in oklch, var(--brand-accent) 18%, transparent)',
	filter:
		'drop-shadow(0 0 30px color-mix(in oklch, var(--brand-accent) 15%, transparent))',
	transformOrigin: corner === 'bl' ? 'bottom left' : 'top right',
	transform: 'scaleY(0.72)',
	maskImage:
		corner === 'bl'
			? 'linear-gradient(to top, black 0%, transparent 90%)'
			: 'linear-gradient(to bottom, black 0%, transparent 90%)',
	WebkitMaskImage:
		corner === 'bl'
			? 'linear-gradient(to top, black 0%, transparent 90%)'
			: 'linear-gradient(to bottom, black 0%, transparent 90%)',
});

function Watermark({ text, corner }: { text: string; corner: Corner }) {
	const isBl = corner === 'bl';
	return (
		<div
			className={
				isBl
					? 'pointer-events-none absolute bottom-0 left-0 z-0 flex items-end justify-start overflow-hidden'
					: 'pointer-events-none absolute top-0 right-0 z-0 flex items-start justify-end overflow-hidden'
			}
			aria-hidden
		>
			<span
				className={`select-none font-black tracking-tight leading-none text-[clamp(2.75rem,6.5vw,5rem)] ${isBl ? 'pl-1.5' : 'pr-1.5'}`}
				style={watermarkStyle(corner)}
			>
				{text}
			</span>
		</div>
	);
}

type LoginDecorProps = {
	/** 网格交点对齐的目标（登录卡片） */
	alignTargetRef: RefObject<HTMLElement | null>;
};

/** 主网格边长（与 backgroundSize 128px 一致） */
const CELL = 128;
/** 流光往复周期（ms） */
const FLOW_MS = 16000;
/** 拖尾长度（px） */
const TRAIL_PX = 200;
const SAMPLE_N = 64;

/**
 * 登录页装饰：网格、角标水印、单条流星拖尾、远景光晕滤镜。
 */
export default function LoginDecor({ alignTargetRef }: LoginDecorProps) {
	const gridRef = useRef<HTMLDivElement>(null);
	const dotsRef = useRef<HTMLDivElement>(null);
	const railRef = useRef<SVGPathElement>(null);
	const canvasRef = useRef<HTMLCanvasElement>(null);

	useLayoutEffect(() => {
		// 登录页去除全局 #root 氛围光晕，保持纯网格科技风
		const root = document.getElementById('root');
		const prevBgImage = root?.style.backgroundImage;
		if (root) root.style.backgroundImage = 'none';

		const align = () => {
			const grid = gridRef.current;
			const dots = dotsRef.current;
			const rail = railRef.current;
			const canvas = canvasRef.current;
			const target = alignTargetRef.current;
			if (!grid || !target) return;
			const gridRect = grid.getBoundingClientRect();
			const targetRect = target.getBoundingClientRect();
			const cx = targetRect.left + targetRect.width / 2 - gridRect.left;
			const cy = targetRect.top + targetRect.height / 2 - gridRect.top;
			grid.style.backgroundPosition = `${cx}px ${cy}px`;
			const snap = (x: number, y: number) =>
				[
					cx + Math.round((x - cx) / CELL) * CELL,
					cy + Math.round((y - cy) / CELL) * CELL,
				] as const;
			const { width: w, height: h } = gridRect;
			const nx = Math.floor(targetRect.width / 2 / CELL) + 1;
			const ny = Math.floor(targetRect.height / 2 / CELL) + 1;
			const corners = {
				tl: snap(2 * CELL, 2 * CELL),
				tr: [cx + nx * CELL, cy - ny * CELL] as const,
				bl: [cx - nx * CELL, cy + ny * CELL] as const,
				br: snap(w - 2 * CELL, h - 2 * CELL),
			};
			if (dots) {
				for (const [key, [x, y]] of Object.entries(corners)) {
					dots.style.setProperty(`--dot-${key}-x`, `${x}px`);
					dots.style.setProperty(`--dot-${key}-y`, `${y}px`);
				}
			}
			if (rail) {
				const { bl, tl, br, tr } = corners;
				rail.setAttribute(
					'd',
					`M ${bl[0]} ${bl[1]} L ${tl[0]} ${tl[1]} L ${br[0]} ${br[1]} L ${tr[0]} ${tr[1]}`,
				);
			}
			if (canvas) {
				const dpr = Math.min(window.devicePixelRatio || 1, 2);
				canvas.width = Math.max(1, Math.floor(w * dpr));
				canvas.height = Math.max(1, Math.floor(h * dpr));
				canvas.style.width = `${w}px`;
				canvas.style.height = `${h}px`;
				canvas.getContext('2d')?.setTransform(dpr, 0, 0, dpr, 0, 0);
			}
		};

		align();
		const raf1 = requestAnimationFrame(align);
		const raf2 = requestAnimationFrame(() => requestAnimationFrame(align));
		const ro = new ResizeObserver(align);
		if (alignTargetRef.current) ro.observe(alignTargetRef.current);
		window.addEventListener('resize', align);

		return () => {
			if (root) root.style.backgroundImage = prevBgImage ?? '';
			cancelAnimationFrame(raf1);
			cancelAnimationFrame(raf2);
			ro.disconnect();
			window.removeEventListener('resize', align);
		};
	}, [alignTargetRef]);

	// 单条连续折线 + 头亮尾淡渐变 = 流星
	useLayoutEffect(() => {
		const reduce = window.matchMedia(
			'(prefers-reduced-motion: reduce)',
		).matches;
		if (reduce) return;

		const start = performance.now();
		let raf = 0;
		const tick = (now: number) => {
			const rail = railRef.current;
			const canvas = canvasRef.current;
			const ctx = canvas?.getContext('2d');
			if (rail && canvas && ctx) {
				const total = rail.getTotalLength();
				ctx.clearRect(0, 0, canvas.clientWidth, canvas.clientHeight);
				if (total > 1) {
					const accent =
						getComputedStyle(document.documentElement)
							.getPropertyValue('--brand-accent')
							.trim() || 'oklch(0.82 0.17 130)';
					const t = ((now - start) % FLOW_MS) / FLOW_MS;
					const forward = t < 0.5;
					const p = forward ? t * 2 : 2 - t * 2;
					const dist = p * total;
					const clampD = (d: number) => Math.max(0, Math.min(total, d));

					const pts: { x: number; y: number }[] = [];
					for (let i = 0; i < SAMPLE_N; i++) {
						const along = (i / (SAMPLE_N - 1)) * TRAIL_PX;
						pts.push(
							rail.getPointAtLength(
								clampD(forward ? dist - along : dist + along),
							),
						);
					}
					const tip = pts[0];
					const tail = pts[pts.length - 1];

					const grad = ctx.createLinearGradient(tip.x, tip.y, tail.x, tail.y);
					grad.addColorStop(0, accent);
					grad.addColorStop(0.2, accent);
					grad.addColorStop(1, 'rgba(0,0,0,0)');

					ctx.lineCap = 'round';
					ctx.lineJoin = 'round';
					ctx.globalAlpha = 1;
					ctx.shadowColor = accent;
					ctx.shadowBlur = 10;
					ctx.lineWidth = 2.4;
					ctx.strokeStyle = grad;
					ctx.beginPath();
					ctx.moveTo(pts[0].x, pts[0].y);
					for (let i = 1; i < pts.length; i++) {
						ctx.lineTo(pts[i].x, pts[i].y);
					}
					ctx.stroke();
				}
			}
			raf = requestAnimationFrame(tick);
		};
		raf = requestAnimationFrame(tick);
		return () => cancelAnimationFrame(raf);
	}, []);

	return (
		<>
			{/* 双层网格：细线密网 + 加粗主网 */}
			<div
				ref={gridRef}
				className="login-grid pointer-events-none absolute inset-0 z-0"
				aria-hidden
				style={{
					backgroundImage: [
						'linear-gradient(to right, color-mix(in oklch, var(--brand-accent) 16%, transparent) 1px, transparent 1px)',
						'linear-gradient(to bottom, color-mix(in oklch, var(--brand-accent) 16%, transparent) 1px, transparent 1px)',
						'linear-gradient(to right, color-mix(in oklch, var(--brand-accent) 34%, transparent) 1px, transparent 1px)',
						'linear-gradient(to bottom, color-mix(in oklch, var(--brand-accent) 34%, transparent) 1px, transparent 1px)',
					].join(', '),
					backgroundSize: '32px 32px, 32px 32px, 128px 128px, 128px 128px',
					maskImage:
						'radial-gradient(ellipse 72% 68% at 50% 48%, black 0%, black 22%, rgba(0,0,0,0.55) 48%, rgba(0,0,0,0.18) 72%, transparent 92%)',
					WebkitMaskImage:
						'radial-gradient(ellipse 72% 68% at 50% 48%, black 0%, black 22%, rgba(0,0,0,0.55) 48%, rgba(0,0,0,0.18) 72%, transparent 92%)',
				}}
			/>

			<Watermark text="DNHYXC" corner="bl" />
			<Watermark text="dnhyxc-ai" corner="tr" />

			{/* 主网交点呼吸圆点（滤镜下方） */}
			<div
				ref={dotsRef}
				className="pointer-events-none absolute inset-0 z-0"
				aria-hidden
			>
				<span
					className="login-grid-dot"
					style={{ left: 'var(--dot-tl-x)', top: 'var(--dot-tl-y)' }}
				/>
				<span
					className="login-grid-dot"
					style={{ left: 'var(--dot-tr-x)', top: 'var(--dot-tr-y)' }}
				/>
				<span
					className="login-grid-dot"
					style={{ left: 'var(--dot-bl-x)', top: 'var(--dot-bl-y)' }}
				/>
				<span
					className="login-grid-dot"
					style={{ left: 'var(--dot-br-x)', top: 'var(--dot-br-y)' }}
				/>
			</div>

			{/* 流星拖尾（滤镜下方） */}
			<svg
				className="pointer-events-none absolute inset-0 z-0 size-full opacity-0"
				aria-hidden
			>
				<title>dnhyxc-ai</title>
				<path ref={railRef} fill="none" stroke="none" />
			</svg>
			<canvas
				ref={canvasRef}
				className="login-flow pointer-events-none absolute inset-0 z-0"
				aria-hidden
			/>

			{/* 远景氛围光晕 + 柔化滤镜（盖住水印、圆点与流星） */}
			<div
				className="pointer-events-none absolute inset-0 z-1 bg-transparent backdrop-blur-xs"
				aria-hidden
				style={{
					background: [
						'radial-gradient(55% 70% at 9% 10%, color-mix(in oklch, var(--brand-accent) 5%, transparent), transparent 55%)',
						'radial-gradient(90% 70% at 70% 30%, color-mix(in oklch, var(--brand-accent) 10%, transparent), transparent 58%)',
						'radial-gradient(70% 55% at 10% 85%, color-mix(in oklch, var(--brand-accent-soft) 7%, transparent), transparent 52%)',
						'radial-gradient(55% 70% at 91% 90%, color-mix(in oklch, var(--brand-accent) 5%, transparent), transparent 55%)',
					].join(', '),
				}}
			/>
		</>
	);
}
