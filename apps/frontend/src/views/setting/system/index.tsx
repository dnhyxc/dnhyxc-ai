import { Button } from '@ui/button';
import { Label } from '@ui/label';
import { RadioGroup, RadioGroupItem } from '@ui/radio-group';
import { toast } from '@ui/sonner';
import { useCallback, useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { capitalizeWords, getValue, setValue } from '@/utils';
import { isTauriRuntime } from '@/utils/runtime';
import { DEFAULT_INFO } from './config';

/** 仅在桌面壳内调用 Rust 命令 */
async function desktopInvoke<T>(
	cmd: string,
	args?: Record<string, unknown>,
): Promise<T> {
	const { invoke } = await import('@tauri-apps/api/core');
	return invoke(cmd, args) as Promise<T>;
}

const System = () => {
	const [savePath, setSavePath] = useState('');
	const [startType, setStartType] = useState('1');
	const [closeType, setCloseType] = useState('1');
	const [checkShortcut, setCheckShortcut] = useState<number | null>(null);
	const [shortcutInfo, setShortcutInfo] = useState(DEFAULT_INFO);

	const getShortCutInfo = () => {
		DEFAULT_INFO.map(async (i) => {
			i.defaultShortcut =
				(await getValue(`shortcut_${i.key}`)) || i.defaultShortcut;
		});
		setShortcutInfo(DEFAULT_INFO);
	};

	useEffect(() => {
		getSavePath();
		getCloseType();
		checkStartType();
		getShortCutInfo();
	}, []);

	useEffect(() => {
		window.addEventListener('keydown', onKeydown, true);
		window.addEventListener('keyup', onKeyup, true);
		window.addEventListener('click', onClickPage);

		return () => {
			window.removeEventListener('keydown', onKeydown, true);
			window.removeEventListener('keyup', onKeyup, true);
			window.removeEventListener('click', onClickPage);
		};
	}, [checkShortcut, shortcutInfo]);

	const onClickPage = (e: { target: EventTarget | null }) => {
		const target = e.target as HTMLElement | null;
		if (target?.id !== 'shortcut') {
			setCheckShortcut(null);
			if (isTauriRuntime()) {
				void desktopInvoke('reload_all_shortcuts');
			}
		}
	};

	const onKeydown = useCallback(
		(e: KeyboardEvent) => {
			const info = shortcutInfo.find((item) => item.key === checkShortcut);
			if (!info?.key) return;
			let shortcuts = info.shortcut;

			const modifiers: string[] = [];
			if (e.metaKey) modifiers.push('Meta');
			if (e.ctrlKey) modifiers.push('Control');
			if (e.altKey) modifiers.push('Alt');
			if (e.shiftKey) modifiers.push('Shift');

			const key = e.key;
			if (!['Control', 'Alt', 'Shift', 'Meta'].includes(key)) {
				modifiers.push(capitalizeWords(key));
			}

			shortcuts = modifiers.join(' + ');

			setShortcutInfo((prev) =>
				prev.map((item) =>
					item.key === checkShortcut ? { ...item, shortcut: shortcuts } : item,
				),
			);
		},
		[shortcutInfo, checkShortcut],
	);

	const onKeyup = useCallback(
		(_e: KeyboardEvent) => {
			const info = shortcutInfo.find((item) => item.key === checkShortcut);
			if (!info?.key || !info.shortcut) return;

			const shortcuts = info.shortcut;

			if (!isTauriRuntime()) {
				toast.info('全局快捷键仅在桌面客户端可用');
				return;
			}

			desktopInvoke('register_shortcut', {
				shortcutStr: shortcuts,
				currentKey: checkShortcut,
			})
				.then(() => {
					setShortcutInfo((prev) =>
						prev.map((item) => {
							if (item.key === checkShortcut) {
								setValue(`shortcut_${item.key}`, shortcuts);
								// invoke('reload_all_shortcuts');
								return {
									...item,
									shortcut: shortcuts,
									defaultShortcut: shortcuts,
								};
							} else {
								return item;
							}
						}),
					);
				})
				.catch((error: string) => {
					toast.error(error);
					console.error(error, 'error');
					setShortcutInfo((prev) =>
						prev.map((item) =>
							item.key === checkShortcut ? { ...item, shortcut: '' } : item,
						),
					);
				});
		},
		[shortcutInfo, checkShortcut],
	);

	const checkStartType = async () => {
		if (!isTauriRuntime()) {
			setStartType('1');
			return;
		}
		const type = await desktopInvoke<boolean>('is_auto_start_enabled');
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
		if (!isTauriRuntime()) {
			toast.info('选择存储目录仅在桌面客户端可用');
			return;
		}
		const path: string = await desktopInvoke<string>('select_directory');
		setValue('savePath', path);
		setSavePath(path);
	};

	const onChangeAutoStart = async (value: string) => {
		if (!isTauriRuntime()) {
			toast.info('开机自启仅在桌面客户端可用');
			return;
		}
		if (value === '2' && startType === '1') {
			await desktopInvoke('enable_auto_start');
		} else if (value === '1' && startType === '2') {
			await desktopInvoke('disable_auto_start');
		}
		setStartType(value);
	};

	const onChangeCloseType = (value: string) => {
		setCloseType(value);
		setValue('closeType', value); // '1': 关闭时退出，'2': 关闭时最小化
	};

	const onChangeShortCut = async (value: number) => {
		setShortcutInfo((prev) =>
			prev.map((item) =>
				item.key === value
					? {
							...item,
							shortcut: '',
						}
					: item,
			),
		);
		setCheckShortcut(value);
		if (isTauriRuntime()) {
			await desktopInvoke('clear_all_shortcuts');
		}
	};

	return (
		<div className="w-full h-full flex flex-col justify-center items-center m-2">
			<div className="border-b border-theme/20 pb-2 min-w-[610px]">
				<div className="text-md font-bold">文件存储</div>
				<div className="mt-2 px-8.5 text-sm">
					<span className="mr-2">默认存储路径</span>
					<span className="ml-2 text-theme/90 text-md">{savePath}</span>
					<Button
						variant="link"
						className="cursor-pointer text-theme text-md"
						onClick={changeDir}
					>
						更改目录
					</Button>
				</div>
			</div>
			<div className="my-3.5 border-b border-theme/20 pb-4.5 min-w-[610px]">
				<div className="text-md font-bold">启动设置</div>
				<div className="flex items-center mt-3.5 px-8.5 text-sm">
					<span className="mr-2">设置开机自启</span>
					<RadioGroup
						value={startType}
						className="flex items-center ml-2"
						onValueChange={onChangeAutoStart}
					>
						<div className="flex items-center gap-2 mr-5">
							<RadioGroupItem value="1" id="r1" />
							<Label htmlFor="r1" className="cursor-pointer">
								开机不自动启动
							</Label>
						</div>
						<div className="flex items-center gap-2">
							<RadioGroupItem value="2" id="r2" />
							<Label htmlFor="r2" className="text-sm cursor-pointer">
								开机自动启动
							</Label>
						</div>
					</RadioGroup>
				</div>
			</div>
			<div className="border-b border-theme/20 pb-4.5 min-w-[610px]">
				<div className="text-md font-bold">关闭设置</div>
				<div className="flex items-center mt-3.5 px-8.5 text-sm">
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
			<div className="mt-3.5 pb-4.5 min-w-[610px]">
				<div className="text-md font-bold">快捷键设置</div>
				<div className="flex flex-col items-center mt-2 px-8.5 text-sm">
					<div className="grid grid-cols-2 w-full">
						{shortcutInfo.map((i) => {
							return (
								<div key={i.key} className="flex items-center">
									<span>{i.label}</span>
									<Button
										variant="link"
										id={i.id}
										className={cn(
											'cursor-pointer text-md mt-1',
											checkShortcut === i.key && !i.shortcut
												? 'text-textcolor/70'
												: 'text-textcolor',
										)}
										onClick={() => onChangeShortCut(i.key)}
									>
										{checkShortcut === i.key
											? i.shortcut || '按键盘输入快捷键'
											: i.shortcut || i.defaultShortcut}
									</Button>
								</div>
							);
						})}
					</div>
				</div>
			</div>
		</div>
	);
};

export default System;
