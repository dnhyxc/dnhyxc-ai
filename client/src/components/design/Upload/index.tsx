import { Toast } from '@ui/sonner';
import { Download, Eye, Trash2, Upload as UploadIcon } from 'lucide-react';
import { useRef, useState } from 'react';
import { cn } from '@/lib/utils';

interface IProps {
	onUpload: (files: FileWithPreview[]) => void;
	className?: string;
	getFileList?: (files: FileWithPreview[]) => void;
	fileUrl?: string;
	onClearFileUrl?: () => void;
	children?: React.ReactNode;
}

export interface FileWithPreview {
	file: File;
	preview: string;
	id: string;
}

const Upload: React.FC<IProps> = ({
	className,
	getFileList,
	onUpload,
	fileUrl,
	onClearFileUrl,
	children,
}) => {
	const [files, setFiles] = useState<FileWithPreview[]>([]);

	const fileInputRef = useRef<HTMLInputElement>(null);

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
			const validTypes = [
				'image/jpeg',
				'image/png',
				'image/gif',
				'image/svg+xml',
				'image/webp',
			];
			if (!validTypes.includes(file.type)) {
				Toast({
					type: 'error',
					title: `不支持的文件类型: ${file.type}`,
				});
				return false;
			}

			// 文件大小检查 (5MB)
			const maxSize = 5 * 1024 * 1024; // 5MB
			if (file.size > maxSize) {
				Toast({
					type: 'error',
					title: '文件大小不能超过 5MB',
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

		const fileList = [...filesWithPreview, ...files];
		setFiles((prev) => [...filesWithPreview, ...prev]);
		onUpload(fileList);
		getFileList?.(fileList);
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

	return (
		<div className={cn('w-32.5 h-32.5', className)}>
			<input
				type="file"
				ref={fileInputRef}
				onChange={onFileInputChange}
				accept="image/*"
				multiple
				className="hidden"
			/>
			{files?.length || fileUrl ? (
				<div className="relative flex items-center justify-center w-full h-full z-1 group">
					<div className="absolute inset-0 z-1 rounded-md w-full h-full bg-black/50 items-center justify-center hidden group-hover:flex">
						<Download className="w-5 h-5 cursor-pointer hover:text-green-500" />
						<Eye className="w-5 h-5 cursor-pointer ml-2 hover:text-green-500" />
						<Trash2
							className="w-5 h-5 cursor-pointer ml-2 hover:text-green-500"
							onClick={() => onDelete(files[0])}
						/>
						{children}
					</div>
					<img
						src={fileUrl || files[0].preview}
						alt=""
						className="w-full h-full object-cover rounded-md"
					/>
				</div>
			) : (
				<div
					className="w-full h-full flex items-center justify-center cursor-pointer select-none border border-dashed rounded-md p-8 text-center transition-all duration-300 border-gray-300 hover:border-gray-400 dark:hover:border-blue-400 hover:bg-gray-700 dark:hover:bg-gray-700"
					onClick={triggerFileInput}
				>
					<UploadIcon className="w-8 h-8 mx-auto text-gray-400 dark:text-gray-500" />
				</div>
			)}
		</div>
	);
};

export default Upload;
