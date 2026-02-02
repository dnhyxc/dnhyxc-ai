import React, {
	forwardRef,
	useEffect,
	useImperativeHandle,
	useState,
} from 'react';
import { cn } from '@/lib/utils';
import ImagePreview from '../ImagePreview';

export interface ImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
	src: string;
	size?: number;
	alt?: string;
	className?: string;
	imgClassName?: string;
	fallbackSrc?: string;
	showOnError?: boolean;
	loading?: 'lazy' | 'eager';
	onLoad?: () => void;
	onError?: () => void;
	children?: React.ReactNode;
}

export interface ImageHandle {
	onPreview: () => void;
	reset?: () => void;
}

const Image = forwardRef<ImageHandle, ImageProps>(
	(
		{
			src,
			size,
			alt,
			className,
			fallbackSrc,
			showOnError = false,
			loading = 'lazy',
			onLoad,
			onError,
			children,
			imgClassName,
			...props
		},
		ref,
	) => {
		const [hasError, setHasError] = useState(false);
		const [isLoading, setIsLoading] = useState(true);
		const [visible, setVisible] = useState(false);

		// Reset state when src changes
		useEffect(() => {
			setHasError(false);
			setIsLoading(true);
		}, [src]);

		useImperativeHandle(ref, () => ({
			reset: () => {
				setHasError(false);
				setIsLoading(true);
			},
			onPreview: () => {
				setVisible(true);
			},
		}));

		const handleLoad = () => {
			setIsLoading(false);
			onLoad?.();
		};

		const handleError = () => {
			setIsLoading(false);
			setHasError(true);
			onError?.();
		};

		// Don't render anything if there's an error and showOnError is false
		if (hasError && !showOnError) {
			return null;
		}

		// If there's an error but we have a fallback, use the fallback
		const imageSrc = hasError && fallbackSrc ? fallbackSrc : src;

		// If there's an error, no fallback, and we should show on error, render the broken image
		if (hasError && !fallbackSrc && showOnError) {
			return (
				<div
					className={cn(
						'relative flex items-center justify-center bg-theme/5 border-theme/20 rounded',
						className,
					)}
					{...props}
				>
					<span className="text-textcolor/50 text-sm">图片加载失败</span>
					<div className="absolute inset-0 z-2 rounded-md w-full h-full bg-theme-background/50 items-center justify-center hidden group-hover:flex">
						{children}
					</div>
					<ImagePreview
						visible={visible}
						selectedImage={{
							url: imageSrc,
							id: '1',
						}}
						onVisibleChange={() => setVisible(false)}
					/>
				</div>
			);
		}

		return (
			<div className={cn('relative group', className)}>
				<img
					src={imageSrc}
					alt={alt || ''}
					className={cn(
						'transition-opacity duration-200 w-full h-full object-cover rounded-md',
						isLoading ? 'opacity-0' : 'opacity-100',
						imgClassName,
					)}
					loading={loading}
					onLoad={handleLoad}
					onError={handleError}
					{...props}
				/>
				<div className="absolute inset-0 z-1 rounded-md w-full h-full bg-theme-background/50 items-center justify-center hidden group-hover:flex">
					{children}
				</div>
				<ImagePreview
					visible={visible}
					selectedImage={{
						url: src,
						size,
						id: '1',
					}}
					onVisibleChange={() => setVisible(false)}
				/>
			</div>
		);
	},
);

Image.displayName = 'Image';

export default Image;
