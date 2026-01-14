import { Toast } from '@ui/sonner';
import { CloudUpload } from 'lucide-react';
import { useCallback, useRef, useState } from 'react';

interface FileWithPreview {
	file: File;
	preview: string;
	id: string;
}

interface IProps {
	uploadFile?: (file: File) => Promise<void>;
	getFileList?: (files: FileWithPreview[]) => void;
}

const Upload: React.FC<IProps> = ({ uploadFile, getFileList }) => {
	const [files, setFiles] = useState<FileWithPreview[]>([]);
	const [isDragging, setIsDragging] = useState(false);

	const fileInputRef = useRef<HTMLInputElement>(null);

	const triggerFileInput = () => {
		fileInputRef.current?.click();
	};

	const onDragEnter = (e: any) => {
		e.preventDefault();
	};

	const onDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
		e.preventDefault();
		setIsDragging(true);
	}, []);

	const onDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
		e.preventDefault();
		setIsDragging(false);
	}, []);

	const onDrop = useCallback(
		(e: React.DragEvent<HTMLDivElement>) => {
			e.preventDefault();
			setIsDragging(false);

			if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
				onFileSelect(e.dataTransfer.files);
			}
		},
		[files],
	);

	const onFileInputChange = (e: any) => {
		if (e.target.files.length > 0) {
			onFileSelect(e.target.files);
			// 重置input值，允许选择相同文件
			e.target.value = null;
		}
	};

	const onClickSelect = (e: React.MouseEvent<HTMLSpanElement>) => {
		e.stopPropagation();
		triggerFileInput();
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
		getFileList?.(fileList);
		onUpload(fileList);
	};

	const onUpload = async (fileList: FileWithPreview[]) => {
		if (fileList.length) {
			fileList.forEach(async (data) => {
				await uploadFile?.(data.file);
				setFiles([]);
				getFileList?.([]);
			});
		}
	};

	return (
		<div
			className={`select-none border border-dashed rounded-xl p-8 text-center transition-all duration-300 cursor-pointer
        ${
					isDragging
						? 'border-blue-500 bg-blue-50'
						: 'border-gray-300 hover:border-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
				}
      `}
			onDragEnter={onDragEnter}
			onDragOver={onDragOver}
			onDragLeave={onDragLeave}
			onDrop={onDrop}
			onClick={triggerFileInput}
		>
			<input
				type="file"
				ref={fileInputRef}
				onChange={onFileInputChange}
				accept="image/*"
				multiple
				className="hidden"
			/>

			<div className="flex flex-col items-center justify-center space-y-4">
				<CloudUpload className="h-16 w-16 text-blue-500" />
				<div>
					<p className="text-md font-medium text-gray-900 dark:text-white">
						拖拽图片到此处或
						<span className="text-blue-500" onClick={onClickSelect}>
							点击选择
						</span>
					</p>
					<p className="text-gray-500 mt-1 text-sm">
						支持 JPEG, PNG, GIF, SVG, WebP 格式，最大5MB
					</p>
				</div>
			</div>
		</div>
	);
};

export default Upload;
