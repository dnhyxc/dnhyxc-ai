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
import { openUrl } from '@tauri-apps/plugin-opener';
import { Button } from '@ui/button';
import { Checkbox } from '@ui/checkbox';
import { Label } from '@ui/label';
import { Progress } from '@ui/progress';
import { Toast } from '@ui/sonner';
import { Spinner } from '@ui/spinner';
import { CircleArrowUp, Download, Info } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import Icon from '@/assets/icon.png';
import { useGetVersion, useStorageInfo } from '@/hooks';
import {
	checkForUpdates,
	checkVersion,
	getValue,
	removeStorage,
	setValue,
	type UpdateType,
} from '@/utils';

const SettingAbout = () => {
	const [updateInfo, setUpdateInfo] = useState<Partial<UpdateType> | null>(
		null,
	);
	const [checkLoading, setCheckLoading] = useState(false);
	const [downloading, setDownloading] = useState(false);
	const [downloaded, setDownloaded] = useState(0);
	const [total, setTotal] = useState(0);
	const [open, setOpen] = useState(false);
	const [checked, setChecked] = useState(true);

	const relaunchRef = useRef<() => Promise<void> | null>(null);

	const { version: currentVersion } = useGetVersion();
	const { storageInfo } = useStorageInfo('autoUpdate');

	const getAutoUpdate = async () => {
		const autoUpdate = await getValue('autoUpdate');
		if (autoUpdate === undefined) {
			setValue('autoUpdate', true);
		} else {
			setChecked(autoUpdate);
		}
	};

	useEffect(() => {
		getAutoUpdate();
	}, []);

	const onCheckUpdate = async () => {
		setCheckLoading(true);
		const res = await checkVersion();
		setCheckLoading(false);
		if (!res) {
			Toast({
				title: '已经是最新版本',
				type: 'success',
			});
		} else {
			setUpdateInfo(res);
		}
	};

	const getTotal = (total: number) => {
		setTotal(total);
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
			onReset,
		});
	};

	const onRestart = async () => {
		removeStorage('autoUpdate');
		await relaunchRef.current?.();
		onReset();
	};

	const onReset = () => {
		setOpen(false);
		setDownloaded(0);
		setTotal(0);
		setDownloading(false);
	};

	const onCheckedChange = (event: boolean) => {
		setChecked(event);
		setValue('autoUpdate', event);
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
							{storageInfo?.version || updateInfo?.version ? (
								<div className="dark:text-gray-300 text-gray-600 text-sm mt-1">
									最新版本 {storageInfo?.version || updateInfo?.version}
								</div>
							) : null}
						</div>
						<div className="flex items-center">
							<Button
								size="sm"
								className="cursor-pointer min-w-30"
								disabled={checkLoading}
								onClick={onCheckUpdate}
							>
								{checkLoading ? (
									<Spinner />
								) : (
									<CircleArrowUp className="mt-0.5 mr-1" />
								)}
								检查更新
							</Button>
							{storageInfo?.version || updateInfo ? (
								<>
									<Button
										size="sm"
										className="cursor-pointer min-w-24 ml-5"
										disabled={downloading}
										onClick={onDownloadAndInstall}
									>
										{downloading ? (
											<Spinner />
										) : (
											<Download className="mt-0.5 mr-1" />
										)}
										更新并重启
									</Button>
									<Button
										size="sm"
										className="cursor-pointer min-w-24 ml-5"
										onClick={() =>
											openUrl(storageInfo?.notes || updateInfo?.body)
										}
									>
										<Info className="mt-0.5 mr-1" />
										查看更新内容
									</Button>
								</>
							) : null}
						</div>
					</div>
				</div>
			</div>
			{downloaded && total ? (
				<div className="mt-4 min-w-[610px]">
					<div className="flex items-center justify-between pt-10 pb-2">
						<span>{downloaded / total >= 1 ? '下载完成' : '正在下载'}</span>
						<div>
							<span className="mr-3">
								{downloaded} / {total}
							</span>
							<span>
								{Math.floor(
									(downloaded / total > 1 ? 1 : downloaded / total) * 100,
								).toFixed(0)}
								%
							</span>
						</div>
					</div>
					<Progress
						value={(downloaded / total > 1 ? 1 : downloaded / total) * 100}
						className="w-full"
					/>
				</div>
			) : null}
			<div className="min-w-[610px] mt-12">
				<div className="font-bold text-md">软件更新</div>
				<div className="flex items-center gap-3 mt-3">
					<Checkbox
						id="terms"
						checked={checked}
						onCheckedChange={onCheckedChange}
						className="cursor-pointer"
					/>
					<Label htmlFor="terms" className="cursor-pointer">
						新版本发布时提醒我
					</Label>
				</div>
			</div>
			<AlertDialog open={open} onOpenChange={onReset}>
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
