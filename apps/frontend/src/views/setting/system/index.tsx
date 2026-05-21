import { Button } from '@ui/button';
import { Toast } from '@ui/index';
import { Label } from '@ui/label';
import { RadioGroup, RadioGroupItem } from '@ui/radio-group';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useI18n } from '@/hooks';
import { cn } from '@/lib/utils';
import { capitalizeWords, getValue, setValue } from '@/utils';
import {
	chordStringsSemanticallyEqual,
	KNOWLEDGE_SHORTCUTS_CHANGED_EVENT,
} from '@/utils/knowledge-shortcuts';
import { isTauriRuntime } from '@/utils/runtime';
import { DEFAULT_INFO, type ShortcutSettingItem } from './config';
import { TtsVoiceSetting } from './TtsVoiceSetting';

/** 仅在桌面壳内调用 Rust 命令 */
async function desktopInvoke<T>(
	cmd: string,
	args?: Record<string, unknown>,
): Promise<T> {
	const { invoke } = await import('@tauri-apps/api/core');
	return invoke(cmd, args) as Promise<T>;
}

const System = () => {
	const { t } = useI18n();
	const [savePath, setSavePath] = useState('');
	const [startType, setStartType] = useState('1');
	const [closeType, setCloseType] = useState('1');
	const [checkShortcut, setCheckShortcut] = useState<number | null>(null);
	const [shortcutInfo, setShortcutInfo] = useState<ShortcutSettingItem[]>(() =>
		DEFAULT_INFO.map((i) => ({ ...i })),
	);
	const shortcutInfoRef = useRef(shortcutInfo);
	shortcutInfoRef.current = shortcutInfo;
	const checkShortcutRef = useRef(checkShortcut);
	checkShortcutRef.current = checkShortcut;

	const getShortCutInfo = useCallback(async () => {
		const next = await Promise.all(
			DEFAULT_INFO.map(async (i) => {
				const stored = await getValue<string>(`shortcut_${i.key}`);
				const resolved =
					stored != null && String(stored).trim() !== ''
						? String(stored).trim()
						: i.defaultShortcut;
				return { ...i, shortcut: '', defaultShortcut: resolved };
			}),
		);
		setShortcutInfo(next);
	}, []);

	useEffect(() => {
		getSavePath();
		getCloseType();
		checkStartType();
		void getShortCutInfo();
	}, [getShortCutInfo]);

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

	const onKeyup = useCallback((_e: KeyboardEvent) => {
		const activeKey = checkShortcutRef.current;
		const info = shortcutInfoRef.current.find((item) => item.key === activeKey);
		if (!info?.key || !info.shortcut) return;

		const shortcuts = info.shortcut;
		const pageOnly = info.registerGlobally === false;

		const list = shortcutInfoRef.current;
		const conflict = list.find(
			(item) =>
				item.key !== activeKey &&
				chordStringsSemanticallyEqual(
					shortcuts,
					item.shortcut.trim() || item.defaultShortcut,
				),
		);
		if (conflict) {
			Toast({
				type: 'info',
				title: t('setting.system.shortcuts.conflictTitle'),
				message: t('setting.system.shortcuts.conflictMessage', {
					label: t(conflict.labelKey) || conflict.label,
				}),
			});
			setShortcutInfo((prev) =>
				prev.map((item) =>
					item.key === activeKey ? { ...item, shortcut: '' } : item,
				),
			);
			setCheckShortcut(null);
			if (!pageOnly && isTauriRuntime()) {
				void desktopInvoke('reload_all_shortcuts');
			}
			return;
		}

		/** 知识库等：只写 store，由页面内 keydown 响应，不占用全局快捷键 */
		if (pageOnly) {
			void (async () => {
				await setValue(`shortcut_${info.key}`, shortcuts);
				setShortcutInfo((prev) =>
					prev.map((item) =>
						item.key === activeKey
							? { ...item, shortcut: shortcuts, defaultShortcut: shortcuts }
							: item,
					),
				);
				window.dispatchEvent(
					new CustomEvent(KNOWLEDGE_SHORTCUTS_CHANGED_EVENT),
				);
			})();
			return;
		}

		if (!isTauriRuntime()) {
			Toast({
				type: 'info',
				title: t('setting.system.shortcuts.globalOnlyDesktop'),
			});
			return;
		}

		desktopInvoke('register_shortcut', {
			shortcutStr: shortcuts,
			currentKey: activeKey,
		})
			.then(() => {
				setShortcutInfo((prev) =>
					prev.map((item) => {
						if (item.key === activeKey) {
							void setValue(`shortcut_${item.key}`, shortcuts);
							return {
								...item,
								shortcut: shortcuts,
								defaultShortcut: shortcuts,
							};
						}
						return item;
					}),
				);
			})
			.catch((error: string) => {
				Toast({
					type: 'error',
					title: t('setting.system.shortcuts.registerFailed'),
					message: error,
				});
				console.error(error, 'error');
				setShortcutInfo((prev) =>
					prev.map((item) =>
						item.key === activeKey ? { ...item, shortcut: '' } : item,
					),
				);
			});
	}, []);

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
			Toast({
				type: 'info',
				title: t('setting.system.storage.selectDirOnlyDesktop'),
			});
			return;
		}
		const path: string = await desktopInvoke<string>('select_directory');
		setValue('savePath', path);
		setSavePath(path);
	};

	const onChangeAutoStart = async (value: string) => {
		if (!isTauriRuntime()) {
			Toast({
				type: 'info',
				title: t('setting.system.startup.autoStartOnlyDesktop'),
			});
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
		const item = DEFAULT_INFO.find((i) => i.key === value);
		const isGlobal = item?.registerGlobally !== false;
		if (isGlobal && isTauriRuntime()) {
			await desktopInvoke('clear_all_shortcuts');
		}
	};

	return (
		<div className="w-full h-full max-w-3xl mx-auto flex flex-col justify-center items-center m-2">
			<div className="w-full">
				<div className="border-b border-theme/20 pb-2 w-full">
					<div className="text-md font-bold">
						{t('setting.system.storage.title')}
					</div>
					<div className="mt-2 px-8.5 text-sm">
						<span className="mr-2">
							{t('setting.system.storage.defaultPath')}
						</span>
						<span className="ml-2 text-theme/90 text-md">{savePath}</span>
						<Button
							variant="link"
							className="cursor-pointer text-theme text-md"
							onClick={changeDir}
						>
							{t('setting.system.storage.changeDir')}
						</Button>
					</div>
				</div>
				<div className="my-3.5 border-b border-theme/20 pb-4.5 w-full">
					<div className="text-md font-bold">
						{t('setting.system.startup.title')}
					</div>
					<div className="flex items-center mt-3.5 px-8.5 text-sm">
						<span className="mr-2">
							{t('setting.system.startup.autoStart')}
						</span>
						<RadioGroup
							value={startType}
							className="flex items-center ml-2"
							onValueChange={onChangeAutoStart}
						>
							<div className="flex items-center gap-2 mr-5">
								<RadioGroupItem value="1" id="r1" />
								<Label htmlFor="r1" className="cursor-pointer">
									{t('setting.system.startup.autoStartOff')}
								</Label>
							</div>
							<div className="flex items-center gap-2">
								<RadioGroupItem value="2" id="r2" />
								<Label htmlFor="r2" className="text-sm cursor-pointer">
									{t('setting.system.startup.autoStartOn')}
								</Label>
							</div>
						</RadioGroup>
					</div>
				</div>
				<div className="border-b border-theme/20 pb-4.5 w-full">
					<div className="text-md font-bold">
						{t('setting.system.close.title')}
					</div>
					<div className="flex items-center mt-3.5 px-8.5 text-sm">
						<span className="mr-2">{t('setting.system.close.closeApp')}</span>
						<RadioGroup
							value={closeType}
							className="flex items-center ml-2"
							onValueChange={onChangeCloseType}
						>
							<div className="flex items-center gap-2 mr-5">
								<RadioGroupItem value="1" id="c1" />
								<Label htmlFor="c1" className="text-md cursor-pointer">
									{t('setting.system.close.minimizeToTray')}
								</Label>
							</div>
							<div className="flex items-center gap-2">
								<RadioGroupItem value="2" id="c2" />
								<Label htmlFor="c2" className="text-md cursor-pointer">
									{t('setting.system.close.quit')}
								</Label>
							</div>
						</RadioGroup>
					</div>
				</div>
				<TtsVoiceSetting />
				<div className="mt-3.5 pb-4.5 w-full">
					<div className="text-md font-bold">
						{t('setting.system.shortcuts.title')}
					</div>
					<div className="my-3.5 px-8.5 text-xs text-textcolor/55">
						{t('setting.system.shortcuts.desc')}
					</div>
					<div className="flex flex-col items-center mt-2 text-sm box-border">
						{(() => {
							type Group = {
								title: string;
								items: Array<ShortcutSettingItem & { displayLabel: string }>;
							};

							const separator = t('setting.system.shortcuts.separator');
							const knowledgePrefix = t(
								'setting.system.shortcuts.group.knowledge',
							);

							const groups = new Map<string, Group>();
							for (const i of shortcutInfo) {
								const localizedLabel = t(i.labelKey) || i.label;
								const parts = localizedLabel
									.split(/[:：]/)
									.map((p) => p.trim());
								const first =
									parts[0] || t('setting.system.shortcuts.group.other');

								// 手动归类：应用显示/刷新相关放在一起
								const appVisibilityActions = new Set([
									'hide',
									'hideOrShowApp',
									'reload',
								]);
								if (appVisibilityActions.has(i.action)) {
									const groupTitle = t(
										'setting.system.shortcuts.group.appVisibility',
									);
									const g = groups.get(groupTitle) ?? {
										title: groupTitle,
										items: [],
									};
									g.items.push({ ...i, displayLabel: localizedLabel });
									groups.set(groupTitle, g);
									continue;
								}

								// 约定：label 形如「知识库：保存」；若存在两级（如「知识库：产品：保存」），则按「知识库：产品」再细分
								const groupTitle =
									first === knowledgePrefix && parts.length >= 3
										? `${knowledgePrefix}${separator || '：'}${parts[1]}`
										: first;
								const dropCount =
									first === knowledgePrefix && parts.length >= 3
										? 2
										: parts.length >= 2
											? 1
											: 0;
								const displayLabel =
									dropCount > 0
										? parts.slice(dropCount).join(separator || '：')
										: localizedLabel;

								const g = groups.get(groupTitle) ?? {
									title: groupTitle,
									items: [],
								};
								g.items.push({ ...i, displayLabel });
								groups.set(groupTitle, g);
							}

							return Array.from(groups.values()).map((g) => (
								<div
									key={g.title}
									className={cn(
										'w-full',
										'rounded-md border border-theme/15',
										'px-3 pt-3 pb-0.5',
										'not-first:mt-2',
									)}
								>
									<div className="text-xs font-semibold text-textcolor/70 mb-1">
										{g.title}
									</div>
									<div className="grid grid-cols-2 w-full gap-y-1">
										{g.items.map((i) => (
											<div key={i.key} className="flex items-center min-w-0">
												<span className="shrink-0">{i.displayLabel}</span>
												<Button
													variant="link"
													id={i.id}
													className={cn(
														'cursor-pointer text-md mt-1 min-w-0 truncate',
														checkShortcut === i.key && !i.shortcut
															? 'text-textcolor/70'
															: 'text-textcolor',
													)}
													onClick={() => void onChangeShortCut(i.key)}
												>
													{checkShortcut === i.key
														? i.shortcut ||
															t('setting.system.shortcuts.pressKey')
														: i.shortcut || i.defaultShortcut}
												</Button>
											</div>
										))}
									</div>
								</div>
							));
						})()}
					</div>
				</div>
			</div>
		</div>
	);
};

export default System;
