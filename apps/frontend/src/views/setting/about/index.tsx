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
import { Checkbox } from '@ui/checkbox';
import { Label } from '@ui/label';
import { Progress } from '@ui/progress';
import { Toast } from '@ui/sonner';
import { Spinner } from '@ui/spinner';
import { CircleArrowUp, Download, Info } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import Icon from '@/assets/icon.png';
import { useGetVersion, useI18n, useStorageInfo } from '@/hooks';
import { cn } from '@/lib/utils';
import {
	checkForUpdates,
	checkVersion,
	clearCache,
	formatBytesAsMb,
	formatDate,
	getCacheSize,
	getValue,
	openExternalUrl,
	removeStorage,
	setValue,
	type UpdateType,
} from '@/utils';

const SettingAbout = () => {
	const { t } = useI18n();
	const [updateInfo, setUpdateInfo] = useState<UpdateType | null>(null);
	const [checkLoading, setCheckLoading] = useState(false);
	const [downloading, setDownloading] = useState(false);
	const [downloaded, setDownloaded] = useState(0);
	const [total, setTotal] = useState(0);
	const [open, setOpen] = useState(false);
	const [checked, setChecked] = useState(true);
	const [cacheSize, setCacheSize] = useState('0 B');

	const relaunchRef = useRef<() => Promise<void> | null>(null);

	const { version: currentVersion } = useGetVersion();
	const { storageInfo } = useStorageInfo('autoUpdate');

	useEffect(() => {
		getAutoUpdate();
		insetCacheSize();
	}, []);

	const insetCacheSize = async () => {
		const size = await getCacheSize();
		setCacheSize(size);
	};

	const getAutoUpdate = async () => {
		const autoUpdate = await getValue('autoUpdate');
		if (autoUpdate === undefined) {
			setValue('autoUpdate', true);
		} else {
			setChecked(autoUpdate);
		}
	};

	const onCheckUpdate = async () => {
		try {
			setCheckLoading(true);
			const res = await checkVersion();
			setCheckLoading(false);
			if (!res) {
				Toast({
					title: t('setting.about.toast.latestVersion'),
					type: 'success',
				});
			} else {
				setUpdateInfo(res);
			}
		} catch (_error) {
			setCheckLoading(false);
			Toast({
				title: t('setting.about.toast.fetchVersionFailed'),
				type: 'error',
			});
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
			setDownloading(false);
		} catch (error) {
			Toast({
				title: t('setting.about.toast.relaunchFailed'),
				message: String(error),
				type: 'error',
			});
			onReset();
		}
	};

	const setLoading = (loading: boolean) => {
		setDownloading(loading);
	};

	const onDownloadAndInstall = () => {
		checkForUpdates({
			getTotal,
			getProgress,
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

	const onReset = async () => {
		setOpen(false);
		setDownloaded(0);
		setTotal(0);
		setDownloading(false);
	};

	const onCheckedChange = (event: boolean) => {
		setChecked(event);
		setValue('autoUpdate', event);
	};

	const onClearCache = async () => {
		await clearCache();
		await insetCacheSize();
		Toast({
			type: 'success',
			title: t('setting.about.toast.cacheCleared'),
		});
	};

	return (
		<div className="w-full h-full max-w-3xl mx-auto flex flex-col justify-center items-center m-3.5">
			<div className="w-full">
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
							<div className="flex items-center">
								{storageInfo?.version || updateInfo?.version ? (
									<div className="text-textcolor/60 text-sm mt-1 mr-5">
										{t('setting.about.latestVersion')}
										<span className="ml-2.5">
											{storageInfo?.version || updateInfo?.version}
										</span>
									</div>
								) : null}
								{storageInfo?.date || updateInfo?.date ? (
									<div className="text-textcolor/60 text-sm mt-1">
										{t('setting.about.releaseDate')}
										<span className="ml-2.5">
											{formatDate(storageInfo?.date || updateInfo?.date)}
										</span>
									</div>
								) : null}
							</div>
						</div>
						<div className="flex items-center">
							<Button
								size="sm"
								className={cn(
									'cursor-pointer min-w-30',
									// disabled:opacity-50 易让 svg 与文字分层合成，WebView 下底部偶发灰带
									checkLoading && 'disabled:opacity-100',
								)}
								disabled={checkLoading}
								onClick={onCheckUpdate}
							>
								<span className="inline-flex size-5 shrink-0 items-center justify-center">
									{checkLoading ? (
										<Spinner className="size-4" />
									) : (
										<CircleArrowUp className="size-4" />
									)}
								</span>
								{t('setting.about.checkUpdate')}
							</Button>
							{storageInfo?.version || updateInfo ? (
								<>
									<Button
										size="sm"
										className={cn(
											'cursor-pointer min-w-24 ml-5',
											downloading && 'disabled:opacity-100',
										)}
										disabled={downloading}
										onClick={onDownloadAndInstall}
									>
										<span className="inline-flex size-5 shrink-0 items-center justify-center">
											{downloading ? (
												<Spinner className="size-4" />
											) : (
												<Download className="size-4" />
											)}
										</span>
										{t('setting.about.updateAndRelaunch')}
									</Button>
									<Button
										size="sm"
										variant="outline"
										className="cursor-pointer min-w-24 ml-5"
										onClick={() =>
											void openExternalUrl(
												storageInfo?.notes || updateInfo?.body || '',
											)
										}
									>
										<Info className="mt-0.5 mr-1" />
										{t('setting.about.viewReleaseNotes')}
									</Button>
								</>
							) : null}
						</div>
					</div>
				</div>
			</div>
			{downloaded && total ? (
				<div className="mt-4 w-full">
					<div className="flex items-center justify-between pt-10 pb-2">
						<span>
							{downloaded / total >= 1
								? t('setting.about.download.done')
								: t('setting.about.download.downloading')}
						</span>
						<div>
							<span className="mr-3">
								{formatBytesAsMb(downloaded > total ? total : downloaded)} /{' '}
								{formatBytesAsMb(total)}
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
			<div className="w-full mt-9 border-b pb-5 border-theme/20">
				<div className="font-bold text-md">
					{t('setting.about.update.title')}
				</div>
				<div className="flex items-center gap-3 mt-4.5 px-8.5">
					<Checkbox
						id="terms"
						checked={checked}
						onCheckedChange={onCheckedChange}
						className="cursor-pointer"
					/>
					<Label htmlFor="terms" className="cursor-pointer">
						{t('setting.about.update.notifyMe')}
					</Label>
				</div>
			</div>
			<div className="w-full mt-3.5">
				<div className="font-bold text-md">
					{t('setting.about.cache.title')}
				</div>
				<div className="flex items-center gap-3 mt-1.5 px-8.5 text-sm">
					{t('setting.about.cache.size')}
					<span className="text-sm">{cacheSize}</span>
					<Button
						variant="link"
						className="cursor-pointer p-0 text-theme ml-5"
						onClick={onClearCache}
					>
						{t('setting.about.cache.clear')}
					</Button>
				</div>
			</div>
			<AlertDialog open={open} onOpenChange={onReset}>
				<AlertDialogContent className="w-112.5">
					<AlertDialogHeader>
						<AlertDialogTitle>
							{t('setting.about.relaunchDialog.title')}
						</AlertDialogTitle>
						<AlertDialogDescription>
							{t('setting.about.relaunchDialog.desc')}
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel className="cursor-pointer">
							{t('setting.about.relaunchDialog.later')}
						</AlertDialogCancel>
						<AlertDialogAction className="cursor-pointer" onClick={onRestart}>
							{t('setting.about.relaunchDialog.now')}
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</div>
	);
};

export default SettingAbout;
