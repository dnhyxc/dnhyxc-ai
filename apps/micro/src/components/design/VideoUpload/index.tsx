/**
 * 视频上传区：基于 DragDropFileUpload，默认 video/*、多选。
 * 与 VideoPlayer 解耦——只负责选文件，列表由外部维护。
 */

import { Upload } from 'lucide-react';
import { forwardRef, type ReactNode } from 'react';
import DragDropFileUpload, {
	type DragDropAcceptResult,
	type DragDropFileSource,
	type DragDropFileUploadHandle,
	type DragDropFileUploadProps,
} from '@/components/design/DragDropFileUpload';
import { LIMIT } from '@/components/design/VideoPlayer';
import { useI18n } from '@/hooks';
import { cn } from '@/lib/utils';

export type VideoUploadHandle = DragDropFileUploadHandle;

export type VideoUploadProps = Omit<
	DragDropFileUploadProps,
	'accept' | 'multiple' | 'maxCount' | 'onFiles'
> & {
	/** 已有条数，用于计算本次还可接受多少 */
	existingCount?: number;
	maxCount?: number;
	onFiles: (result: DragDropAcceptResult, source: DragDropFileSource) => void;
	children?: ReactNode;
};

export const VideoUpload = forwardRef<VideoUploadHandle, VideoUploadProps>(
	function VideoUpload(
		{
			existingCount = 0,
			maxCount = LIMIT,
			className,
			zoneClassName,
			ariaLabel,
			children,
			...rest
		},
		ref,
	) {
		const { t } = useI18n();
		const remain = Math.max(0, maxCount - existingCount);

		return (
			<DragDropFileUpload
				ref={ref}
				className={cn('h-full w-full min-h-0', className)}
				zoneClassName={cn(
					// 自带可见样式，不单靠嵌套 CSS
					'vp-upload-drag flex h-full min-h-0 w-full flex-1 flex-col items-center justify-center gap-2.5',
					'rounded-[10px] border border-dashed border-theme/20 text-textcolor/55',
					'hover:border-[var(--brand-accent,#14b8a6)] hover:text-[var(--brand-accent,#14b8a6)] hover:bg-theme/5',
					zoneClassName,
				)}
				accept="video/*"
				multiple
				maxCount={remain}
				ariaLabel={ariaLabel ?? t('videoPlayer.selectVideo')}
				{...rest}
				disabled={remain <= 0 || Boolean(rest.disabled)}
			>
				{children ?? (
					<>
						<Upload size={48} className="shrink-0" />
						<div className="text-sm">{t('videoPlayer.dragOrClick')}</div>
					</>
				)}
			</DragDropFileUpload>
		);
	},
);

export default VideoUpload;
