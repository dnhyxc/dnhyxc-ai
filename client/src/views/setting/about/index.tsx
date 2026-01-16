import { Button } from '@ui/button';
import { Progress } from '@ui/progress';
import { useRef, useState } from 'react';
import Icon from '@/assets/icon.png';
import { checkForUpdates, checkVersion } from '@/utils';

const SettingAbout = () => {
	const [needUpdate, setNeedUpdate] = useState(false);
	const [isChecked, setIsChecked] = useState(false);
	const [downloaded, setDownloaded] = useState(0);

	const totalRef = useRef(0);

	const onCheckUpdate = async () => {
		setIsChecked(false);
		const res = await checkVersion();
		setIsChecked(true);
		setNeedUpdate(res);
	};

	const getTotal = (total: number) => {
		totalRef.current = total;
	};

	const getProgress = (chunkLength: number) => {
		setDownloaded((prev) => prev + chunkLength);
	};

	const onDownloadAndInstall = () => {
		checkForUpdates({ getProgress, getTotal });
	};

	return (
		<div className="w-full h-full flex flex-col justify-center items-center m-0">
			<div className="min-w-[610px]">
				<div className="flex items-center w-full h-28">
					<img
						src={Icon}
						alt="logo"
						className="w-28 h-full bg-background rounded-md"
					/>
					<div className="flex-1 h-full flex flex-col justify-between ml-5 py-1">
						<span className="text-xl font-bold">Dnhyxc AI</span>
						<div className="flex items-center">
							<Button className="cursor-pointer w-24" onClick={onCheckUpdate}>
								检查更新
							</Button>
							{needUpdate && isChecked ? (
								<Button
									className="cursor-pointer w-24 ml-5"
									onClick={onDownloadAndInstall}
								>
									更新并重启
								</Button>
							) : isChecked ? (
								<span className="ml-5">已是最新版本</span>
							) : null}
						</div>
					</div>
				</div>
			</div>
			{downloaded && totalRef.current ? (
				<div className="mt-4 min-w-[610px]">
					<div className="flex items-center justify-between pt-10 pb-2">
						<span>正在下载</span>
						<span>{(downloaded / totalRef.current || 0).toFixed(2)}%</span>
					</div>
					<Progress value={downloaded / totalRef.current} className="w-full" />
				</div>
			) : null}
		</div>
	);
};

export default SettingAbout;
