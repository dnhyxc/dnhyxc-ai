import { ScrollArea as ScrollAreaPrimitive } from 'radix-ui';
import {
	type CSSProperties,
	forwardRef,
	type PointerEvent as ReactPointerEvent,
	useCallback,
	useEffect,
	useRef,
	useState,
} from 'react';
import { cn } from '../cn';
import { Button } from '../ui/button';
import type {
	RichTextButtonProps,
	RichTextImagePreviewProps,
	RichTextInputProps,
	RichTextKitSlots,
	RichTextScrollAreaProps,
} from './types';

/** 默认：shadcn/Radix ScrollArea（与学习笔记插件一致） */
export const DefaultScrollArea = forwardRef<
	HTMLDivElement,
	RichTextScrollAreaProps
>(function DefaultScrollArea({ className, style, onScroll, children }, ref) {
	return (
		<ScrollAreaPrimitive.Root
			data-slot="scroll-area"
			type="hover"
			className={cn('rtk-scroll-area', className)}
			style={style}
		>
			<ScrollAreaPrimitive.Viewport
				ref={ref}
				data-slot="scroll-area-viewport"
				className="rtk-scroll-viewport"
				onScroll={onScroll}
			>
				{children}
			</ScrollAreaPrimitive.Viewport>
			<ScrollAreaPrimitive.ScrollAreaScrollbar
				data-slot="scroll-area-scrollbar"
				data-orientation="vertical"
				orientation="vertical"
				className="rtk-scroll-bar"
			>
				<ScrollAreaPrimitive.ScrollAreaThumb
					data-slot="scroll-area-thumb"
					className="rtk-scroll-thumb"
				/>
			</ScrollAreaPrimitive.ScrollAreaScrollbar>
			<ScrollAreaPrimitive.Corner />
		</ScrollAreaPrimitive.Root>
	);
});

export function DefaultButton({
	className,
	variant = 'default',
	type = 'button',
	...props
}: RichTextButtonProps) {
	return (
		<button
			type={type}
			data-variant={variant}
			className={cn('rtk-btn', `rtk-btn-${variant}`, className)}
			{...props}
		/>
	);
}

export const DefaultInput = forwardRef<HTMLInputElement, RichTextInputProps>(
	function DefaultInput(
		{ className, showCount, maxLength, value, ...props },
		ref,
	) {
		const shouldShowCount =
			Boolean(showCount) && maxLength != null && maxLength > 0;
		const charCount = value == null ? 0 : String(value).length;
		const input = (
			<input
				ref={ref}
				data-slot="input"
				value={value}
				maxLength={maxLength}
				className={cn(
					'rtk-input',
					shouldShowCount && 'rtk-input-counted',
					className,
				)}
				autoCapitalize="off"
				autoCorrect="off"
				spellCheck={false}
				{...props}
			/>
		);
		if (!shouldShowCount) return input;
		return (
			<div className="rtk-input-wrap">
				{input}
				<span className="rtk-input-count" aria-hidden>
					{charCount}/{maxLength}
				</span>
			</div>
		);
	},
);

const SCALE_MIN = 0.4;
const SCALE_MAX = 5;
const SCALE_STEP = 0.2;
/** 拖出容器后至少留这么多像素在视口内，避免整张图拖没 */
const DRAG_PAD = 48;

function clampScale(n: number) {
	return Math.min(SCALE_MAX, Math.max(SCALE_MIN, Number(n.toFixed(2))));
}

function clampDragPos(
	pos: { x: number; y: number },
	container: HTMLElement,
	img: HTMLElement,
	scale: number,
	rotateDeg: number,
): { x: number; y: number } {
	const { width: cw, height: ch } = container.getBoundingClientRect();
	if (cw <= 0 || ch <= 0) return { x: 0, y: 0 };
	const rad = (rotateDeg * Math.PI) / 180;
	const w = img.offsetWidth * scale;
	const h = img.offsetHeight * scale;
	const effW = Math.abs(w * Math.cos(rad)) + Math.abs(h * Math.sin(rad));
	const effH = Math.abs(w * Math.sin(rad)) + Math.abs(h * Math.cos(rad));
	const rangeX = Math.max(0, effW / 2 - cw / 2 + DRAG_PAD);
	const rangeY = Math.max(0, effH / 2 - ch / 2 + DRAG_PAD);
	return {
		x: Math.min(rangeX, Math.max(-rangeX, pos.x)),
		y: Math.min(rangeY, Math.max(-rangeY, pos.y)),
	};
}

/** 包内简易灯箱：无 Host ImagePreview 时开箱可用 */
export function DefaultImagePreview({
	visible,
	selectedImage,
	imageList = [],
	showDownload,
	showPrevAndNext,
	title,
	download,
	onVisibleChange,
	t,
}: RichTextImagePreviewProps) {
	const [index, setIndex] = useState(0);
	const [scale, setScale] = useState(1);
	const [rotate, setRotate] = useState(0);
	const [pos, setPos] = useState({ x: 0, y: 0 });
	const [dragging, setDragging] = useState(false);
	const dragRef = useRef<{ x: number; y: number } | null>(null);
	const boxRef = useRef<HTMLDivElement>(null);
	const imgRef = useRef<HTMLImageElement>(null);
	const viewRef = useRef({ scale: 1, rotate: 0 });
	viewRef.current = { scale, rotate };

	const zoomIn = t?.('imagePreview.zoomIn') ?? '放大';
	const zoomOut = t?.('imagePreview.zoomOut') ?? '缩小';
	const rotateLabel = t?.('imagePreview.rotate') ?? '旋转';
	const resetLabel = t?.('imagePreview.reset') ?? '复原';

	useEffect(() => {
		if (!visible) return;
		const i = imageList.findIndex((img) => img.url === selectedImage?.url);
		setIndex(i >= 0 ? i : 0);
		setScale(1);
		setRotate(0);
		setPos({ x: 0, y: 0 });
	}, [visible, selectedImage?.url]);

	const current = imageList[index] ?? selectedImage;
	const close = useCallback(() => onVisibleChange?.(false), [onVisibleChange]);
	const resetView = useCallback(() => {
		setScale(1);
		setRotate(0);
		setPos({ x: 0, y: 0 });
	}, []);

	const stopDrag = useCallback(() => {
		dragRef.current = null;
		setDragging(false);
	}, []);

	const onPointerDown = useCallback(
		(e: ReactPointerEvent<HTMLImageElement>) => {
			if (e.button !== 0) return;
			e.preventDefault();
			e.currentTarget.setPointerCapture(e.pointerId);
			dragRef.current = { x: e.clientX, y: e.clientY };
			setDragging(true);
		},
		[],
	);

	const onPointerMove = useCallback(
		(e: ReactPointerEvent<HTMLImageElement>) => {
			const last = dragRef.current;
			const box = boxRef.current;
			const img = imgRef.current;
			if (!last) return;
			// 鼠标离开窗口后再进来：可能没有 pointerup，但 buttons 已为 0
			if (e.buttons === 0) {
				stopDrag();
				return;
			}
			if (!box || !img) return;
			const dx = e.clientX - last.x;
			const dy = e.clientY - last.y;
			dragRef.current = { x: e.clientX, y: e.clientY };
			const { scale: s, rotate: r } = viewRef.current;
			setPos((p) => clampDragPos({ x: p.x + dx, y: p.y + dy }, box, img, s, r));
		},
		[stopDrag],
	);

	const endDrag = useCallback(
		(e: ReactPointerEvent<HTMLImageElement>) => {
			try {
				if (e.currentTarget.hasPointerCapture(e.pointerId)) {
					e.currentTarget.releasePointerCapture(e.pointerId);
				}
			} catch {
				/* already released */
			}
			stopDrag();
		},
		[stopDrag],
	);

	useEffect(() => {
		if (!visible) return;
		const onUp = () => stopDrag();
		window.addEventListener('pointerup', onUp);
		window.addEventListener('pointercancel', onUp);
		window.addEventListener('blur', onUp);
		const onVis = () => {
			if (document.hidden) stopDrag();
		};
		document.addEventListener('visibilitychange', onVis);
		return () => {
			window.removeEventListener('pointerup', onUp);
			window.removeEventListener('pointercancel', onUp);
			window.removeEventListener('blur', onUp);
			document.removeEventListener('visibilitychange', onVis);
		};
	}, [visible, stopDrag]);

	useEffect(() => {
		if (!visible) return;
		const onKey = (e: KeyboardEvent) => {
			if (e.key === 'Escape') close();
			if (e.key === 'ArrowLeft' && showPrevAndNext && index > 0) {
				setIndex((n) => n - 1);
				resetView();
			}
			if (
				e.key === 'ArrowRight' &&
				showPrevAndNext &&
				index < imageList.length - 1
			) {
				setIndex((n) => n + 1);
				resetView();
			}
		};
		window.addEventListener('keydown', onKey);
		return () => window.removeEventListener('keydown', onKey);
	}, [visible, close, showPrevAndNext, index, imageList.length, resetView]);

	useEffect(() => {
		const box = boxRef.current;
		const img = imgRef.current;
		if (!visible || !box || !img) return;
		setPos((p) => {
			const next = clampDragPos(p, box, img, scale, rotate);
			return next.x === p.x && next.y === p.y ? p : next;
		});
	}, [visible, scale, rotate]);

	useEffect(() => {
		if (!visible) return;
		const onWheel = (e: WheelEvent) => {
			e.preventDefault();
			const k = e.ctrlKey ? 0.0022 : 0.0016;
			setScale((s) => clampScale(s * Math.exp(-e.deltaY * k)));
		};
		window.addEventListener('wheel', onWheel, { passive: false });
		return () => window.removeEventListener('wheel', onWheel);
	}, [visible]);

	if (!visible || !current?.url) return null;

	const overlayStyle: CSSProperties = {
		position: 'fixed',
		inset: 0,
		zIndex: 9999,
		background: 'rgba(0,0,0,0.72)',
		display: 'flex',
		flexDirection: 'column',
		alignItems: 'center',
		justifyContent: 'center',
		gap: 12,
		padding: 16,
		overflow: 'hidden',
	};

	return (
		<div
			role="dialog"
			aria-modal
			aria-label={title || 'Image preview'}
			style={overlayStyle}
			onClick={close}
		>
			<div
				ref={boxRef}
				style={{
					position: 'relative',
					flex: '1 1 0%',
					minHeight: 0,
					width: '100%',
					overflow: 'hidden',
					display: 'flex',
					alignItems: 'center',
					justifyContent: 'center',
				}}
				onClick={(e) => e.stopPropagation()}
			>
				<img
					ref={imgRef}
					src={current.url}
					alt=""
					draggable={false}
					onPointerDown={onPointerDown}
					onPointerMove={onPointerMove}
					onPointerUp={endDrag}
					onPointerCancel={endDrag}
					onLostPointerCapture={stopDrag}
					style={{
						maxWidth: '92vw',
						maxHeight: '72vh',
						objectFit: 'contain',
						borderRadius: 8,
						transform: `translate(${pos.x}px, ${pos.y}px) rotate(${rotate}deg) scale(${scale})`,
						transformOrigin: 'center center',
						transition: dragging ? 'none' : 'transform 0.12s ease-out',
						userSelect: 'none',
						cursor: dragging ? 'grabbing' : 'grab',
						touchAction: 'none',
					}}
				/>
			</div>
			<div
				style={{
					display: 'flex',
					flexWrap: 'wrap',
					gap: 8,
					justifyContent: 'center',
					flexShrink: 0,
					zIndex: 1,
					userSelect: 'none',
				}}
				onClick={(e) => e.stopPropagation()}
			>
				{showPrevAndNext && imageList.length > 1 ? (
					<>
						<Button
							type="button"
							variant="outline"
							disabled={index <= 0}
							onClick={() => {
								setIndex((n) => Math.max(0, n - 1));
								resetView();
							}}
						>
							上一张
						</Button>
						<Button
							type="button"
							variant="outline"
							disabled={index >= imageList.length - 1}
							onClick={() => {
								setIndex((n) => Math.min(imageList.length - 1, n + 1));
								resetView();
							}}
						>
							下一张
						</Button>
					</>
				) : null}
				<Button
					type="button"
					variant="outline"
					title={zoomIn}
					disabled={scale >= SCALE_MAX}
					onClick={() => setScale((s) => clampScale(s + SCALE_STEP))}
				>
					{zoomIn}
				</Button>
				<Button
					type="button"
					variant="outline"
					title={zoomOut}
					disabled={scale <= SCALE_MIN}
					onClick={() => setScale((s) => clampScale(s - SCALE_STEP))}
				>
					{zoomOut}
				</Button>
				<Button
					type="button"
					variant="outline"
					title={rotateLabel}
					onClick={() => setRotate((r) => r + 90)}
				>
					{rotateLabel}
				</Button>
				<Button
					type="button"
					variant="outline"
					title={resetLabel}
					disabled={
						scale === 1 && rotate % 360 === 0 && pos.x === 0 && pos.y === 0
					}
					onClick={resetView}
				>
					{resetLabel}
				</Button>
				{showDownload ? (
					<Button
						type="button"
						variant="outline"
						onClick={() => current && download?.(current)}
					>
						下载
					</Button>
				) : null}
				<Button type="button" variant="outline" onClick={close}>
					关闭
				</Button>
			</div>
		</div>
	);
}

export const defaultRichTextKitSlots: RichTextKitSlots = {
	ScrollArea: DefaultScrollArea,
	Button: DefaultButton,
	Input: DefaultInput,
	ImagePreview: DefaultImagePreview,
};
