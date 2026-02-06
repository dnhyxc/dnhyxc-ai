import { Button } from '@ui/index';
import { Toast } from '@ui/sonner';
import { Download, Eye, Trash2, Upload as UploadIcon } from 'lucide-react';
import { useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { FileWithPreview } from '@/types';
import Image from '../Image';

interface IProps {
	validTypes?: string[];
	multiple?: boolean;
	maxSize?: number;
	accept?: string;
	className?: string;
	onUpload: (file: FileWithPreview | FileWithPreview[]) => void;
	getFileList?: (file: FileWithPreview | FileWithPreview[]) => void;
	fileUrl?: string;
	onClearFileUrl?: () => void;
	children?: React.ReactNode;
	uploadType?: string;
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
	maxSize = 10 * 1024 * 1024, // 5MB
}) => {
	const [files, setFiles] = useState<FileWithPreview[]>([]);

	const fileInputRef = useRef<HTMLInputElement>(null);
	const imageRef = useRef<{ reset: () => void; onPreview: () => void }>(null);

	const triggerFileInput = () => {
		fileInputRef.current?.click();
	};

	const onFileSelect = (selectedFiles: File[] | FileList) => {
		// 文件数量检查
		// if (selectedFiles.length + files.length > 5) {
		// 	return;
		// }

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
			onUpload(fileList);
			getFileList?.(fileList);
		} else {
			setFiles(filesWithPreview);
			onUpload(filesWithPreview?.[0]);
			getFileList?.(filesWithPreview?.[0]);
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
							// src={
							// 	'https://dnhyxc.cn/image/__ARTICLE_IMG__d931518c149578ee4fc656514e2224437n66efe5c8d80d0da837a3e600h1769567982687.webp'
							// }
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
				<Button
					variant="ghost"
					className="flex items-center text-sm bg-theme/5 mb-1 h-8 rounded-md"
					onClick={triggerFileInput}
				>
					{children || (
						<div className="flex items-center">
							<UploadIcon className="w-8 h-8 mx-auto text-textcolor mr-2" />
							上传文件
						</div>
					)}
				</Button>
			)}
		</div>
	);
};

export default Upload;
