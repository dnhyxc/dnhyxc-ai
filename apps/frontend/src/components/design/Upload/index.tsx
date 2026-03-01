import { Button } from '@ui/index';
import { Toast } from '@ui/sonner';
import { Download, Eye, Trash2, Upload as UploadIcon } from 'lucide-react';
import { useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { FileWithPreview } from '@/types';
import Image from '../Image';
import Tooltip from '../Tooltip';

interface IProps {
	validTypes?: string[];
	multiple?: boolean;
	maxSize?: number;
	maxCount?: number;
	countValidText?: string;
	uploadedCount?: number;
	accept?: string;
	className?: string;
	onUpload: (file: FileWithPreview | FileWithPreview[]) => Promise<void>;
	getFileList?: (file: FileWithPreview | FileWithPreview[]) => void;
	fileUrl?: string;
	onClearFileUrl?: () => void;
	children?: React.ReactNode;
	uploadType?: string;
	showTooltip?: boolean;
	tooltipContent?: React.ReactNode | string;
	disabled?: boolean;
}

const Upload: React.FC<IProps> = ({
	className,
	getFileList,
	onUpload,
	fileUrl,
	onClearFileUrl,
	children,
	uploadType = 'image',
	validTypes = [
		'image/jpeg',
		'image/png',
		'image/gif',
		'image/svg+xml',
		'image/webp',
	],
	multiple = false,
	accept = 'image/*',
	maxSize = 10 * 1024 * 1024, // 10MB
	maxCount = 5,
	countValidText = '',
	uploadedCount = 0,
	showTooltip = false,
	tooltipContent = '仅支持PDF、Word、Excel文件',
	disabled = false,
}) => {
	const [files, setFiles] = useState<FileWithPreview[]>([]);

	const fileInputRef = useRef<HTMLInputElement>(null);
	const imageRef = useRef<{ reset: () => void; onPreview: () => void }>(null);

	const triggerFileInput = () => {
		fileInputRef.current?.click();
	};

	const onFileSelect = async (selectedFiles: File[] | FileList) => {
		// 文件数量检查
		if (
			(multiple && selectedFiles.length + files.length > maxCount) ||
			uploadedCount + selectedFiles.length > maxCount
		) {
			Toast({
				type: 'error',
				title: countValidText || `最多只能同时上传 ${maxCount} 个文件`,
			});
			setFiles([]);
			return;
		}

		const newFiles = Array.from(selectedFiles).filter((file) => {
			// 文件类型检查
			if (!validTypes.includes(file.type)) {
				Toast({
					type: 'error',
					title: `不支持的文件类型: ${file.type}`,
				});
				return false;
			}

			// 文件大小检查 (10MB)
			if (file.size > maxSize) {
				Toast({
					type: 'error',
					title: `文件大小不能超过 ${maxSize / 1024 / 1024} MB`,
				});
				return false;
			}

			return true;
		});

		// 创建预览URL
		const filesWithPreview = newFiles.map((file) => ({
			file,
			preview: URL.createObjectURL(file),
			id: Math.random().toString(36).substring(2, 9),
		}));

		const fileList = multiple
			? [...filesWithPreview, ...files]
			: filesWithPreview[0];
		if (multiple) {
			setFiles((prev) => [...filesWithPreview, ...prev]);
			getFileList?.(fileList);
			await onUpload(fileList);
			setFiles([]);
		} else {
			setFiles(filesWithPreview);
			getFileList?.(filesWithPreview?.[0]);
			await onUpload(filesWithPreview?.[0]);
			setFiles([]);
		}
	};

	const onFileInputChange = (e: any) => {
		if (e.target.files.length > 0) {
			onFileSelect(e.target.files);
			// 重置input值，允许选择相同文件
			e.target.value = null;
		}
	};

	const onDelete = (file: FileWithPreview) => {
		setFiles((prev) => prev.filter((item) => item.id !== file.id));
		onClearFileUrl?.();
	};

	const onPreview = () => {
		if (imageRef.current) {
			imageRef.current.onPreview();
		}
	};

	return (
		<div className={cn('w-32.5 h-32.5', className)}>
			<input
				type="file"
				ref={fileInputRef}
				onChange={onFileInputChange}
				accept={accept}
				multiple={multiple}
				className="hidden"
			/>
			{uploadType === 'image' &&
				(files?.length || fileUrl ? (
					<div className="relative flex items-center justify-center w-full h-full z-1 group">
						<Image
							ref={imageRef}
							src={fileUrl || files[0].preview}
							showOnError
							className="relative w-full h-full rounded-md"
						>
							<div className="absolute inset-0 z-1 rounded-md w-full h-full bg-theme-background/50 items-center justify-center hidden group-hover:flex">
								<Download className="w-5 h-5 cursor-pointer hover:text-textcolor/80" />
								<Eye
									className="w-5 h-5 cursor-pointer ml-2 hover:text-textcolor/80"
									onClick={onPreview}
								/>
								<Trash2
									className="w-5 h-5 cursor-pointer ml-2 hover:text-textcolor/80"
									onClick={() => onDelete(files[0])}
								/>
								{children}
							</div>
						</Image>
					</div>
				) : (
					<div
						className="w-full h-full flex items-center justify-center cursor-pointer select-none border border-dashed rounded-md p-8 text-center transition-all duration-300 border-theme/20 hover:border-theme/80 hover:bg-theme-background/90"
						onClick={triggerFileInput}
					>
						<UploadIcon className="w-8 h-8 mx-auto text-textcolor" />
					</div>
				))}
			{uploadType === 'button' && (
				<Tooltip side="right" content={tooltipContent} disabled={!showTooltip}>
					<Button
						variant="ghost"
						className="flex items-center text-sm bg-theme/5 mb-1 h-8 rounded-md"
						disabled={disabled}
						onClick={triggerFileInput}
					>
						{children || (
							<div className="flex items-center">
								<UploadIcon className="w-8 h-8 mx-auto text-textcolor mr-2" />
								上传文件
							</div>
						)}
					</Button>
				</Tooltip>
			)}
		</div>
	);
};

export default Upload;
