import { getVersion } from '@tauri-apps/api/app';
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from '@ui/alert-dialog';
import { Button } from '@ui/button';
import { Progress } from '@ui/progress';
import { Toast } from '@ui/sonner';
import { Spinner } from '@ui/spinner';
import { useEffect, useRef, useState } from 'react';
import Icon from '@/assets/icon.png';
import { checkForUpdates, checkVersion, type UpdateType } from '@/utils';

const SettingAbout = () => {
	const [updateInfo, setUpdateInfo] = useState<Partial<UpdateType> | null>(
		null,
	);
	const [currentVersion, setCurrentVersion] = useState('');
	const [checkLoading, setCheckLoading] = useState(false);
	const [downloading, setDownloading] = useState(false);
	const [isChecked, setIsChecked] = useState(false);
	const [downloaded, setDownloaded] = useState(0);
	const [open, setOpen] = useState(false);

	const totalRef = useRef(0);
	const relaunchRef = useRef<() => Promise<void> | null>(null);

	useEffect(() => {
		getCurrentVersion();
	}, []);

	const getCurrentVersion = async () => {
		const version = await getVersion();
		setCurrentVersion(version);
	};

	const onCheckUpdate = async () => {
		setCheckLoading(true);
		setIsChecked(false);
		const res = await checkVersion();
		setIsChecked(true);
		setCheckLoading(false);
		setUpdateInfo(res);
	};

	const getTotal = (total: number) => {
		totalRef.current = total;
	};

	const getProgress = (chunkLength: number) => {
		setDownloaded((prev) => prev + chunkLength);
	};

	const onRelaunch = async (relaunch: () => Promise<void>) => {
		setOpen(true);
		try {
			relaunchRef.current = relaunch;
		} catch (error) {
			Toast({
				title: '重启失败',
				message: String(error),
				type: 'error',
			});
		}
	};

	const setLoading = (loading: boolean) => {
		setDownloading(loading);
	};

	const onDownloadAndInstall = () => {
		checkForUpdates({
			getProgress,
			getTotal,
			onRelaunch,
			setLoading,
		});
	};

	const onRestart = async () => {
		await relaunchRef.current?.();
		setOpen(false);
		setDownloaded(0);
		totalRef.current = 0;
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
						<div className="flex flex-col">
							<div className="text-xl font-bold">
								Dnhyxc AI {currentVersion}
							</div>
							{updateInfo?.version ? (
								<div className="dark:text-gray-300 text-gray-600 text-sm mt-1">
									当前版本 {updateInfo?.version}
								</div>
							) : null}
						</div>
						<div className="flex items-center">
							<Button
								size="sm"
								className="cursor-pointer w-24"
								disabled={checkLoading}
								onClick={onCheckUpdate}
							>
								{checkLoading ? <Spinner /> : null}
								检查更新
							</Button>
							{updateInfo && isChecked ? (
								<Button
									size="sm"
									className="cursor-pointer w-24 ml-5"
									disabled={downloading}
									onClick={onDownloadAndInstall}
								>
									{downloading ? <Spinner /> : null}
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
						<div>
							<span className="mr-3">
								{downloaded} / {totalRef.current}
							</span>
							<span>
								{Math.floor(downloaded / totalRef.current).toFixed(0)}%
							</span>
						</div>
					</div>
					<Progress
						value={(downloaded / totalRef.current) * 100}
						className="w-full"
					/>
				</div>
			) : null}
			<AlertDialog open={open} onOpenChange={setOpen}>
				<AlertDialogContent className="w-112.5">
					<AlertDialogHeader>
						<AlertDialogTitle>确定要现在重启应用吗?</AlertDialogTitle>
						<AlertDialogDescription>
							即将自动重启完成更新，为确保数据安全，请在重启前保存所有未保存的工作。重启后未保存的数据将无法恢复。建议点击"立即重启"前再次确认重要数据已妥善保存。
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel className="cursor-pointer">
							稍后重启
						</AlertDialogCancel>
						<AlertDialogAction className="cursor-pointer" onClick={onRestart}>
							立即重启
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</div>
	);
};

export default SettingAbout;
