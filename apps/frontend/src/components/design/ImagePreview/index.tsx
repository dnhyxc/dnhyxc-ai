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
		const dragStartPos = useRef({ x: 0, y: 0 });
		const imgRef = useRef<HTMLImageElement>(null);
		const containerRef = useRef<HTMLDivElement>(null);

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
				if (actualTransform.scale !== 1 || actualTransform.rotate !== 0) {
					img.style.cursor = 'move';
				} else {
					img.style.cursor = 'default';
				}
			}
		}, [actualTransform.scale, actualTransform.rotate]);

		const onClose = useCallback(() => {
			showOtherModel?.();
		}, [showOtherModel]);

		const onWheel = useCallback((e: React.WheelEvent<HTMLImageElement>) => {
			if (e.deltaY < 0) {
				onScaleMax(0.05);
			} else {
				onScaleMin(0.05);
			}
		}, []);

		const onScaleMax = useCallback(
			(scale?: number) => {
				if (transformInfo.scale >= 5) {
					setIsMaxed(true);
					return;
				}
				setIsMined(false);
				const newScale = transformInfo.scale + (scale || 0.2);
				setTransformInfo((prev) => ({
					...prev,
					scale: newScale,
					imgWidth: Math.round((imgRef.current?.width || 0) * newScale),
					imgHeight: Math.round((imgRef.current?.height || 0) * newScale),
				}));
			},
			[transformInfo.scale],
		);

		const onScaleMin = useCallback(
			(scale?: number) => {
				if (transformInfo.scale <= 1.2) {
					setPosition({ x: 0, y: 0 });
				}
				if (transformInfo.scale <= 0.4) {
					setIsMined(true);
					return;
				}
				setIsMaxed(false);
				const newScale = transformInfo.scale - (scale || 0.2);
				setTransformInfo((prev) => ({
					...prev,
					scale: newScale,
					imgWidth: Math.round((imgRef.current?.width || 0) * newScale),
					imgHeight: Math.round((imgRef.current?.height || 0) * newScale),
				}));
			},
			[transformInfo.scale],
		);

		const onRotate = useCallback(() => {
			if (transformInfo.rotate >= 315) {
				setTransformInfo((prev) => ({ ...prev, rotate: 0 }));
				setPosition({ x: 0, y: 0 });
			} else {
				setTransformInfo((prev) => ({
					...prev,
					rotate: prev.rotate + 45,
				}));
			}
		}, [transformInfo.rotate]);

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

		const handleMouseDown = useCallback(
			(e: React.MouseEvent<HTMLImageElement>) => {
				if (actualTransform.scale === 1 && actualTransform.rotate === 0) {
					return;
				}
				e.preventDefault();
				setIsDragging(true);
				dragStartPos.current = {
					x: e.clientX - position.x,
					y: e.clientY - position.y,
				};
			},
			[actualTransform.scale, actualTransform.rotate, position],
		);

		const handleMouseMove = useCallback(
			(e: MouseEvent) => {
				if (!isDragging) return;

				const container = containerRef.current;
				if (!container) return;

				const img = imgRef.current;
				if (!img) return;

				const containerRect = container.getBoundingClientRect();
				const pw = containerRect.width;
				const ph = containerRect.height;
				const imgWidth = transformInfo.imgWidth || img.width;
				const imgHeight = transformInfo.imgHeight || img.height;

				// 计算最大移动距离 (Vue指令中的逻辑)
				const maxWidth = Math.abs(pw - imgWidth) / 2;
				const maxHeight = Math.abs(ph - imgHeight) / 2;
				const maxX = maxWidth + pw - 60;
				const maxY = maxHeight + ph - 60;
				const minX = -(maxWidth + pw - 60);
				const minY = -(maxHeight + ph - 60);

				const newX = e.clientX - dragStartPos.current.x;
				const newY = e.clientY - dragStartPos.current.y;

				// 图片大小小于1倍时，禁止拖动
				if (actualTransform.scale === 1 && actualTransform.rotate === 0) {
					return;
				}

				// 边界控制
				const clampedX = Math.max(minX, Math.min(maxX, newX));
				const clampedY = Math.max(minY, Math.min(maxY, newY));

				setPosition({ x: clampedX, y: clampedY });
			},
			[
				isDragging,
				actualTransform.scale,
				actualTransform.rotate,
				transformInfo.imgWidth,
				transformInfo.imgHeight,
			],
		);

		const handleMouseUp = useCallback(() => {
			setIsDragging(false);
		}, []);

		useEffect(() => {
			if (isDragging) {
				document.addEventListener('mousemove', handleMouseMove);
				document.addEventListener('mouseup', handleMouseUp);
				return () => {
					document.removeEventListener('mousemove', handleMouseMove);
					document.removeEventListener('mouseup', handleMouseUp);
				};
			}
		}, [isDragging, handleMouseMove, handleMouseUp]);

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
							className="max-w-full max-h-full object-contain transition-transform duration-300 cursor-default select-none"
							style={{
								transform: `translate(${position.x}px, ${position.y}px) rotate(${actualTransform.rotate}deg) scale(${actualTransform.scale})`,
							}}
							onWheel={onWheel}
							onMouseDown={handleMouseDown}
						/>
					</div>
				</Model>
			</div>
		);
	},
);

export default ImagePreview;
