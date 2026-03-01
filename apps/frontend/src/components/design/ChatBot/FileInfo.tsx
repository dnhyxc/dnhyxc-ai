import { CircleX, Download, FileText } from 'lucide-react';
import { createDownloadProgressListener, donwnloadWithUrl } from '@/utils';
import { DownloadProgress, UploadedFile } from '@/types';
import { Toast } from '@ui/index';
import { useEffect, useState } from 'react';
import { deleteFile } from '@/service';

interface IProps {
	data: UploadedFile;
	showDownload?: boolean;
	showDelete?: boolean;
	setUploadedFiles?: React.Dispatch<React.SetStateAction<UploadedFile[]>>;
}

const FileInfo: React.FC<IProps> = ({
	data,
	showDownload,
	showDelete,
	setUploadedFiles,
}) => {
	const [downloadProgressInfo, setDownloadProgressInfo] = useState<
		DownloadProgress[]
	>([]);
	const [loading, setLoading] = useState(false);

	useEffect(() => {
		const unlistenProgress = createDownloadProgressListener(
			setDownloadProgressInfo,
		);

		return () => {
			unlistenProgress.then((unlisten) => unlisten());
			setDownloadProgressInfo([]);
		};
	}, []);

	const onDownload = async (file: IProps['data']) => {
		setLoading(true);
		const res = await donwnloadWithUrl({
			url: file.path,
		});
		setLoading(false);
		setDownloadProgressInfo([]);
		Toast({
			type:
				res.success === 'success'
					? 'success'
					: res.success === 'error'
						? 'error'
						: 'info',
			title: res.message,
		});
	};

	const onDelete = async () => {
		setUploadedFiles?.((prev) => prev.filter((i) => i.uuid !== data.uuid));
		await deleteFile(data.filename);
	};

	return (
		<div className="flex flex-col items-start">
			<div className="relative group/file-card flex items-center min-w-50 gap-2 px-2.5 pr-2 py-1.5 w-auto bg-linear-to-r from-blue-500 to-cyan-500 rounded-md">
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
										onClick={() => onDownload(data)}
									/>
								)}
							</div>
						) : null}
					</div>
				</div>
			</div>
		</div>
	);
};

export default FileInfo;
