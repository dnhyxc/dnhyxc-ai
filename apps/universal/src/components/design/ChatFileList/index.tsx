import ImagePreview from '@design/ImagePreview';
import { CircleX, FileText } from 'lucide-react';
import { useState } from 'react';
import { CHAT_IMAGE_VALIDTYPES } from '@/constant';
import { cn } from '@/lib/utils';
import { UploadedFile } from '@/types';

interface IProps {
	data: UploadedFile;
	showDownload?: boolean;
	showDelete?: boolean;
	setUploadedFiles?: React.Dispatch<React.SetStateAction<UploadedFile[]>>;
	className?: string;
}

const ChatFileList: React.FC<IProps> = ({
	data,
	showDelete,
	setUploadedFiles,
	className,
}) => {
	const [visible, setVisible] = useState(false);

	const onDelete = async () => {
		setUploadedFiles?.((prev) => prev.filter((i) => i.uuid !== data.uuid));
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
					selectedImage={{ id: data.uuid, url: data.path }}
					onVisibleChange={() => setVisible(false)}
				/>
			)}
			<div
				className={cn('flex flex-col items-start', className)}
				onClick={(e) => showPreview(e)}
			>
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
						</div>
					</div>
				</div>
			</div>
		</>
	);
};

export default ChatFileList;
