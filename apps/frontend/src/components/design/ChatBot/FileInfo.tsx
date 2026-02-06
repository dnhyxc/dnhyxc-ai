import { FileText } from 'lucide-react';

interface IProps {
	data: {
		originalname: string;
		size: number;
	};
	showInfo?: boolean;
}

const FileInfo: React.FC<IProps> = ({ data, showInfo }) => {
	return (
		<div className="flex flex-col items-start pl-3">
			{showInfo ? (
				<div className="my-2 text-sm text-textcolor/70">只识别附件中的文字</div>
			) : null}
			<div className="flex items-center min-w-50 gap-2 px-2 py-1 w-auto border border-theme-white/10 rounded-md">
				<FileText className="w-8 h-8" />
				<div className="pr-1">
					<div
						title={data.originalname}
						className="text-ellipsis whitespace-nowrap overflow-hidden max-w-50"
					>
						{data.originalname}
					</div>
					<div className="flex items-center text-sm text-textcolor/50">
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
	);
};

export default FileInfo;
