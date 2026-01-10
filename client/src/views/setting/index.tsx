import { invoke } from '@tauri-apps/api/core';
import { Button } from '@ui/button';
import { Label } from '@ui/label';
import { RadioGroup, RadioGroupItem } from '@ui/radio-group';
import { ScrollArea } from '@ui/scroll-area';
import { useEffect, useState } from 'react';
import { getValue, setValue } from '@/utils';

const Setting = () => {
	const [savePath, setSavePath] = useState('');
	const [startType, setStartType] = useState('1');
	const [closeType, setCloseType] = useState('1');

	useEffect(() => {
		getSavePath();
		getCloseType();
		checkStartType();
	}, []);

	const checkStartType = async () => {
		const type = await invoke('is_auto_start_enabled');
		setStartType(type ? '2' : '1');
	};

	const getSavePath = async () => {
		const path = await getValue('savePath');
		setSavePath(path);
	};

	const getCloseType = async () => {
		const type = await getValue('closeType');
		setCloseType(type);
	};

	const changeDir = async () => {
		const path: string = await invoke('select_directory');
		setValue('savePath', path);
		setSavePath(path);
	};

	const onChangeAutoStart = async (value: string) => {
		if (value === '2' && startType === '1') {
			// 需要开启自启且当前未开启
			await invoke('enable_auto_start');
		} else if (value === '1' && startType === '2') {
			// 需要关闭自启且当前已开启
			await invoke('disable_auto_start');
		}
		setStartType(value);
	};

	const onChangeCloseType = (value: string) => {
		setCloseType(value);
		setValue('closeType', value); // '1': 关闭时退出，'2': 关闭时最小化
	};

	return (
		<div className="w-full h-full flex flex-col justify-center items-center m-0">
			<ScrollArea className="w-full h-full overflow-y-auto p-2.5 rounded-none">
				<div className="w-full h-full flex flex-col px-30 py-8">
					<div className="border-b border-gray-600 pb-5.5 mb-1">
						<div className="text-lg font-bold">文件存储</div>
						<div className="mt-2 px-10">
							<span className="mr-2">默认存储路径</span>
							<span className="ml-2 text-blue-400 text-md">{savePath}</span>
							<Button
								variant="link"
								className="cursor-pointer text-green-500 text-md"
								onClick={changeDir}
							>
								更改目录
							</Button>
						</div>
					</div>
					<div className="my-5 border-b border-gray-600 pb-7">
						<div className="text-lg font-bold">启动设置</div>
						<div className="flex items-center mt-3.5 px-10">
							<span className="mr-2">设置开机自启</span>
							<RadioGroup
								value={startType}
								className="flex items-center ml-2"
								onValueChange={onChangeAutoStart}
							>
								<div className="flex items-center gap-2 mr-5">
									<RadioGroupItem value="1" id="r1" />
									<Label htmlFor="r1" className="text-md cursor-pointer">
										开机不自动启动
									</Label>
								</div>
								<div className="flex items-center gap-2">
									<RadioGroupItem value="2" id="r2" />
									<Label htmlFor="r2" className="text-md cursor-pointer">
										开机自动启动
									</Label>
								</div>
							</RadioGroup>
						</div>
					</div>
					<div className="mt-1.5 border-b border-gray-600 pb-7">
						<div className="text-lg font-bold">关闭设置</div>
						<div className="flex items-center mt-3.5 px-10">
							<span className="mr-2">关闭应用程序</span>
							<RadioGroup
								value={closeType}
								className="flex items-center ml-2"
								onValueChange={onChangeCloseType}
							>
								<div className="flex items-center gap-2 mr-5">
									<RadioGroupItem value="1" id="c1" />
									<Label htmlFor="c1" className="text-md cursor-pointer">
										最小化到托盘，不退出程序
									</Label>
								</div>
								<div className="flex items-center gap-2">
									<RadioGroupItem value="2" id="c2" />
									<Label htmlFor="c2" className="text-md cursor-pointer">
										退出程序
									</Label>
								</div>
							</RadioGroup>
						</div>
					</div>
				</div>
			</ScrollArea>
		</div>
	);
};

export default Setting;
