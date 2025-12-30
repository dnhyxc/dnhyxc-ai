import { Button } from '@ui/button';
import { Input } from '@ui/input';
import Upload from '@design/Upload';
import * as qiniu from 'qiniu-js';
import { useMemo, useRef, useState } from 'react';
import { getUploadToken } from '@/service';

interface UploadInfo {
	percent: number;
	loaded: number;
	size: number;
}

interface UploadObserver {
	next: (res: { total: UploadInfo }) => void;
	error: () => void;
	complete: (res: { key: string; hash: string }) => void;
}

interface FileWithPreview {
	file: File;
	preview: string;
	id: string;
}

const Profile = () => {
	const [selectFile, setSelectFile] = useState<File | null>(null);
	const [domainUrls, setDomainUrls] = useState<string[]>([]);
	const [uploadInfos, setUploadInfos] = useState<UploadInfo[]>([]);
	const [fileList, setFileList] = useState<FileWithPreview[]>([]);

	const fileInputRef = useRef<HTMLInputElement>(null);

	console.log('res', import.meta.env.VITE_QINIU_DOMAIN);

	const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		console.log(e.target.files, 'e.target.files');
		if (e.target.files?.[0]) {
			setSelectFile(e.target.files?.[0]);
		}
	};

	const observer = useMemo(() => {
		return {
			next(res: { total: UploadInfo }) {
				console.log(res.total, 'total');
				setUploadInfos((prev) => [res.total, ...prev]);
			},
			error() {
				// ...
			},
			complete(res: { key: string; hash: string }) {
				const url = import.meta.env.VITE_QINIU_DOMAIN + res.key;
				setDomainUrls((prev) => [url, ...prev]);
			},
		};
	}, []);

	const onSelectFile = () => {
		fileInputRef?.current?.click();
	};

	const uploadFile = async (file: File) => {
		const res = await getUploadToken();
		const putExtra = {};
		const config = {};
		const observable = qiniu.upload(
			file,
			file.name,
			res.data, // token
			putExtra,
			config,
		);
		observable.subscribe(observer); // 上传开始
	};

	const onUpload = async () => {
		if (selectFile) {
			uploadFile(selectFile);
		}
	};

	return (
		<div>
			<Upload uploadFile={uploadFile} />
			<Input
				ref={fileInputRef}
				type="file"
				onChange={onChange}
				placeholder="选择文件"
				className="hidden"
			/>
			<Button onClick={onSelectFile}>选择文件</Button>
			<Button onClick={onUpload}>上传</Button>
			{uploadInfos.length > 0
				? uploadInfos.map((i, key) => {
						return (
							<div key={key}>
								{i.size ? (
									<div>文件大小：{Math.round(i.size / 1024)}KB</div>
								) : null}
								{i.percent ? (
									<div>上传进度：{Math.round(i.percent)}%</div>
								) : null}
							</div>
						);
					})
				: null}
			{domainUrls.length > 0
				? domainUrls.map((i, key) => {
						return (
							<div key={key}>
								<img src={i} alt="图片" />
							</div>
						);
					})
				: null}
		</div>
	);
};

export default Profile;
