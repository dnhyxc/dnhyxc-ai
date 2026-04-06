import {
	ChevronLeft,
	ChevronRight,
	Download,
	RefreshCw,
	RotateCw,
	X,
	ZoomIn,
	ZoomOut,
} from 'lucide-react';
import React, {
	forwardRef,
	useCallback,
	useEffect,
	useImperativeHandle,
	useMemo,
	useRef,
	useState,
} from 'react';
import { handlerDownload } from '@/utils';
import Model from '../Model';

export interface SelectedImage {
	id?: string;
	url: string;
	size?: number;
}

export interface ImagePreviewOptions {
	visible: boolean;
	imageList?: SelectedImage[];
	selectedImage?: SelectedImage;
	imageSize?: string;
	download?: (image: SelectedImage) => void;
	getImgSizeFromUrl?: (url: string) => Promise<{ size: number }>;
	changeImgUrlDomain?: (url: string) => string;
	showZoomIn?: boolean;
	showZoomOut?: boolean;
	showRotate?: boolean;
	showReset?: boolean;
	showPrevAndNext?: boolean;
	closeOnClickModal?: boolean;
	showClose?: boolean;
	showOtherModel?: () => void;
	showFooter?: boolean;
	imageTransformInfo?: {
		scale: number;
		rotate: number;
	};
}

interface ImagePreviewProps extends ImagePreviewOptions {
	onVisibleChange?: (visible: boolean) => void;
	title?: string;
}

export interface ImagePreviewHandle {
	setImage: (image: SelectedImage) => void;
}

/** 根据容器与图片（已含 scale、rotate 后的外包矩形）计算平移允许范围，padding 为贴边留白 */
function getDragBounds(
	containerW: number,
	containerH: number,
	imgLayoutW: number,
	imgLayoutH: number,
	scale: number,
	rotateDeg: number,
	padding: number,
): { minX: number; maxX: number; minY: number; maxY: number } {
	if (containerW <= 0 || containerH <= 0) {
		return { minX: 0, maxX: 0, minY: 0, maxY: 0 };
	}
	const r = (rotateDeg * Math.PI) / 180;
	const w = imgLayoutW * scale;
	const h = imgLayoutH * scale;
	const effW = Math.abs(w * Math.cos(r)) + Math.abs(h * Math.sin(r));
	const effH = Math.abs(w * Math.sin(r)) + Math.abs(h * Math.cos(r));
	const halfCW = containerW / 2;
	const halfCH = containerH / 2;
	const halfIW = effW / 2;
	const halfIH = effH / 2;
	const rangeX = Math.max(0, halfIW - halfCW + padding);
	const rangeY = Math.max(0, halfIH - halfCH + padding);
	return { minX: -rangeX, maxX: rangeX, minY: -rangeY, maxY: rangeY };
}

/** 将屏幕坐标系下的位移转到与 `translate(...) rotate(...) scale(...)` 中 translate 一致的轴向（先于 rotate 生效的平移量） */
function screenDeltaToTranslateDelta(
	dxScreen: number,
	dyScreen: number,
	rotateDeg: number,
): { dx: number; dy: number } {
	const rad = (-rotateDeg * Math.PI) / 180;
	const cos = Math.cos(rad);
	const sin = Math.sin(rad);
	return {
		dx: dxScreen * cos - dyScreen * sin,
		dy: dxScreen * sin + dyScreen * cos,
	};
}

/** 将角度归一到 [0, 360)，用于判断是否与 0° 等价（含 360、720 等） */
function normalizeRotationDeg(deg: number): number {
	const x = deg % 360;
	return x < 0 ? x + 360 : x;
}

function isRotationIdentity(deg: number, eps = 1e-6): boolean {
	const n = normalizeRotationDeg(deg);
	return n < eps || Math.abs(n - 360) < eps;
}

const ImagePreview = forwardRef<ImagePreviewHandle, ImagePreviewProps>(
	(
		{
			visible,
			imageList = [],
			selectedImage,
			imageSize,
			download,
			getImgSizeFromUrl,
			changeImgUrlDomain,
			showZoomIn = true,
			showZoomOut = true,
			showRotate = true,
			showReset = true,
			showPrevAndNext = true,
			showClose = true,
			showOtherModel,
			showFooter,
			imageTransformInfo: propImageTransformInfo,
			onVisibleChange,
			title = '图片预览',
			// 以下props在当前实现中未使用，但为了兼容性保留
			closeOnClickModal: _closeOnClickModal,
		},
		ref,
	) => {
		const [currentImage, setCurrentImage] = useState<SelectedImage>(
			selectedImage || { url: '' },
		);
		const [isMaxed, setIsMaxed] = useState(false);
		const [isMined, setIsMined] = useState(false);
		const [fileSize, setFileSize] = useState<number | null>(null);
		const [transformInfo, setTransformInfo] = useState({
			scale: 1,
			rotate: 0,
			imgWidth: 0,
			imgHeight: 0,
			boundary: true,
		});
		const [position, setPosition] = useState({ x: 0, y: 0 });
		const [isDragging, setIsDragging] = useState(false);
		const draggingRef = useRef(false);
		const lastPointerRef = useRef({ x: 0, y: 0 });
		const imgRef = useRef<HTMLImageElement>(null);
		const containerRef = useRef<HTMLDivElement>(null);
		const layoutSizeRef = useRef({ w: 0, h: 0 });

		useImperativeHandle(ref, () => ({
			setImage: (image: SelectedImage) => {
				setCurrentImage(image);
			},
		}));

		const actualTransform = useMemo(() => {
			if (propImageTransformInfo) {
				return {
					scale: propImageTransformInfo.scale,
					rotate: propImageTransformInfo.rotate,
				};
			}
			return {
				scale: transformInfo.scale,
				rotate: transformInfo.rotate,
			};
		}, [propImageTransformInfo, transformInfo.scale, transformInfo.rotate]);

		const prevImages = useMemo(() => imageList || [], [imageList]);

		const onComputedImgSize = useCallback(
			async (url: string, size?: number) => {
				if (imageSize) {
					setFileSize(0);
				} else {
					if (size) {
						setFileSize(size / 1024);
					} else {
						const replacedUrl = changeImgUrlDomain
							? changeImgUrlDomain(url)
							: url;
						const response = await getImgSizeFromUrl?.(replacedUrl);
						setFileSize(response?.size || null);
					}
				}
			},
			[imageSize, changeImgUrlDomain, getImgSizeFromUrl],
		);

		useEffect(() => {
			if (visible && selectedImage) {
				setCurrentImage(selectedImage);
				onComputedImgSize(selectedImage.url, selectedImage.size);
			}
		}, [visible, selectedImage, onComputedImgSize]);

		const onVisibleChangeHandler = useCallback(
			(visible: boolean) => {
				onVisibleChange?.(visible);
				if (visible) {
					onRefresh();
				}
			},
			[onVisibleChange],
		);

		useEffect(() => {
			const img = imgRef.current;
			if (img) {
				if (
					actualTransform.scale !== 1 ||
					!isRotationIdentity(actualTransform.rotate)
				) {
					img.style.cursor = 'move';
				} else {
					img.style.cursor = 'default';
				}
			}
		}, [actualTransform.scale, actualTransform.rotate]);

		const onClose = useCallback(() => {
			showOtherModel?.();
		}, [showOtherModel]);

		const clampPositionToBounds = useCallback(
			(
				pos: { x: number; y: number },
				scale: number,
				rotate: number,
			): { x: number; y: number } => {
				const container = containerRef.current;
				const img = imgRef.current;
				if (!container || !img) return pos;
				const cr = container.getBoundingClientRect();
				const lw = layoutSizeRef.current.w || img.offsetWidth;
				const lh = layoutSizeRef.current.h || img.offsetHeight;
				const { minX, maxX, minY, maxY } = getDragBounds(
					cr.width,
					cr.height,
					lw,
					lh,
					scale,
					rotate,
					24,
				);
				return {
					x: Math.min(maxX, Math.max(minX, pos.x)),
					y: Math.min(maxY, Math.max(minY, pos.y)),
				};
			},
			[],
		);

		const onScaleMax = useCallback((delta = 0.2) => {
			setTransformInfo((prev) => {
				if (prev.scale >= 5) {
					return prev;
				}
				const newScale = Math.min(5, prev.scale + delta);
				const img = imgRef.current;
				const nw = img?.naturalWidth || 0;
				const nh = img?.naturalHeight || 0;
				return {
					...prev,
					scale: newScale,
					imgWidth: Math.round(nw * newScale),
					imgHeight: Math.round(nh * newScale),
				};
			});
		}, []);

		const onScaleMin = useCallback((delta = 0.2) => {
			setTransformInfo((prev) => {
				if (prev.scale <= 0.4) {
					return prev;
				}
				const newScale = Math.max(0.4, prev.scale - delta);
				const img = imgRef.current;
				const nw = img?.naturalWidth || 0;
				const nh = img?.naturalHeight || 0;
				return {
					...prev,
					scale: newScale,
					imgWidth: Math.round(nw * newScale),
					imgHeight: Math.round(nh * newScale),
				};
			});
		}, []);

		useEffect(() => {
			setIsMaxed(transformInfo.scale >= 5 - 1e-9);
			setIsMined(transformInfo.scale <= 0.4 + 1e-9);
		}, [transformInfo.scale]);

		useEffect(() => {
			if (
				actualTransform.scale <= 1.001 &&
				isRotationIdentity(actualTransform.rotate)
			) {
				setPosition({ x: 0, y: 0 });
				return;
			}
			setPosition((p) => {
				const c = clampPositionToBounds(
					p,
					actualTransform.scale,
					actualTransform.rotate,
				);
				if (c.x === p.x && c.y === p.y) return p;
				return c;
			});
		}, [actualTransform.scale, actualTransform.rotate, clampPositionToBounds]);

		const onWheel = useCallback(
			(e: React.WheelEvent<HTMLImageElement>) => {
				e.preventDefault();
				e.stopPropagation();
				if (e.deltaY < 0) {
					onScaleMax(0.05);
				} else {
					onScaleMin(0.05);
				}
			},
			[onScaleMax, onScaleMin],
		);

		const onRotate = useCallback(() => {
			setTransformInfo((prev) => ({
				...prev,
				// 始终 +45°，不归零：315→360 与 0° 视觉一致，且 transition 保持正向，避免 315→0 反向插值
				rotate: prev.rotate + 45,
			}));
		}, []);

		const handleImgLoad = useCallback(() => {
			const img = imgRef.current;
			if (!img) return;
			requestAnimationFrame(() => {
				layoutSizeRef.current = {
					w: img.offsetWidth,
					h: img.offsetHeight,
				};
			});
		}, []);

		const handlePointerDown = useCallback(
			(e: React.PointerEvent<HTMLImageElement>) => {
				if (
					actualTransform.scale === 1 &&
					isRotationIdentity(actualTransform.rotate)
				) {
					return;
				}
				if (e.button !== 0) return;
				e.preventDefault();
				e.currentTarget.setPointerCapture(e.pointerId);
				draggingRef.current = true;
				setIsDragging(true);
				lastPointerRef.current = { x: e.clientX, y: e.clientY };
			},
			[actualTransform.scale, actualTransform.rotate],
		);

		const handlePointerMove = useCallback(
			(e: React.PointerEvent<HTMLImageElement>) => {
				if (!draggingRef.current) return;

				const container = containerRef.current;
				const img = imgRef.current;
				if (!container || !img) return;

				const dcx = e.clientX - lastPointerRef.current.x;
				const dcy = e.clientY - lastPointerRef.current.y;
				lastPointerRef.current = { x: e.clientX, y: e.clientY };

				if (dcx === 0 && dcy === 0) return;

				const { dx, dy } = screenDeltaToTranslateDelta(
					dcx,
					dcy,
					actualTransform.rotate,
				);

				setPosition((prev) => {
					const next = { x: prev.x + dx, y: prev.y + dy };
					const cr = container.getBoundingClientRect();
					const lw = layoutSizeRef.current.w || img.offsetWidth;
					const lh = layoutSizeRef.current.h || img.offsetHeight;
					const { minX, maxX, minY, maxY } = getDragBounds(
						cr.width,
						cr.height,
						lw,
						lh,
						actualTransform.scale,
						actualTransform.rotate,
						24,
					);
					return {
						x: Math.min(maxX, Math.max(minX, next.x)),
						y: Math.min(maxY, Math.max(minY, next.y)),
					};
				});
			},
			[actualTransform.scale, actualTransform.rotate],
		);

		const endPointerDrag = useCallback(
			(e: React.PointerEvent<HTMLImageElement>) => {
				if (!draggingRef.current) return;
				draggingRef.current = false;
				setIsDragging(false);
				try {
					e.currentTarget.releasePointerCapture(e.pointerId);
				} catch {
					// 已释放或非当前 capture
				}
			},
			[],
		);

		const handleLostPointerCapture = useCallback(() => {
			draggingRef.current = false;
			setIsDragging(false);
		}, []);

		const onDownload = useCallback(() => {
			if (download) {
				download(currentImage);
			} else {
				handlerDownload(currentImage.url);
			}
		}, [download, currentImage]);

		const onRefresh = useCallback(() => {
			setTransformInfo({
				scale: 1,
				rotate: 0,
				imgWidth: 0,
				imgHeight: 0,
				boundary: true,
			});
			setPosition({ x: 0, y: 0 });
		}, []);

		const getCurrentImageIndex = useCallback(() => {
			return prevImages.findIndex((i) => {
				if (i.id) {
					return i.id === currentImage.id;
				} else {
					return i.url === currentImage.url;
				}
			});
		}, [prevImages, currentImage]);

		const onPrev = useCallback(() => {
			onRefresh();
			const findIndex = getCurrentImageIndex();
			const prevIndex = findIndex === 0 ? prevImages.length - 1 : findIndex - 1;
			const prevImage = prevImages[prevIndex];
			setCurrentImage(prevImage);
			onComputedImgSize(prevImage.url, prevImage?.size);
		}, [prevImages, getCurrentImageIndex, onRefresh, onComputedImgSize]);

		const onNext = useCallback(() => {
			onRefresh();
			const findIndex = getCurrentImageIndex();
			const nextIndex = findIndex === prevImages.length - 1 ? 0 : findIndex + 1;
			const nextImage = prevImages[nextIndex];
			setCurrentImage(nextImage);
			onComputedImgSize(nextImage.url, nextImage?.size);
		}, [prevImages, getCurrentImageIndex, onRefresh, onComputedImgSize]);

		return (
			<div>
				<Model
					title={title}
					open={visible}
					showCloseIcon={false}
					onOpenChange={onVisibleChangeHandler}
					header={
						<div className="flex justify-between items-center pb-4.5 border-b border-theme-white/5 select-none">
							<span className="text-xl font-medium text-textcolor">
								{title}
							</span>
							<div className="relative flex items-center gap-1 -mr-2.5">
								{showZoomIn && !isMaxed && (
									<span
										className="flex items-center justify-center w-9 h-9 rounded-md bg-transparent text-foreground cursor-pointer transition-all duration-200 hover:bg-theme/10"
										onClick={() => onScaleMax(0.2)}
										title="放大"
									>
										<ZoomIn className="text-textcolor" />
									</span>
								)}
								{showZoomOut && !isMined && (
									<span
										className="flex items-center justify-center w-9 h-9 rounded-md bg-transparent text-foreground cursor-pointer transition-all duration-200 hover:bg-theme/10"
										onClick={() => onScaleMin(0.2)}
										title="缩小"
									>
										<ZoomOut className="text-textcolor" />
									</span>
								)}
								{showRotate && (
									<span
										className="flex items-center justify-center w-9 h-9 rounded-md bg-transparent text-foreground cursor-pointer transition-all duration-200 hover:bg-theme/10"
										onClick={onRotate}
										title="旋转"
									>
										<RotateCw size={22} className="text-textcolor" />
									</span>
								)}
								{(download || showZoomIn) && (
									<span
										className="flex items-center justify-center w-9 h-9 rounded-md bg-transparent text-foreground cursor-pointer transition-all duration-200 hover:bg-theme/10"
										onClick={onDownload}
										title="下载"
									>
										<Download size={22} className="text-textcolor" />
									</span>
								)}
								{showReset && (
									<span
										className="flex items-center justify-center w-9 h-9 rounded-md bg-transparent text-foreground cursor-pointer transition-all duration-200 hover:bg-theme/10"
										onClick={onRefresh}
										title="重置"
									>
										<RefreshCw size={22} className="text-textcolor" />
									</span>
								)}
								{showPrevAndNext && prevImages.length > 1 && (
									<>
										<span
											className="flex items-center justify-center w-9 h-9 rounded-md bg-transparent text-foreground cursor-pointer transition-all duration-200 hover:bg-theme/10"
											onClick={onPrev}
											title="上一张"
										>
											<ChevronLeft className="text-textcolor" />
										</span>
										<span
											className="flex items-center justify-center w-9 h-9 rounded-md bg-transparent text-foreground cursor-pointer transition-all duration-200 hover:bg-theme/10"
											onClick={onNext}
											title="下一张"
										>
											<ChevronRight className="text-textcolor" />
										</span>
									</>
								)}
								{fileSize !== null && fileSize !== 0 && (
									<span className="text-textcolor font-medium text-sm">
										{fileSize.toFixed(2)} KB
									</span>
								)}
								{imageSize && (
									<span className="text-textcolor font-medium text-sm">
										{imageSize}
									</span>
								)}
								{prevImages.length > 0 && currentImage && (
									<div className="text-sm text-textcolor">
										{prevImages.find((i) => i.url === currentImage.url)?.url}
									</div>
								)}
								<span
									className="position flex items-center justify-center w-9 h-9 rounded-md bg-transparent text-foreground cursor-pointer transition-all duration-200 hover:bg-theme/10"
									onClick={() => onVisibleChange?.(false)}
									title="关闭"
								>
									<X size={25} className="text-textcolor" />
								</span>
							</div>
						</div>
					}
					width="82vw"
					height="85vh"
					onSubmit={onClose}
					showFooter={!!showFooter}
					showClose={showClose}
				>
					<div
						className="relative w-full h-full flex items-center justify-center overflow-hidden p-5"
						ref={containerRef}
					>
						<img
							ref={imgRef}
							src={currentImage.url}
							alt=""
							className={
								isDragging
									? 'max-w-full max-h-full object-contain cursor-default select-none'
									: 'max-w-full max-h-full object-contain transition-transform duration-300 cursor-default select-none'
							}
							style={{
								touchAction: 'none',
								transform: `translate(${position.x}px, ${position.y}px) rotate(${actualTransform.rotate}deg) scale(${actualTransform.scale})`,
							}}
							onWheel={onWheel}
							onLoad={handleImgLoad}
							onPointerDown={handlePointerDown}
							onPointerMove={handlePointerMove}
							onPointerUp={endPointerDrag}
							onPointerCancel={endPointerDrag}
							onLostPointerCapture={handleLostPointerCapture}
						/>
					</div>
				</Model>
			</div>
		);
	},
);

export default ImagePreview;
