import { Button } from '@ui/button';
import { Input } from '@ui/input';
import * as qiniu from 'qiniu-js';
import { useState } from 'react';
import { getUploadToken } from '@/service';

interface UploadInfo {
	percent: number;
	loaded: number;
	size: number;
}

const Profile = () => {
	const [selectFile, setSelectFile] = useState<File | null>(null);
	const [fileUrl, setFileUrl] = useState<string>('');
	const [uploadInfo, setUploadInfo] = useState<UploadInfo>({
		percent: 0,
		loaded: 0,
		size: 0,
	});

	console.log('res', import.meta.env.VITE_QINIU_DOMAIN);

	const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		console.log(e.target.files, 'e.target.files');
		if (e.target.files?.[0]) {
			setSelectFile(e.target.files?.[0]);
		}
	};

	const observer = {
		next(res: { total: UploadInfo }) {
			console.log(res.total, 'total');
			setUploadInfo(res.total);
		},
		error() {
			// ...
		},
		complete(res: { key: string; hash: string }) {
			const url = import.meta.env.VITE_QINIU_DOMAIN + res.key;
			setFileUrl(url);
		},
	};

	const onUpload = async () => {
		console.log('res', import.meta.env);

		if (selectFile) {
			const res = await getUploadToken();
			const putExtra = {};
			const config = {};
			const observable = qiniu.upload(
				selectFile,
				selectFile.name,
				res.data, // token
				putExtra,
				config,
			);
			observable.subscribe(observer); // 上传开始
			// const subscription = observable.subscribe(observer); // 上传开始
			// subscription.unsubscribe(); // 上传取消
		}
	};

	return (
		<div>
			<Input type="file" onChange={onChange} />
			<Button onClick={onUpload}>上传</Button>
			{uploadInfo.size ? (
				<div>文件大小：{Math.round(uploadInfo.size / 1024)}KB</div>
			) : null}
			{uploadInfo.percent ? (
				<div>上传进度：{Math.round(uploadInfo.percent)}%</div>
			) : null}
			{fileUrl ? <img src={fileUrl} alt="" /> : null}
		</div>
	);
};

export default Profile;
