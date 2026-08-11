import { Button, Input, Spinner } from '@ui/index';
import { Toast } from '@ui/sonner';
import { Download, Eye, Trash2, Upload as UploadIcon } from 'lucide-react';
import {
	type ComponentProps,
	useCallback,
	useEffect,
	useRef,
	useState,
} from 'react';
import { cn } from '@/lib/utils';
import { FileWithPreview } from '@/types';
import { donwnloadWithUrl } from '@/utils';
import Image from '../Image';
import Tooltip from '../Tooltip';

type ButtonVariant = ComponentProps<typeof Button>['variant'];
type ButtonSize = ComponentProps<typeof Button>['size'];

export type UploadProps = {
	validTypes?: string[];
	/** 扩展名兜底（如 `.svg`）；MIME 为空时仍可通过校验 */
	validExtensions?: string[];
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
	/** image：方块预览区；button：触发按钮（聊天附件等） */
	uploadType?: 'image' | 'button';
	showTooltip?: boolean;
	tooltipContent?: React.ReactNode | string;
	/** i18n 翻译函数（可选）；不传则沿用组件内默认中文文案 */
	t?: (key: string, params?: Record<string, unknown>) => string;
	disabled?: boolean;
	loading?: boolean;
	/** uploadType=button 时透传 Button */
	buttonVariant?: ButtonVariant;
	buttonSize?: ButtonSize;
	buttonClassName?: string;
	/** 外部打开文件选择（挂在会卸载的菜单内时，把 Upload 放菜单外并用此 ref 触发） */
	openRef?: React.MutableRefObject<(() => void) | null>;
};

function fileMatchesType(
	file: File,
	validTypes: string[],
	validExtensions: string[],
): boolean {
	if (file.type && validTypes.includes(file.type)) return true;
	if (validTypes.some((t) => t.endsWith('/*'))) {
		const prefix = validTypes.find((t) => t.endsWith('/*'))?.slice(0, -1);
		if (prefix && file.type.startsWith(prefix)) return true;
	}
	const name = file.name.toLowerCase();
	if (validExtensions.some((ext) => name.endsWith(ext.toLowerCase()))) {
		return true;
	}
	// image/svg+xml 常伴随空 MIME，默认按 .svg 放行
	if (validTypes.includes('image/svg+xml') && name.endsWith('.svg')) {
		return true;
	}
	return false;
}

const Upload: React.FC<UploadProps> = ({
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
	validExtensions = [],
	multiple = false,
	accept = 'image/*',
	maxSize = 10 * 1024 * 1024,
	maxCount = 5,
	countValidText = '',
	uploadedCount = 0,
	showTooltip = false,
	tooltipContent,
	t,
	disabled = false,
	loading,
	buttonVariant = 'ghost',
	buttonSize,
	buttonClassName,
	openRef,
}) => {
	const [files, setFiles] = useState<FileWithPreview[]>([]);

	const fileInputRef = useRef<HTMLInputElement>(null);
	const imageRef = useRef<{ reset: () => void; onPreview: () => void }>(null);

	useEffect(() => {
		return () => {
			files.forEach((file) => {
				if (file.preview) {
					URL.revokeObjectURL(file.preview);
				}
			});
		};
	}, [files]);

	const revokeObjectURL = (preview: string) => {
		if (preview?.startsWith('blob:')) {
			URL.revokeObjectURL(preview);
		}
	};

	const revokeAllObjectURLs = (fileList: FileWithPreview[]) => {
		fileList.forEach((file) => {
			if (file.preview) {
				URL.revokeObjectURL(file.preview);
			}
		});
	};

	const triggerFileInput = () => {
		if (disabled || loading) return;
		fileInputRef.current?.click();
	};

	useEffect(() => {
		if (!openRef) return;
		openRef.current = triggerFileInput;
		return () => {
			openRef.current = null;
		};
	}, [openRef, disabled, loading]);

	const validateFiles = useCallback(
		(
			selectedFiles: File[] | FileList,
			currentFilesLength: number,
		): { valid: boolean; files: File[] } => {
			if (
				(multiple && selectedFiles.length + currentFilesLength > maxCount) ||
				uploadedCount + selectedFiles.length > maxCount
			) {
				Toast({
					type: 'error',
					title:
						countValidText ||
						t?.('upload.error.maxCount', { maxCount }) ||
						`最多只能同时上传 ${maxCount} 个文件`,
				});
				return { valid: false, files: [] };
			}

			const validFiles = Array.from(selectedFiles).filter((file) => {
				if (!fileMatchesType(file, validTypes, validExtensions)) {
					Toast({
						type: 'error',
						title:
							t?.('upload.error.invalidType', {
								type: file.type || file.name,
							}) || `不支持的文件类型: ${file.type || file.name}`,
					});
					return false;
				}

				if (file.size > maxSize) {
					Toast({
						type: 'error',
						title:
							t?.('upload.error.maxSize', {
								maxSizeMb: maxSize / 1024 / 1024,
							}) || `文件大小不能超过 ${maxSize / 1024 / 1024} MB`,
					});
					return false;
				}

				return true;
			});

			return { valid: true, files: validFiles };
		},
		[
			multiple,
			maxCount,
			uploadedCount,
			countValidText,
			validTypes,
			validExtensions,
			maxSize,
			t,
		],
	);

	const createPreviewURLs = useCallback(
		(fileList: File[]): FileWithPreview[] => {
			return fileList.map((file) => {
				if (file.type.startsWith('image/') || /\.svg$/i.test(file.name)) {
					const preview = URL.createObjectURL(file);
					return {
						file,
						preview,
						id: Math.random().toString(36).substring(2, 9),
					};
				}
				return {
					file,
					id: Math.random().toString(36).substring(2, 9),
				};
			});
		},
		[],
	);

	const onFileSelect = async (selectedFiles: File[] | FileList) => {
		const validation = validateFiles(selectedFiles, files.length);
		if (!validation.valid || validation.files.length === 0) {
			return;
		}

		const filesWithPreview = createPreviewURLs(validation.files);

		try {
			if (multiple) {
				const fileList = [...filesWithPreview, ...files];
				setFiles((prev) => [...filesWithPreview, ...prev]);
				getFileList?.(fileList);
				await onUpload(fileList);
			} else {
				setFiles(filesWithPreview);
				getFileList?.(filesWithPreview?.[0]);
				await onUpload(filesWithPreview?.[0]);
			}
		} finally {
			revokeAllObjectURLs(filesWithPreview);
			setFiles([]);
		}
	};

	const onFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const list = e.target.files;
		if (list && list.length > 0) {
			void onFileSelect(list);
			e.target.value = '';
		}
	};

	const onDelete = (file: FileWithPreview) => {
		if (file?.preview) {
			revokeObjectURL(file.preview);
		}
		setFiles((prev) => prev.filter((item) => item.id !== file.id));
		onClearFileUrl?.();
	};

	const onPreview = () => {
		imageRef.current?.onPreview();
	};

	const onDownload = async () => {
		if (fileUrl) {
			const res = await donwnloadWithUrl({ url: fileUrl });
			Toast({
				type: res.success,
				title: res.message,
			});
		}
	};

	return (
		<div className={cn(uploadType === 'image' && 'h-32.5 w-32.5', className)}>
			<Input
				type="file"
				ref={fileInputRef}
				onChange={onFileInputChange}
				accept={accept}
				multiple={multiple}
				disabled={disabled || loading}
				className="hidden"
			/>
			{uploadType === 'image' &&
				(files?.length || fileUrl ? (
					<div className="relative z-1 group flex h-full w-full items-center justify-center">
						<Image
							ref={imageRef}
							src={fileUrl || files[0]?.preview || ''}
							showOnError
							t={t}
							className="relative h-full w-full rounded-md"
						>
							<div className="bg-theme-background/50 absolute inset-0 z-1 hidden w-full h-full items-center justify-center rounded-md group-hover:flex">
								<Download
									className="hover:text-textcolor/80 h-5 w-5 cursor-pointer"
									onClick={onDownload}
								/>
								<Eye
									className="hover:text-textcolor/80 ml-2 h-5 w-5 cursor-pointer"
									onClick={onPreview}
								/>
								<Trash2
									className="hover:text-textcolor/80 ml-2 h-5 w-5 cursor-pointer"
									onClick={() => onDelete(files[0])}
								/>
								{children}
							</div>
						</Image>
					</div>
				) : (
					<div
						className={cn(
							'border-theme/20 hover:border-theme/80 hover:bg-theme-background/90 flex h-full w-full cursor-pointer items-center justify-center rounded-md border border-dashed p-8 text-center transition-all duration-300 select-none',
							(disabled || loading) && 'pointer-events-none opacity-50',
						)}
						onClick={triggerFileInput}
					>
						<UploadIcon className="text-textcolor mx-auto h-8 w-8" />
					</div>
				))}
			{uploadType === 'button' && (
				<Tooltip
					side="right"
					content={
						tooltipContent ??
						t?.('upload.tooltip.default') ??
						'仅支持PDF、Word、Excel文件'
					}
					disabled={!showTooltip}
				>
					<Button
						type="button"
						variant={buttonVariant}
						size={buttonSize}
						className={cn(
							'bg-theme/5 mb-1 flex h-8 items-center rounded-md text-sm',
							buttonClassName,
						)}
						disabled={disabled || loading}
						onClick={triggerFileInput}
					>
						{loading ? (
							<div className="flex items-center gap-2">
								<Spinner className="text-textcolor" />
								{t?.('upload.uploading') ?? '上传中...'}
							</div>
						) : (
							children || (
								<div className="flex items-center">
									<UploadIcon className="text-textcolor mx-auto mr-2 h-8 w-8" />
									{t?.('upload.button') ?? '上传文件'}
								</div>
							)
						)}
					</Button>
				</Tooltip>
			)}
		</div>
	);
};

export default Upload;
