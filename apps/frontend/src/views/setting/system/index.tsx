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
	isValidShortcutChord,
	KNOWLEDGE_SHORTCUTS_CHANGED_EVENT,
} from '@/utils/knowledge-shortcuts';
import { isTauriRuntime } from '@/utils/runtime';
import { DEFAULT_INFO, type ShortcutSettingItem } from './config';

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
	/** keydown 同步写入，避免 keyup 读到尚未 commit 的 React state（会卡在仅 Meta） */
	const pendingChordRef = useRef('');
	/** 捕获会话中，完整 chord 只提交一次（防 Meta keyup 二次触发） */
	const capturingRef = useRef(false);

	const resetCapturingItem = useCallback((activeKey: number | null) => {
		pendingChordRef.current = '';
		capturingRef.current = false;
		if (activeKey == null) {
			setCheckShortcut(null);
			return;
		}
		setShortcutInfo((prev) =>
			prev.map((item) =>
				item.key === activeKey ? { ...item, shortcut: '' } : item,
			),
		);
		setCheckShortcut(null);
	}, []);

	/** 录入期间卸掉全局快捷键，避免 OS 抢走主键（否则页面只收到 Meta） */
	const suspendGlobalShortcuts = useCallback(async () => {
		if (isTauriRuntime()) {
			await desktopInvoke('clear_all_shortcuts');
		}
	}, []);

	const restoreGlobalShortcuts = useCallback(() => {
		if (isTauriRuntime()) {
			void desktopInvoke('reload_all_shortcuts');
		}
	}, []);

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

	const onClickPage = (e: { target: EventTarget | null }) => {
		const target = e.target as HTMLElement | null;
		if (target?.id !== 'shortcut') {
			const activeKey = checkShortcutRef.current;
			resetCapturingItem(activeKey);
			restoreGlobalShortcuts();
		}
	};

	const onKeydown = useCallback((e: KeyboardEvent) => {
		const activeKey = checkShortcutRef.current;
		if (activeKey == null || !capturingRef.current) return;
		const info = shortcutInfoRef.current.find((item) => item.key === activeKey);
		if (!info?.key) return;

		e.preventDefault();
		e.stopPropagation();

		const modifiers: string[] = [];
		if (e.metaKey) modifiers.push('Meta');
		if (e.ctrlKey) modifiers.push('Control');
		if (e.altKey) modifiers.push('Alt');
		if (e.shiftKey) modifiers.push('Shift');

		// 主键：优先 e.key；Cmd 组合下部分环境 key 异常时用 e.code（KeyD → D）
		let primary: string | null = null;
		if (!['Control', 'Alt', 'Shift', 'Meta'].includes(e.key)) {
			if (e.key.length === 1) {
				primary = capitalizeWords(e.key);
			} else {
				const letter = /^Key([A-Z])$/.exec(e.code);
				const digit = /^Digit([0-9])$/.exec(e.code);
				if (letter) primary = letter[1];
				else if (digit) primary = digit[1];
				else primary = capitalizeWords(e.key);
			}
		}
		if (primary) modifiers.push(primary);

		const shortcuts = modifiers.join(' + ');
		pendingChordRef.current = shortcuts;
		setShortcutInfo((prev) =>
			prev.map((item) =>
				item.key === activeKey ? { ...item, shortcut: shortcuts } : item,
			),
		);
	}, []);

	const onKeyup = useCallback(
		(_e: KeyboardEvent) => {
			if (!capturingRef.current) return;
			const activeKey = checkShortcutRef.current;
			const info = shortcutInfoRef.current.find(
				(item) => item.key === activeKey,
			);
			if (activeKey == null || !info?.key) return;

			const shortcuts = pendingChordRef.current.trim();
			// 仅修饰键（如单独 Meta）不算完成，等主键
			if (!isValidShortcutChord(shortcuts)) return;

			capturingRef.current = false;
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
				resetCapturingItem(activeKey);
				restoreGlobalShortcuts();
				return;
			}

			/** 知识库等：只写 store；窗口菜单项还需同步菜单加速键 */
			if (pageOnly) {
				void (async () => {
					await setValue(`shortcut_${info.key}`, shortcuts);
					setShortcutInfo((prev) =>
						prev.map((item) =>
							item.key === activeKey
								? { ...item, shortcut: '', defaultShortcut: shortcuts }
								: item,
						),
					);
					setCheckShortcut(null);
					pendingChordRef.current = '';
					window.dispatchEvent(
						new CustomEvent(KNOWLEDGE_SHORTCUTS_CHANGED_EVENT),
					);
					if (info.syncWindowMenu && isTauriRuntime()) {
						void desktopInvoke('sync_window_menu_shortcuts');
					}
					restoreGlobalShortcuts();
				})();
				return;
			}

			if (!isTauriRuntime()) {
				Toast({
					type: 'info',
					title: t('setting.system.shortcuts.globalOnlyDesktop'),
				});
				resetCapturingItem(activeKey);
				return;
			}

			desktopInvoke('register_shortcut', {
				shortcutStr: shortcuts,
				currentKey: activeKey,
			})
				.then(() => {
					void setValue(`shortcut_${info.key}`, shortcuts);
					setShortcutInfo((prev) =>
						prev.map((item) =>
							item.key === activeKey
								? {
										...item,
										shortcut: '',
										defaultShortcut: shortcuts,
									}
								: item,
						),
					);
					setCheckShortcut(null);
					pendingChordRef.current = '';
					restoreGlobalShortcuts();
				})
				.catch((error: string) => {
					Toast({
						type: 'error',
						title: t('setting.system.shortcuts.registerFailed'),
						message: error,
					});
					console.error(error, 'error');
					resetCapturingItem(activeKey);
					restoreGlobalShortcuts();
				});
		},
		[t, resetCapturingItem, restoreGlobalShortcuts],
	);
	useEffect(() => {
		window.addEventListener('keydown', onKeydown, true);
		window.addEventListener('keyup', onKeyup, true);
		window.addEventListener('click', onClickPage);

		return () => {
			window.removeEventListener('keydown', onKeydown, true);
			window.removeEventListener('keyup', onKeyup, true);
			window.removeEventListener('click', onClickPage);
		};
	}, [onKeydown, onKeyup]);

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
		pendingChordRef.current = '';
		capturingRef.current = true;
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
		// 页内快捷键也要先卸全局，否则已占用组合（如 Meta+O）的主键进不了页面
		await suspendGlobalShortcuts();
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
									'hideOrShowApp',
									'reload',
									'window_close',
									'window_scale',
									'window_minimize',
									'window_fill',
									'window_center',
									'window_fullscreen',
									'file_about',
									'file_logout',
									'file_quit',
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

								// 约定：label 形如「知识库：保存」→ 分组「知识库」、展示「保存」
								const groupTitle = first;
								const displayLabel =
									parts.length >= 2
										? parts.slice(1).join(separator || '：')
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
										'not-first:mt-3',
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
