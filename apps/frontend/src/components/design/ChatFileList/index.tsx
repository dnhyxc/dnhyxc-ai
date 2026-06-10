import ImagePreview from '@design/ImagePreview';
import { CircleX, Download, FileText } from 'lucide-react';
import { useEffect, useState } from 'react';
import { CHAT_IMAGE_VALIDTYPES } from '@/constants';
import { cn } from '@/lib/utils';
import { deleteFile } from '@/service';
import { DownloadProgress, UploadedFile } from '@/types';
import {
	createDownloadProgressListener,
	extractCosObjectKey,
	fetchImageAsBlobUrl,
	handlerDownload,
	isCosStoredObjectUrl,
	isCrossOriginUploadUrl,
	isTauriRuntime,
	resolveAttachmentDisplayUrl,
} from '@/utils';

interface IProps {
	data: UploadedFile;
	showDownload?: boolean;
	showDelete?: boolean;
	setUploadedFiles?: React.Dispatch<React.SetStateAction<UploadedFile[]>>;
	className?: string;
}

const ChatFileList: React.FC<IProps> = ({
	data,
	showDownload,
	showDelete,
	setUploadedFiles,
	className,
}) => {
	const [downloadProgressInfo, setDownloadProgressInfo] = useState<
		DownloadProgress[]
	>([]);
	const [loading, setLoading] = useState(false);
	const [visible, setVisible] = useState(false);
	const [base64Url, setBase64Url] = useState('');

	useEffect(() => {
		getUrl();
	}, [data]);

	const getUrl = async () => {
		const fileUrl = resolveAttachmentDisplayUrl(data.path);

		if (!CHAT_IMAGE_VALIDTYPES.includes(data.mimetype)) {
			setBase64Url(fileUrl);
			return;
		}

		const crossOrigin =
			typeof window !== 'undefined' &&
			isCrossOriginUploadUrl(fileUrl) &&
			!isCosStoredObjectUrl(data.path);

		// 跨源（历史本地上传：9002 页面加载 9112 图）：优先 blob，避免 CORP 拦截 <img>
		if (crossOrigin || (isTauriRuntime() && !isCosStoredObjectUrl(data.path))) {
			const blobUrl = await fetchImageAsBlobUrl(fileUrl);
			if (blobUrl.startsWith('blob:')) {
				setBase64Url(blobUrl);
				return;
			}
			if (!crossOrigin) {
				setBase64Url(fileUrl);
			}
			return;
		}

		setBase64Url(fileUrl);
	};

	useEffect(() => {
		const unlistenProgress = createDownloadProgressListener(
			setDownloadProgressInfo,
		);

		return () => {
			unlistenProgress.then((unlisten) => unlisten());
			setDownloadProgressInfo([]);
		};
	}, []);

	const onDownload = async (
		e: React.MouseEvent<SVGSVGElement>,
		file: IProps['data'],
	) => {
		e.stopPropagation();
		setLoading(true);
		await handlerDownload(
			resolveAttachmentDisplayUrl(file.path),
			file.originalname,
		);
		setLoading(false);
		setDownloadProgressInfo([]);
	};

	const onDelete = async () => {
		setUploadedFiles?.((prev) => prev.filter((i) => i.uuid !== data.uuid));
		const cosKey = data.cosKey || extractCosObjectKey(data.path) || undefined;
		if (cosKey || isCosStoredObjectUrl(data.path)) {
			await deleteFile(undefined, cosKey);
			return;
		}
		await deleteFile(data.filename);
	};

	const showPreview = (e: React.MouseEvent<HTMLSpanElement>) => {
		e.stopPropagation();
		if (CHAT_IMAGE_VALIDTYPES.includes(data.mimetype)) {
			setVisible(true);
		}
	};

	return (
		<>
			{CHAT_IMAGE_VALIDTYPES.includes(data.mimetype) && (
				<ImagePreview
					visible={visible}
					selectedImage={{ id: data.uuid, url: base64Url }}
					onVisibleChange={() => setVisible(false)}
				/>
			)}
			<div
				className={cn('flex flex-col items-start', className)}
				onClick={(e) => showPreview(e)}
			>
				<div className="relative group/file-card flex items-center min-w-50 gap-2 px-2.5 pr-2 py-1.5 w-auto bg-linear-to-r from-teal-500 to-cyan-600 rounded-md">
					<FileText className="w-9 h-9" />
					{showDelete ? (
						<CircleX
							className="absolute top-1.5 right-1.5 cursor-pointer hidden group-hover/file-card:block w-5 h-5 text-textcolor"
							onClick={onDelete}
						/>
					) : null}
					<div className="pr-1 w-full">
						<div
							title={data.originalname}
							className="text-ellipsis whitespace-nowrap overflow-hidden max-w-50"
						>
							{data.originalname}
						</div>
						<div className="relative flex items-center justify-between text-sm text-textcolor/70">
							<div className="flex flex-1 items-center mr-5">
								<div className="mr-2">
									{data.originalname.lastIndexOf('.') !== -1
										? data.originalname
												.slice(data.originalname.lastIndexOf('.') + 1)
												.toUpperCase()
										: ''}
								</div>
								{(data.size / 1024 / 1024).toFixed(2)} MB
							</div>
							{showDownload ? (
								<div className="flex items-center hover:text-textcolor">
									{downloadProgressInfo.map((i) =>
										loading ? <span key={i.id}>{i.percent}%</span> : null,
									)}
									{loading ? null : (
										<Download
											size={18}
											className="absolute bottom-0.5 right-0 cursor-pointer hidden group-hover/file-card:flex"
											onClick={(e) => onDownload(e, data)}
										/>
									)}
								</div>
							) : null}
						</div>
					</div>
				</div>
			</div>
		</>
	);
};

export default ChatFileList;
