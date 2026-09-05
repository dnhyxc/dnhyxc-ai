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

/**
 * 登录页装饰：网格、角标水印、远景光晕滤镜。
 */
export default function LoginDecor({ alignTargetRef }: LoginDecorProps) {
	const gridRef = useRef<HTMLDivElement>(null);

	useLayoutEffect(() => {
		// 登录页去除全局 #root 氛围光晕，保持纯网格科技风
		const root = document.getElementById('root');
		const prevBgImage = root?.style.backgroundImage;
		if (root) root.style.backgroundImage = 'none';

		const align = () => {
			const grid = gridRef.current;
			const target = alignTargetRef.current;
			if (!grid || !target) return;
			const gridRect = grid.getBoundingClientRect();
			const targetRect = target.getBoundingClientRect();
			const centerX = targetRect.left + targetRect.width / 2 - gridRect.left;
			const centerY = targetRect.top + targetRect.height / 2 - gridRect.top;
			grid.style.backgroundPosition = `${centerX}px ${centerY}px`;
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

			{/* 远景氛围光晕 + 柔化滤镜（盖住水印） */}
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
