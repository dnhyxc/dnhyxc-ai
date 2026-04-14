import {
	KNOWLEDGE_SHORTCUT_DEFAULT_CHORDS,
	KNOWLEDGE_SHORTCUT_KEY_IDS,
} from '@/utils/knowledge-shortcuts';

export type ShortcutSettingItem = {
	label: string;
	key: number;
	id: string;
	shortcut: string;
	defaultShortcut: string;
	placeholder: string;
	action: string;
	/**
	 * true（默认）：绑定后调用 Tauri 注册全局快捷键；
	 * false：仅写入 store，由具体页面（如知识库）在窗口内监听。
	 */
	registerGlobally?: boolean;
};

export const DEFAULT_INFO: ShortcutSettingItem[] = [
	{
		label: '隐藏程序',
		key: 1,
		id: 'shortcut',
		shortcut: '',
		defaultShortcut: 'Command + W',
		placeholder: '按键盘输入快捷键',
		action: 'hide',
		registerGlobally: true,
	},
	{
		label: '显示隐藏应用',
		key: 2,
		id: 'shortcut',
		shortcut: '',
		defaultShortcut: 'Meta + E',
		placeholder: '按键盘输入快捷键',
		action: 'hideOrShowApp',
		registerGlobally: true,
	},
	{
		label: '刷新应用',
		key: 3,
		id: 'shortcut',
		shortcut: '',
		defaultShortcut: 'Command + Shift + W',
		placeholder: '按键盘输入快捷键',
		action: 'reload',
		registerGlobally: true,
	},
	{
		label: '新建工作流',
		key: 4,
		id: 'shortcut',
		shortcut: '',
		defaultShortcut: 'Command + N',
		placeholder: '按键盘输入快捷键',
		action: 'new_workflow',
		registerGlobally: true,
	},
	{
		label: '打开子窗口',
		key: 5,
		id: 'shortcut',
		shortcut: '',
		defaultShortcut: 'Ctrl + Shift + L',
		placeholder: '按键盘输入快捷键',
		action: 'open_subwindow',
		registerGlobally: true,
	},
	{
		label: '知识库：保存',
		key: KNOWLEDGE_SHORTCUT_KEY_IDS.save,
		id: 'shortcut',
		shortcut: '',
		defaultShortcut: KNOWLEDGE_SHORTCUT_DEFAULT_CHORDS.save,
		placeholder: '按键盘输入快捷键',
		action: 'knowledge_save',
		registerGlobally: false,
	},
	{
		label: '知识库：清空草稿',
		key: KNOWLEDGE_SHORTCUT_KEY_IDS.clear,
		id: 'shortcut',
		shortcut: '',
		defaultShortcut: KNOWLEDGE_SHORTCUT_DEFAULT_CHORDS.clear,
		placeholder: '按键盘输入快捷键',
		action: 'knowledge_clear',
		registerGlobally: false,
	},
	{
		label: '知识库：打开列表',
		key: KNOWLEDGE_SHORTCUT_KEY_IDS.openLibrary,
		id: 'shortcut',
		shortcut: '',
		defaultShortcut: KNOWLEDGE_SHORTCUT_DEFAULT_CHORDS.openLibrary,
		placeholder: '按键盘输入快捷键',
		action: 'knowledge_open_library',
		registerGlobally: false,
	},
	{
		label: '知识库：切换操作栏',
		key: KNOWLEDGE_SHORTCUT_KEY_IDS.toggleMarkdownBottomBar,
		id: 'shortcut',
		shortcut: '',
		defaultShortcut: KNOWLEDGE_SHORTCUT_DEFAULT_CHORDS.toggleMarkdownBottomBar,
		placeholder: '按键盘输入快捷键',
		action: 'knowledge_toggle_markdown_bottom_bar',
		registerGlobally: false,
	},
	{
		label: '知识库：打开回收站',
		key: KNOWLEDGE_SHORTCUT_KEY_IDS.openTrash,
		id: 'shortcut',
		shortcut: '',
		defaultShortcut: KNOWLEDGE_SHORTCUT_DEFAULT_CHORDS.openTrash,
		placeholder: '按键盘输入快捷键',
		action: 'knowledge_open_trash',
		registerGlobally: false,
	},
];
