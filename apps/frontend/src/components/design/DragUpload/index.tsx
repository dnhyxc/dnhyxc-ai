import { Toast } from '@ui/sonner';
import { CloudUpload } from 'lucide-react';
import { useCallback, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { MAX_SIZE, VALID_TYPES } from './config';

interface FileWithPreview {
	file: File;
	preview: string;
	id: string;
}

interface IProps {
	uploadFile?: (file: File) => void;
	getFileList?: (files: FileWithPreview[]) => void;
	className?: string;
	validTypes?: string[];
	maxSize?: number;
	infoText?: string;
	multiple?: boolean;
}

const DragUpload: React.FC<IProps> = ({
	uploadFile,
	getFileList,
	className,
	validTypes,
	maxSize,
	infoText,
	multiple = false,
}) => {
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
			if (!(validTypes || VALID_TYPES).includes(file.type)) {
				Toast({
					type: 'error',
					title: `不支持的文件类型: ${file.type}`,
				});
				return false;
			}

			if (file.size > (maxSize ? maxSize * 1024 * 1024 : MAX_SIZE)) {
				Toast({
					type: 'error',
					title: `文件大小不能超过 ${maxSize || MAX_SIZE / 1024 / 1024} MB`,
				});
				return false;
			}

			return true;
		});

		const filesWithPreview = newFiles.map((file) => ({
			file,
			preview: URL.createObjectURL(file),
			id: Math.random().toString(36).substring(2, 9),
		}));

		if (multiple) {
			// 创建预览URL
			const fileList = [...filesWithPreview, ...files];
			setFiles((prev) => [...filesWithPreview, ...prev]);
			getFileList?.(fileList);
			onUpload(filesWithPreview);
		} else {
			setFiles(filesWithPreview);
			getFileList?.(filesWithPreview);
			onUpload(filesWithPreview);
		}
	};

	const onUpload = async (fileList: FileWithPreview[]) => {
		if (fileList.length) {
			fileList.forEach(async (data) => {
				await uploadFile?.(data.file);
			});
		}
	};

	return (
		<div
			className={cn(
				`select-none border border-dashed p-5 text-center transition-all duration-300 cursor-pointer
        ${
					isDragging
						? 'border-theme bg-theme/20'
						: 'border-textcolor/20 hover:border-theme/20 hover:bg-theme-background/30'
				}
      `,
				className,
			)}
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
				multiple={multiple}
				className="hidden"
			/>

			{!files?.length ? (
				<div className="flex flex-col items-center justify-center space-y-4 h-full">
					<CloudUpload className="h-12 w-12 text-theme" />
					<div>
						<p className="text-md font-medium">
							拖拽图片到此处或
							<span className="text-theme" onClick={onClickSelect}>
								点击选择
							</span>
						</p>
						<p className="text-textcolor/60 mt-1 text-sm">
							{infoText || '支持 JPEG, PNG, GIF, SVG, WebP 格式，最大5MB'}
						</p>
					</div>
				</div>
			) : (
				<div className="flex flex-col items-center justify-center space-y-4 h-full">
					{files.map((i) => {
						return (
							<div key={i.id}>
								<div>{i.file?.name}</div>
								<div>{i.file?.size}</div>
							</div>
						);
					})}
				</div>
			)}
		</div>
	);
};

export default DragUpload;
