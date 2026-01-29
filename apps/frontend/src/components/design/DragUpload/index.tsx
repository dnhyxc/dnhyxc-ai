import { Toast } from '@ui/sonner';
import { CloudUpload, X } from 'lucide-react';
import React, {
	forwardRef,
	ReactNode,
	useCallback,
	useImperativeHandle,
	useRef,
	useState,
} from 'react';
import { cn } from '@/lib/utils';
import ImagePreview from '../ImagePreview';
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
	children?: ReactNode;
}

interface ForwardProps {
	onClear: () => void;
}

const DragUpload = forwardRef<ForwardProps, IProps>(
	(
		{
			uploadFile,
			getFileList,
			className,
			validTypes,
			maxSize,
			infoText,
			multiple = false,
			children,
		},
		ref,
	) => {
		const [files, setFiles] = useState<FileWithPreview[]>([]);
		const [isDragging, setIsDragging] = useState(false);
		const [visible, setVisible] = useState(false);

		const fileInputRef = useRef<HTMLInputElement>(null);

		useImperativeHandle(ref, () => ({
			onClear,
		}));

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

		const onPreview = (e: React.MouseEvent<HTMLImageElement>) => {
			e.stopPropagation();
			setVisible(true);
		};

		const onClear = () => {
			setFiles([]);
		};

		return (
			<>
				<div
					className={cn(
						`select-none border ${files.length ? '' : 'border-dashed'} text-center transition-all duration-300 cursor-pointer
        ${
					isDragging
						? files.length
							? 'border-theme/50'
							: 'border-theme/50 bg-theme/20 border-dashed'
						: files.length
							? 'border-theme-white/10'
							: 'border-theme-white/10 hover:border-theme-white/20 hover:bg-theme-background/30'
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
						disabled={!!files.length}
						className="hidden"
					/>

					{!files?.length ? (
						<div className="p-2.5 flex flex-col items-center justify-center space-y-4 h-full">
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
						children || (
							<div className="p-3.5 flex flex-col items-center justify-center space-y-4 h-full">
								{files?.map((i) => {
									return (
										<div
											key={i.id}
											className="flex items-center w-full h-full group"
										>
											<img
												src={i.preview}
												alt={i.file.name}
												className="w-auto h-full rounded-md"
												onClick={onPreview}
											/>
											<div className="ml-4 flex-1 h-full flex flex-col items-start justify-between">
												<div className="line-clamp-2 text-textcolor break-all">
													{i.file.name}
												</div>
												<div className="flex w-full items-center justify-between">
													<span>
														{(i.file.size / 1024 / 1024).toFixed(2)} M
													</span>
													<X
														className="text-red-400 hidden group-hover:inline-block"
														onClick={onClear}
													/>
												</div>
											</div>
										</div>
									);
								})}
							</div>
						)
					)}
				</div>
				<ImagePreview
					visible={visible}
					selectedImage={{
						url: files?.[0]?.preview,
						size: files?.[0]?.file.size,
						id: '1',
					}}
					onVisibleChange={() => setVisible(false)}
				/>
			</>
		);
	},
);

export default DragUpload;
