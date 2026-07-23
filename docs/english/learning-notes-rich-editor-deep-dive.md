# 学习笔记富文本编辑器 — 源码级实现手册

> **状态**：实现归档 | **日期**：2026-07-24 | **适用范围**：`apps/remote-plugins` 子项目 · `RichEditor` 设计系统组件

---

## 0. 读本文你将得到什么

本文是 **源码级逐行详解手册**，覆盖学习笔记富文本编辑器的 **全部 15 个文件**，每一行代码的意图、输入输出、边界处理都有详细中文注释。读完本文你将能够：

- 从 0 到 1 理解 Tiptap 3.x 富文本编辑器的完整封装思路
- 看懂每一个自定义扩展（Title 节点、图片上传、Tab 缩进等）的实现原理
- 掌握工具栏响应式折叠、气泡菜单、链接表单等交互的细节实现
- 理解 ProseMirror Plugin、Transaction、NodeView 等核心概念的实际应用
- 直接复用或移植这套编辑器到你的项目中

---

## 1. 文件总览

### 1.1 RichEditor 组件目录结构

```
apps/remote-plugins/src/components/design/RichEditor/
├── index.tsx              # 主组件：RichEditor 封装
├── types.ts               # 类型定义：Props / ChangePayload / ExtensionsOptions
├── locale.ts              # 中文字典
├── styles.css             # 编辑器全部样式
├── extensions/            # 扩展配置
│   └── index.ts           # Tiptap 扩展组装：13 个扩展 + 自定义 3 个
├── title/                 # 标题节点
│   ├── TitleNode.ts       # 自定义 Title atom 节点 + 工具函数
│   ├── Title.tsx          # Title NodeView（React 组件）
│   └── index.ts           # 统一导出
├── toolbar/               # 工具栏
│   ├── Toolbar.tsx        # 顶部工具栏：响应式 + 更多折叠
│   ├── FormatBubble.tsx   # 选区气泡菜单
│   └── index.ts           # 统一导出
├── link/                  # 链接相关
│   ├── LinkForm.tsx       # 链接输入表单 + useLinkEditor Hook
│   ├── linkRange.ts       # 设链目标范围解析
│   └── index.ts           # 统一导出
├── image/                 # 图片相关
│   ├── image.ts           # 图片工具函数
│   ├── ImageUpload.ts     # 粘贴/拖放图片上传扩展
│   └── index.ts           # 统一导出
└── code/                  # 代码块相关
    ├── languages.ts       # 代码高亮语言列表
    └── index.ts           # 统一导出
```

### 1.2 相关文件

| 文件 | 作用 |
|------|------|
| `design/NotePreview/index.tsx` | 笔记只读预览组件 |
| `views/learning-notes/index.tsx` | 学习笔记主应用（组装编辑器+列表+分栏） |

---

## 2. 类型定义（types.ts）

**来源**：`apps/remote-plugins/src/components/design/RichEditor/types.ts`（共 62 行）

### 2.1 完整代码与逐行注释

```typescript
// 从 @tiptap/react 导入 Editor 类型（编辑器实例）、Extensions 类型（扩展数组）、JSONContent 类型（JSON 格式的文档内容）
import type { Editor, Extensions, JSONContent } from '@tiptap/react';
// 从 React 导入 ReactNode 类型（React 节点，用于插槽/children）
import type { ReactNode } from 'react';
// 从本地 image 模块导入 ResolveImageSrc 类型（图片上传解析函数）
import type { ResolveImageSrc } from './image';
// 从本地 locale 模块导入 RichEditorLocale 类型（国际化字典类型）
import type { RichEditorLocale } from './locale';

// 文本方向类型：从左到右 / 从右到左 / 自动检测
export type TextDirection = 'ltr' | 'rtl' | 'auto';

// 编辑器内容类型：支持 HTML 字符串或 JSONContent 对象两种格式
export type RichEditorContent = string | JSONContent;

// 内容变化时的回调参数类型：四种格式同时返回，方便业务按需取用
export type RichEditorChangePayload = {
	// HTML 字符串格式：方便直接渲染到预览或存储
	html: string;
	// JSON 对象格式：ProseMirror 的 JSON 表示，结构化数据便于操作
	json: JSONContent;
	// 纯文本格式：用于空值判断、字数统计、搜索等
	text: string;
	// 文档首位 title 节点的纯文本：笔记标题，单独提取方便列表展示
	title: string;
};

// createExtensions 函数的配置选项类型
export type CreateExtensionsOptions = {
	// 占位提示文本（显示在空编辑器中）
	placeholder?: string;
	// 字符数上限；不传则只统计不限制
	maxLength?: number;
	// 粘贴/拖放图片的解析函数引用（用 ref 包一层，避免扩展重建）
	resolveImageSrcRef?: { current: ResolveImageSrc };
	// 追加扩展：在默认扩展列表之后追加，不覆盖默认扩展
	extraExtensions?: Extensions;
	// 完全替换默认扩展列表：传入后默认扩展全部不用
	extensions?: Extensions;
};

// RichEditor 组件的 Props 类型定义
export type RichEditorProps = {
	// 受控内容（HTML 或 JSON）：外部控制编辑器内容时使用
	content?: RichEditorContent;
	// 非受控初始内容：只在首次挂载时生效，之后内部自行管理
	defaultContent?: RichEditorContent;
	// 内容变化回调：每次编辑都会触发，携带四种格式的内容
	onChange?: (payload: RichEditorChangePayload) => void;
	// 是否可编辑：true 为编辑模式，false 为只读预览
	editable?: boolean;
	// 自动聚焦：支持布尔值或 'start'/'end'/'all'/数字位置
	autofocus?: boolean | 'start' | 'end' | 'all' | number;
	// 占位提示文本：空编辑器时显示的灰色提示
	placeholder?: string;
	// 容器自定义类名：用于外层布局调整
	className?: string;
	// 编辑器正文自定义类名：用于正文样式微调
	editorClassName?: string;
	// 字数上限：到达后禁止继续输入，右下角变红
	maxLength?: number;
	// 默认文本方向：默认 auto 以支持 RTL（阿拉伯语/希伯来语等）
	textDirection?: TextDirection;
	// 是否显示顶部工具栏
	showToolbar?: boolean;
	// 是否显示选中气泡菜单
	showBubbleMenu?: boolean;
	// 是否显示底部字数统计
	showCharCount?: boolean;
	// 覆盖/合并文案：默认中文，可传入部分字段覆盖
	locale?: Partial<RichEditorLocale>;
	// 完全替换默认扩展：传入后所有默认扩展都不用
	extensions?: Extensions;
	// 在默认扩展后追加：不影响默认扩展，只新增
	extraExtensions?: Extensions;
	// 工具栏尾部插槽：业务方注入自定义按钮（保存、列表开关等）
	// 支持 ReactNode 或函数形式（函数可拿到 editor 实例）
	toolbarExtra?: ReactNode | ((editor: Editor) => ReactNode);
	// 自定义图片上传函数：工具栏选图/粘贴/拖放都会走这里
	// 不传则本地读成 base64 data URL（Tauri 桌面端可用）
	onUploadImage?: ResolveImageSrc;
	// 编辑器创建完成回调：拿到 editor 实例后可做自定义初始化
	onCreate?: (editor: Editor) => void;
};
```

---

## 3. 国际化字典（locale.ts）

**来源**：`apps/remote-plugins/src/components/design/RichEditor/locale.ts`（共 60 行）

### 3.1 完整代码与逐行注释

```typescript
// 富文本编辑器中文文案对象（默认语言）
// 使用 as const 确保类型是字面量类型，便于 RichEditorLocale 精确推导
export const zhCN = {
	// 正文占位提示
	placeholder: '开始输入…',
	// 标题输入框的占位提示
	placeholderHeadingHint: '请输入笔记标题',
	// 各级标题的占位前缀（如「标题 1」「标题 2」）
	placeholderHeading: '标题',
	// 粗体按钮标题
	bold: '粗体',
	// 斜体按钮标题
	italic: '斜体',
	// 下划线按钮标题
	underline: '下划线',
	// 删除线按钮标题
	strike: '删除线',
	// 行内代码按钮标题
	code: '行内代码',
	// 高亮按钮标题
	highlight: '高亮',
	// 一级标题
	h1: '一级标题',
	// 二级标题
	h2: '二级标题',
	// 三级标题
	h3: '三级标题',
	// 四级标题
	h4: '四级标题',
	// 五级标题
	h5: '五级标题',
	// 无序列表
	bulletList: '无序列表',
	// 有序列表
	orderedList: '有序列表',
	// 任务列表（复选框）
	taskList: '任务列表',
	// 引用块
	blockquote: '引用',
	// 代码块
	codeBlock: '代码块',
	// 代码语言选择
	codeLanguage: '代码语言',
	// 水平分隔线
	horizontalRule: '分隔线',
	// 左对齐
	alignLeft: '左对齐',
	// 居中对齐
	alignCenter: '居中',
	// 右对齐
	alignRight: '右对齐',
	// 两端对齐
	alignJustify: '两端对齐',
	// 从左到右（RTL 模式用）
	dirLtr: '从左到右',
	// 从右到左
	dirRtl: '从右到左',
	// 自动方向
	dirAuto: '自动方向',
	// 链接按钮
	link: '链接',
	// 移除链接按钮
	unlink: '移除链接',
	// 链接表单的标签文本
	linkPrompt: '链接地址',
	// 链接输入框占位符
	linkPlaceholder: 'https://example.com',
	// 链接应用按钮
	linkApply: '确定',
	// 链接取消按钮
	linkCancel: '取消',
	// 空行无法设链时的提示
	linkEmptyHint: '请先选中文字，或将光标放在要加链接的内容上',
	// 图片按钮
	image: '图片',
	// 选择本地图片按钮
	imagePick: '选择本地图片',
	// 插入表格按钮
	table: '插入表格',
	// 左侧插入列
	addColumnBefore: '左侧插入列',
	// 右侧插入列
	addColumnAfter: '右侧插入列',
	// 删除列
	deleteColumn: '删除列',
	// 上方插入行
	addRowBefore: '上方插入行',
	// 下方插入行
	addRowAfter: '下方插入行',
	// 删除行
	deleteRow: '删除行',
	// 合并单元格
	mergeCells: '合并单元格',
	// 拆分单元格
	splitCell: '拆分单元格',
	// 删除表格
	deleteTable: '删除表格',
	// 撤销
	undo: '撤销',
	// 重做
	redo: '重做',
	// 清除格式
	clearFormat: '清除格式',
	// 字符数标签
	chars: '字符',
	// 词数标签
	words: '词',
	// 达到字数上限的提示
	limitReached: '已达字数上限',
// 使用 as const 断言，确保类型为字面量只读类型
} as const;

// 从 zhCN 的类型推导 RichEditorLocale 类型，保证字典和类型永远同步
export type RichEditorLocale = typeof zhCN;

// 字典的 key 联合类型，便于按需引用单个字段
export type LocaleKey = keyof RichEditorLocale;
```

### 3.2 设计要点

1. **类型推导模式**：先定义 `zhCN` 常量（带 `as const`），再用 `typeof zhCN` 推导类型。这样**永远不会出现类型和值不同步**的问题——新增字段只需改常量，类型自动更新。
2. **完全中文默认**：编辑器默认全中文 UI，不需要额外配置语言。
3. **部分覆盖**：`RichEditorProps.locale` 是 `Partial<RichEditorLocale>`，业务方只需传入要修改的几个字段，其余默认中文。

---

## 4. 代码高亮语言列表（languages.ts）

**来源**：`apps/remote-plugins/src/components/design/RichEditor/code/languages.ts`（共 24 行）

### 4.1 完整代码与逐行注释

```typescript
// 代码块语法高亮支持的主流语言列表（中文标签已在 UI 中不需要，保留英文标签）
// 使用 as const 确保是字面量只读数组
export const CODE_LANGUAGES = [
	// JavaScript：最常用的前端语言
	{ value: 'javascript', label: 'JavaScript' },
	// TypeScript：JavaScript 的超集，带类型
	{ value: 'typescript', label: 'TypeScript' },
	// HTML：超文本标记语言
	{ value: 'html', label: 'HTML' },
	// CSS：层叠样式表
	{ value: 'css', label: 'CSS' },
	// Less：CSS 预处理器
	{ value: 'less', label: 'Less' },
	// SCSS：Sass 的一种语法
	{ value: 'scss', label: 'SCSS' },
	// Rust：系统级编程语言
	{ value: 'rust', label: 'Rust' },
	// Python：解释型编程语言
	{ value: 'python', label: 'Python' },
	// C：底层编程语言
	{ value: 'c', label: 'C' },
	// Java：面向对象编程语言
	{ value: 'java', label: 'Java' },
	// JSON：数据交换格式
	{ value: 'json', label: 'JSON' },
	// Go：Google 开发的编程语言
	{ value: 'go', label: 'Go' },
	// SQL：结构化查询语言
	{ value: 'sql', label: 'SQL' },
	// Wasm：WebAssembly
	{ value: 'wasm', label: 'Wasm' },
	// PHP：服务器端脚本语言
	{ value: 'php', label: 'PHP' },
	// Ruby：动态编程语言
	{ value: 'ruby', label: 'Ruby' },
	// Markdown：轻量级标记语言
	{ value: 'markdown', label: 'Markdown' },
	// Shell：Shell 脚本
	{ value: 'shell', label: 'Shell' },
	// Bash：Bash 脚本
	{ value: 'bash', label: 'Bash' },
// as const 断言，使数组元素类型为字面量类型（用于 CodeLanguage 类型推导）
] as const;

// 从 CODE_LANGUAGES 推导 CodeLanguage 类型：所有 value 的联合类型
// 例如：'javascript' | 'typescript' | 'html' | ...
export type CodeLanguage = (typeof CODE_LANGUAGES)[number]['value'];
```

---

## 5. 图片工具函数（image.ts）

**来源**：`apps/remote-plugins/src/components/design/RichEditor/image/image.ts`（共 70 行）

### 5.1 模块职责

提供图片相关的纯工具函数：
- 本地文件 → data URL 转换
- 系统文件选择器唤起
- 剪贴板/拖放图片提取
- 批量插入图片到编辑器

### 5.2 完整代码与逐行注释

```typescript
// 从 @tiptap/react 导入 Editor 类型，用于函数参数类型标注
import type { Editor } from '@tiptap/react';

// 本地 File 对象 → data URL（base64）的 Promise 封装
// 默认插图方式：兼容 Tauri WebView，因为 Tauri 环境可能没有 CDN 或后端上传
export function fileToDataUrl(file: File): Promise<string> {
	// 返回 Promise，异步读取文件
	return new Promise((resolve, reject) => {
		// 创建 FileReader 实例用于读取文件
		const reader = new FileReader();
		// 读取成功时：将 result 转成字符串并 resolve
		reader.onload = () => resolve(String(reader.result));
		// 读取失败时：reject 错误对象，没有则构造一个
		reader.onerror = () => reject(reader.error ?? new Error('read failed'));
		// 开始读取文件为 data URL（base64 格式）
		reader.readAsDataURL(file);
	});
}

// 唤起系统文件选择器，让用户选一张本地图片
// 不用 window.prompt 或自定义 UI，直接用原生 input[type=file]
export function pickImageFile(accept = 'image/*'): Promise<File | null> {
	// 返回 Promise：用户选择后 resolve，取消也 resolve(null)
	return new Promise((resolve) => {
		// 动态创建 input 元素（不插入 DOM，用完即销毁）
		const input = document.createElement('input');
		// 设置为文件选择类型
		input.type = 'file';
		// 限制可选文件类型（默认 image/* 即所有图片）
		input.accept = accept;
		// 不允许多选
		input.multiple = false;
		// 防止重复 resolve（有些浏览器 change 和 cancel 可能都触发）
		let settled = false;
		// 完成回调：确保只调用一次 resolve
		const done = (file: File | null) => {
			// 已经 resolve 过就直接返回，防止重复
			if (settled) return;
			// 标记为已完成
			settled = true;
			// resolve 结果
			resolve(file);
		};
		// 用户选择文件后触发：取第一个文件，没有就传 null
		input.onchange = () => done(input.files?.[0] ?? null);
		// Chromium / Tauri WebView 支持 cancel 事件：用户点取消也回调
		input.addEventListener('cancel', () => done(null));
		// 模拟点击，唤起文件选择对话框
		input.click();
	});
}

// 判断一个 File 是否是图片类型
export function isImageFile(file: File): boolean {
	// 通过 MIME type 前缀判断：image/png、image/jpeg、image/gif 等
	return file.type.startsWith('image/');
}

// 从剪贴板事件中提取图片文件数组
export function clipboardImageFiles(event: ClipboardEvent): File[] {
	// 获取剪贴板数据项列表（DataTransferItemList）
	const items = event.clipboardData?.items;
	// 没有数据项直接返回空数组
	if (!items) return [];
	// 准备输出数组
	const out: File[] = [];
	// 遍历所有剪贴板项
	for (let i = 0; i < items.length; i++) {
		// 取当前项
		const item = items[i];
		// 不是图片类型就跳过
		if (!item?.type.startsWith('image/')) continue;
		// 将 DataTransferItem 转成 File 对象
		const file = item.getAsFile();
		// 转换成功就加入结果数组
		if (file) out.push(file);
	}
	// 返回所有图片文件
	return out;
}

// 从 DataTransfer（拖放事件的 dataTransfer）中提取图片文件
export function dataTransferImageFiles(dt: DataTransfer | null): File[] {
	// 没有 dataTransfer 或 files 为空，返回空数组
	if (!dt?.files?.length) return [];
	// 转成数组后过滤，只保留图片文件
	return [...dt.files].filter(isImageFile);
}

// 图片 URL 解析函数类型：输入 File，输出 URL 字符串或 Promise
// 支持同步或异步返回，返回 null/undefined/空串表示不插入
export type ResolveImageSrc = (
	file: File,
) => string | Promise<string | null | undefined>;

// 批量插入图片到编辑器
// 遍历文件列表，逐个解析 src 后插入到当前光标位置
export async function insertImages(
	// Tiptap 编辑器实例
	editor: Editor,
	// 要插入的图片文件数组
	files: File[],
	// 图片 src 解析函数（base64 或上传到 CDN）
	resolveSrc: ResolveImageSrc,
): Promise<void> {
	// 遍历每个文件
	for (const file of files) {
		// 不是图片就跳过（双重保险，调用方可能已经过滤过）
		if (!isImageFile(file)) continue;
		// 调用解析函数获取图片 URL（可能是 base64 或 CDN 地址）
		const src = await resolveSrc(file);
		// src 为空或空白就跳过（上传失败时不插入）
		if (!src?.trim()) continue;
		// 使用 Tiptap chain API：聚焦 → 插入图片 → 执行
		// alt 属性用文件名，方便辅助技术和导出
		editor.chain().focus().setImage({ src: src.trim(), alt: file.name }).run();
	}
}
```

---

## 6. 图片上传扩展（ImageUpload.ts）

**来源**：`apps/remote-plugins/src/components/design/RichEditor/image/ImageUpload.ts`（共 56 行）

### 6.1 模块职责

自定义 Tiptap 扩展，拦截 **粘贴** 和 **拖放** 事件，自动将图片插入编辑器。

### 6.2 设计要点

- **通过 ref 读上传函数**：`resolveSrcRef.current` 而非直接存 options。因为 `useEditor` 的扩展只在首次创建时组装，props 变化不会重建扩展。用 ref 可以让上传实现动态更新而不重建编辑器。
- **只处理图片，不拦截文字**：`handlePaste` 返回 false 时走默认粘贴行为，返回 true 时表示已处理。

### 6.3 完整代码与逐行注释

```typescript
// 从 @tiptap/core 导入 Extension 基类，用于创建自定义扩展
import { Extension } from '@tiptap/core';
// 从 ProseMirror state 导入 Plugin 和 PluginKey，用于创建状态插件
import { Plugin, PluginKey } from '@tiptap/pm/state';
// 导入图片相关工具函数
import {
	clipboardImageFiles,
	dataTransferImageFiles,
	fileToDataUrl,
	insertImages,
	type ResolveImageSrc,
} from './image';

// ImageUpload 扩展的配置选项类型
export type ImageUploadOptions = {
	// 可变引用：始终读取最新的上传实现（默认 FileReader → data URL）
	// 用 ref 而不是直接传函数，是因为扩展只在创建时组装一次
	// 后续 onUploadImage prop 变化时，只需更新 ref.current 即可
	resolveSrcRef: { current: ResolveImageSrc };
};

// 图片上传扩展：粘贴 / 拖放本地图片到编辑器时自动插入
// 通过 ref 读上传函数，避免 useEditor 扩展不随 props 重建的问题
export const ImageUpload = Extension.create<ImageUploadOptions>({
	// 扩展名称，唯一标识
	name: 'imageUpload',

	// 定义默认选项
	addOptions() {
		return {
			// 默认用 base64 方式读取
			resolveSrcRef: { current: fileToDataUrl },
		};
	},

	// 添加 ProseMirror 插件（处理底层事件）
	addProseMirrorPlugins() {
		// 拿到编辑器实例
		const editor = this.editor;
		// 从 options 中解构出 resolveSrcRef
		const { resolveSrcRef } = this.options;

		// 返回插件数组
		return [
			// 创建一个新的 ProseMirror Plugin
			new Plugin({
				// 插件 key，用于在 state 中查找此插件
				key: new PluginKey('imageUpload'),
				// 插件属性：定义事件处理
				props: {
					// 处理粘贴事件
					handlePaste(_view, event) {
						// 从剪贴板提取图片文件
						const files = clipboardImageFiles(event);
						// 没有图片就返回 false，让 ProseMirror 走默认粘贴逻辑
						if (!files.length) return false;
						// 阻止默认粘贴行为
						event.preventDefault();
						// 异步插入图片（void 表示不等待，不阻塞粘贴事件）
						void insertImages(editor, files, (f) => resolveSrcRef.current(f));
						// 返回 true 表示已处理此事件
						return true;
					},
					// 处理拖放事件
					handleDrop(_view, event, _slice, moved) {
						// 如果是编辑器内部移动（moved=true），不处理，走默认拖拽排序
						if (moved) return false;
						// 从拖放数据中提取图片文件
						const files = dataTransferImageFiles(event.dataTransfer);
						// 没有图片就返回 false，走默认拖放逻辑
						if (!files.length) return false;
						// 阻止默认拖放行为
						event.preventDefault();
						// 异步插入图片
						void insertImages(editor, files, (f) => resolveSrcRef.current(f));
						// 返回 true 表示已处理
						return true;
					},
				},
			}),
		];
	},
});
```

---

## 7. 链接范围解析（linkRange.ts）

**来源**：`apps/remote-plugins/src/components/design/RichEditor/link/linkRange.ts`（共 86 行）

### 7.1 模块职责

解析「设链目标」——用户点链接按钮时，应该给哪段文字加链接？

对齐常见富文本行为（飞书/Notion/语雀）：
1. 已有文本选区 → 用选区
2. 光标在已有链接内 → 扩展到整段 link mark
3. 光标落在词/连续非空白内 → 扩展到该词（含中文连续字）
4. 否则 → 扩展到当前行（文本块）的全部文本
5. 空行 → null（绝不把 URL 插入正文）

### 7.2 完整代码与逐行注释

```typescript
// 从 @tiptap/core 导入 Editor 类型和工具函数
import type { Editor } from '@tiptap/core';
// getMarkRange：找到光标所在位置的某个 mark 的完整范围
// isTextSelection：判断是否是文本选区
import { getMarkRange, isTextSelection } from '@tiptap/core';
// 导入 ProseMirror 的 Node 类型（文档节点）
import type { Node as PmNode } from '@tiptap/pm/model';
// 导入 EditorState 类型（编辑器状态）
import type { EditorState } from '@tiptap/pm/state';

// 链接范围类型：起始位置和结束位置
export type LinkRange = { from: number; to: number };

// 解析「设链目标」选区（对齐常见富文本行为）
// 优先级：已选中文本 > 光标在链接内 > 光标在词中 > 整行文本 > 空行(null)
export function resolveLinkTarget(state: EditorState): LinkRange | null {
	// 从 state 中解构出选区、文档、schema
	const { selection, doc, schema } = state;
	// 从选区中解构起止位置和是否空选区
	const { from, to, empty, $from } = selection;

	// 情况1：已有非空选区 → 直接用选区范围
	if (!empty && to > from) return { from, to };

	// 情况2：光标在已有链接内 → 扩展到整个 link mark 的范围
	if (isTextSelection(selection) && schema.marks.link) {
		// getMarkRange 找到 $from 位置处 link mark 的完整范围
		const markRange = getMarkRange($from, schema.marks.link);
		// 找到了且范围有效 → 返回
		if (markRange && markRange.to > markRange.from) return markRange;
	}

	// 情况3：光标落在一个词/连续非空白字符内 → 扩展到这个词
	const word = expandNonWhitespaceAround(doc, from);
	// 找到了就返回
	if (word) return word;

	// 情况4：光标在文本块内 → 扩展到整行（当前文本块的全部内容）
	if ($from.parent.isTextblock) {
		// 当前文本块的起始位置
		const start = $from.start();
		// 当前文本块的结束位置
		const end = $from.end();
		// 有内容就返回整行范围
		if (end > start) return { from: start, to: end };
	}

	// 情况5：空行或其它情况 → 返回 null（不设链，也不插入 URL 文本）
	return null;
}

// 从 pos 位置向两侧扩展，找到包含该位置的连续非空白字符范围
// 用于「光标在一个单词中间时，点链接按钮自动选中整个单词」
function expandNonWhitespaceAround(
	// 文档节点
	doc: PmNode,
	// 光标位置
	pos: number,
): LinkRange | null {
	// 文档总长度（content.size）
	const size = doc.content.size;
	// 空文档直接返回 null
	if (size < 1) return null;

	// 将 pos 钳制在合法范围内（0 到 size）
	const clamped = Math.max(0, Math.min(pos, size));
	// 解析该位置，得到 ResolvedPos（带有层级信息的位置）
	const $pos = doc.resolve(clamped);
	// 光标不在文本块内 → 返回 null（比如在图片节点上）
	if (!$pos.parent.isTextblock) return null;

	// 当前文本块的起始位置
	const blockStart = $pos.start();
	// 当前文本块的结束位置
	const blockEnd = $pos.end();
	// 文本块为空 → 返回 null
	if (blockEnd <= blockStart) return null;

	// 提取文本块内的纯文本（blockStart 到 blockEnd）
	// textBetween 的后两个参数是：块之间用什么分隔、不同层级用什么
	const text = doc.textBetween(blockStart, blockEnd, '\n', '\0');
	// 文本全是空白 → 返回 null
	if (!text.trim()) return null;

	// 计算光标在当前文本块内的偏移量
	let offset = Math.max(0, Math.min(clamped - blockStart, text.length));

	// 光标在字符右侧时的边界处理：
	// 如果 offset 在空白处，且左边字符是非空白 → 往左贴一个字符
	// 这样「单词后点击」也能选中整个单词
	if (
		// offset 大于 0（不在最左边）
		offset > 0 &&
		// offset 已经到末尾或当前字符是空白
		(offset >= text.length || /\s/.test(text[offset]!)) &&
		// 左边一个字符是非空白
		!/\s/.test(text[offset - 1]!)
	) {
		// 左移一位，贴到左侧字符上
		offset -= 1;
	}

	// 修正后当前位置还是空白 → 不在任何词内，返回 null
	if (offset >= text.length || /\s/.test(text[offset]!)) return null;

	// 从 offset 向左找第一个空白字符的位置（即词的左边界）
	let left = offset;
	// 从 offset+1 向右找第一个空白字符的位置（即词的右边界）
	let right = offset + 1;
	// 向左扩展：没到左边、且左边字符非空白，就继续左移
	while (left > 0 && !/\s/.test(text[left - 1]!)) left -= 1;
	// 向右扩展：没到末尾、且当前字符非空白，就继续右移
	while (right < text.length && !/\s/.test(text[right]!)) right += 1;

	// 转换为文档绝对位置并返回
	return { from: blockStart + left, to: blockStart + right };
}

// 给指定范围设置链接
export function applyLinkToRange(editor: Editor, range: LinkRange, href: string) {
	// 先选中目标范围，再设置链接
	// 注意：只用 setTextSelection + setLink，不要串联 extendMarkRange
	// 因为当目标位置没有 mark 时，extendMarkRange 会中断 chain
	editor.chain().focus().setTextSelection(range).setLink({ href }).run();
}

// 移除指定范围的链接
export function removeLinkInRange(editor: Editor, range: LinkRange) {
	// 先选中目标范围，再取消链接
	editor.chain().focus().setTextSelection(range).unsetLink().run();
}
```

---

## 8. 链接表单与 Hook（LinkForm.tsx）

**来源**：`apps/remote-plugins/src/components/design/RichEditor/link/LinkForm.tsx`（共 167 行）

### 8.1 模块职责

- `LinkForm` 组件：自定义链接输入面板（替代 `window.prompt`，适配 Tauri 桌面端）
- `useLinkEditor` Hook：链接编辑的状态管理逻辑

### 8.2 设计要点

- **不用 window.prompt**：Tauri 桌面端可能不支持或样式不统一，用自定义表单更好看。
- **打开时先选中文本**：用户能明确看到将对哪段文字设链。
- **空行不设链**：绝不把 URL 作为文本插入正文，避免污染内容。
- **Enter 应用 / Esc 取消**：符合键盘操作习惯。

### 8.3 完整代码与逐行注释

```typescript
// 导入 Editor 类型
import type { Editor } from '@tiptap/react';
// 导入 React Hook
import { useCallback, useEffect, useRef, useState } from 'react';
// 导入链接范围相关工具
import {
	applyLinkToRange,
	removeLinkInRange,
	resolveLinkTarget,
	type LinkRange,
} from './linkRange';
// 导入国际化类型（从父目录的 locale 导入，因为 LinkForm.tsx 在 link/ 目录下）
import type { RichEditorLocale } from '../locale';

// 链接草稿状态类型
export type LinkDraft = {
	// 当前输入的链接地址
	href: string;
	// 设链目标范围；null 表示空行，无法设链
	range: LinkRange | null;
};

// LinkForm 组件的 Props 类型
type LinkFormProps = {
	// 国际化字典
	locale: RichEditorLocale;
	// 当前链接地址（受控）
	href: string;
	// 地址变化回调
	onHrefChange: (href: string) => void;
	// 应用按钮回调
	onApply: () => void;
	// 移除链接按钮回调
	onRemove: () => void;
	// 关闭按钮回调
	onClose: () => void;
	// 空行无法设链时的提示文本
	hint?: string;
};

// 自定义链接输入面板组件（替代 window.prompt，适配 Tauri）
export function LinkForm({
	// 解构 locale 为 t，简写方便
	locale: t,
	href,
	onHrefChange,
	onApply,
	onRemove,
	onClose,
	hint,
}: LinkFormProps) {
	// input 的 ref，用于自动聚焦
	const inputRef = useRef<HTMLInputElement>(null);

	// 组件挂载后自动聚焦输入框并全选文本
	useEffect(() => {
		// 聚焦输入框
		inputRef.current?.focus();
		// 选中全部文字，方便直接输入覆盖
		inputRef.current?.select();
	// 只在挂载时执行一次
	}, []);

	return (
		// 链接表单容器
		<div
			className="rich-editor-link-form"
			// 语义化角色：对话框
			role="dialog"
			//  aria 标签
			aria-label={t.link}
			// 阻止在非交互元素上的鼠标按下事件
			// 防止点击表单空白处导致编辑器失焦或选区变化
			onMouseDown={(e) => {
				// 如果点击的是 input 或 button 等交互元素，不拦截
				if ((e.target as HTMLElement).closest('input,button')) return;
				// 阻止默认行为，避免编辑器选区丢失
				e.preventDefault();
			}}
		>
			// 链接地址标签
			<span className="rich-editor-link-label">{t.linkPrompt}</span>
			// 链接地址输入框
			<input
				// 挂载 ref
				ref={inputRef}
				// 文本类型
				type="text"
				// 输入模式：url（移动端显示优化）
				inputMode="url"
				// 自动填充：url
				autoComplete="url"
				// 样式类名
				className="rich-editor-link-input"
				// 占位符
				placeholder={t.linkPlaceholder}
				// 当前值（受控）
				value={href}
				// 输入时回调
				onChange={(e) => onHrefChange(e.target.value)}
				// 键盘事件：Enter 应用，Esc 取消
				onKeyDown={(e) => {
					// 按 Enter
					if (e.key === 'Enter') {
						// 阻止默认（避免换行）
						e.preventDefault();
						// 应用链接
						onApply();
					}
					// 按 Escape
					if (e.key === 'Escape') {
						// 阻止默认
						e.preventDefault();
						// 关闭表单
						onClose();
					}
				}}
			/>
			// 有提示时显示（比如空行无法设链的提示）
			{hint ? <span className="rich-editor-link-hint">{hint}</span> : null}
			// 确定按钮
			<button
				type="button"
				className="rich-editor-link-action"
				// 有 hint 时禁用（空行无法设链）
				disabled={!!hint}
				// 点击应用
				onClick={onApply}
			>
				{t.linkApply}
			</button>
			// 移除链接按钮
			<button
				type="button"
				className="rich-editor-link-action"
				// 点击移除
				onClick={onRemove}
			>
				{t.unlink}
			</button>
			// 取消按钮（幽灵样式）
			<button
				type="button"
				className="rich-editor-link-action ghost"
				// 点击关闭
				onClick={onClose}
			>
				{t.linkCancel}
			</button>
		</div>
	);
}

// 规范化链接地址：补全协议、去掉空值
function normalizeHref(raw: string): string {
	// 去除首尾空白
	const url = raw.trim();
	// 空字符串或只有协议前缀 → 返回空串（不设链）
	if (!url || url === 'https://' || url === 'http://') return '';
	// 没有协议前缀（不是以 字母+数字+.-+: 开头） → 自动补 https://
	if (!/^[a-z][a-z0-9+.-]*:/i.test(url)) return `https://${url}`;
	// 已有协议 → 直接返回
	return url;
}

// useLinkEditor Hook：链接编辑的状态管理
// 打开时即锁定目标选区（选区 / 词 / 整行），应用时只给目标加 mark
// 绝不把 URL 作为文本插入正文
export function useLinkEditor(editor: Editor | null) {
	// 链接草稿状态：null 表示未打开
	const [draft, setDraft] = useState<LinkDraft | null>(null);

	// 打开链接编辑器
	const open = useCallback(() => {
		// 编辑器不存在就返回
		if (!editor) return;
		// 解析目标范围
		const range = resolveLinkTarget(editor.state);
		// 获取当前光标位置已有的链接 href（用于编辑现有链接）
		const prev =
			(editor.getAttributes('link').href as string | undefined) ?? '';

		// 有目标范围时先选中，让用户看到将要加链接的范围
		if (range) {
			editor.chain().setTextSelection(range).run();
		}

		// 设置草稿状态
		setDraft({
			// 已有链接就显示原 href，没有就显示 https:// 前缀
			href: prev || 'https://',
			// 目标范围
			range,
		});
	// 依赖 editor 实例
	}, [editor]);

	// 关闭链接编辑器
	const close = useCallback(() => setDraft(null), []);

	// 应用链接
	const apply = useCallback(() => {
		// 编辑器或草稿不存在 → 不做任何事
		if (!editor || !draft) return;
		// 规范化 URL
		const href = normalizeHref(draft.href);

		// 没有目标范围（空行） → 直接关闭，不插入 URL 文本
		if (!draft.range) {
			setDraft(null);
			return;
		}

		// URL 为空 → 移除链接（而不是设置空链接）
		if (!href) {
			removeLinkInRange(editor, draft.range);
			setDraft(null);
			return;
		}

		// 正常情况：给目标范围设置链接
		applyLinkToRange(editor, draft.range, href);
		// 关闭草稿
		setDraft(null);
	// 依赖 draft 和 editor
	}, [draft, editor]);

	// 移除链接
	const remove = useCallback(() => {
		// 编辑器或草稿不存在 → 返回
		if (!editor || !draft) return;
		// 有范围就移除该范围的链接
		if (draft.range) removeLinkInRange(editor, draft.range);
		// 关闭草稿
		setDraft(null);
	// 依赖
	}, [draft, editor]);

	// 更新 href 输入值
	const setHref = useCallback((href: string) => {
		// 函数式更新：只改 href 字段
		setDraft((d) => (d ? { ...d, href } : d));
	}, []);

	// 返回所有状态和方法
	return { draft, open, close, apply, remove, setHref };
}
```

---

## 9. 选区气泡菜单（FormatBubble.tsx）

**来源**：`apps/remote-plugins/src/components/design/RichEditor/toolbar/FormatBubble.tsx`（共 68 行）

### 9.1 模块职责

用户选中文本后，在选区上方浮动显示的快捷格式菜单。只放最常用的行内格式按钮。

### 9.2 完整代码与逐行注释

```typescript
// 导入 Editor 类型
import type { Editor } from '@tiptap/react';
// 导入图标组件
import { Bold, Highlighter, Italic, Link2, Underline } from 'lucide-react';
// 导入 ReactNode 类型
import type { ReactNode } from 'react';
// 导入国际化类型（从父目录的 locale 导入，因为 FormatBubble.tsx 在 toolbar/ 目录下）
import type { RichEditorLocale } from '../locale';

// 组件 Props 类型
type Props = {
	// 编辑器实例
	editor: Editor;
	// 国际化字典
	locale: RichEditorLocale;
	// 打开链接表单的回调
	onOpenLink: () => void;
};

// 气泡菜单内部按钮组件（简化版，没有 active 态）
function Btn({
	title,
	onClick,
	children,
}: {
	// 按钮 title（tooltip）
	title: string;
	// 点击回调
	onClick: () => void;
	// 子元素（一般是图标）
	children: ReactNode;
}) {
	return (
		// 按钮元素
		<button
			type="button"
			// 复用工具栏按钮样式
			className="rich-editor-btn"
			// title 属性，悬停时显示提示
			title={title}
			// aria 标签，辅助技术使用
			aria-label={title}
			// 阻止鼠标按下默认行为：避免点击按钮时编辑器失焦
			onMouseDown={(e) => e.preventDefault()}
			// 点击事件
			onClick={onClick}
		>
			{children}
		</button>
	);
}

// 选区气泡菜单：常用行内格式
export function FormatBubble({ editor, locale: t, onOpenLink }: Props) {
	return (
		// 气泡菜单容器
		<div className="rich-editor-bubble" role="toolbar" aria-label="快捷格式">
			{/* 粗体按钮 */}
			<Btn
				title={t.bold}
				// 点击：聚焦 → 切换粗体 → 执行
				onClick={() => editor.chain().focus().toggleBold().run()}
			>
				<Bold size={14} />
			</Btn>
			{/* 斜体按钮 */}
			<Btn
				title={t.italic}
				onClick={() => editor.chain().focus().toggleItalic().run()}
			>
				<Italic size={14} />
			</Btn>
			{/* 下划线按钮 */}
			<Btn
				title={t.underline}
				onClick={() => editor.chain().focus().toggleUnderline().run()}
			>
				<Underline size={14} />
			</Btn>
			{/* 高亮按钮 */}
			<Btn
				title={t.highlight}
				onClick={() => editor.chain().focus().toggleHighlight().run()}
			>
				<Highlighter size={14} />
			</Btn>
			{/* 链接按钮 */}
			<Btn title={t.link} onClick={onOpenLink}>
				<Link2 size={14} />
			</Btn>
		</div>
	);
}
```

---

## 10. 自定义 Title 节点（title/TitleNode.ts）

**来源**：`apps/remote-plugins/src/components/design/RichEditor/title/TitleNode.ts`（共 175 行）

### 10.1 模块职责

这是整个编辑器最核心、技术含量最高的文件。定义了：
- **TitleNode**：自定义原子节点，作为笔记的固定标题
- **EMPTY_NOTE_DOC**：空笔记的文档结构（title + paragraph）
- **normalizeNoteContent**：内容归一化函数
- **getDocTitleText**：从文档中提取标题文本
- **indentEditor**：Tab 缩进逻辑
- **focusAfterTitle**：标题后跳转正文

### 10.2 设计要点

**为什么要用自定义 atom 节点而不是普通 heading？**
1. 标题必须**常驻首位**，不能被用户删除或移动
2. 标题用**原生 input** 编辑，比 contenteditable 更可控（IME、选中、placeholder）
3. 标题不参与正文的字数统计
4. 标题有自己独立的样式和装饰（标签图标）

**为什么用 atom 而不是 block？**
- atom 节点是「原子的」，不可再分，光标不能进入其内部
- 配合 `group: 'title'` 和自定义 Document，可以保证文档结构是 `title block+`
- 标题只能有一个，且永远在最前面

### 10.3 完整代码与逐行注释

```typescript
// 从 @tiptap/core 导入 Node 基类和 mergeAttributes 工具
import { mergeAttributes, Node } from '@tiptap/core';
// 导入 Editor 类型和 JSONContent 类型
import type { Editor, JSONContent } from '@tiptap/core';
// 从 ProseMirror state 导入 Plugin、PluginKey、TextSelection
import { Plugin, PluginKey, TextSelection } from '@tiptap/pm/state';
// 导入 GapCursor（间隙光标，用于块级节点之间的光标）
import { GapCursor } from '@tiptap/pm/gapcursor';
// 从 @tiptap/react 导入 ReactNodeViewRenderer（React 节点视图渲染器）
import { ReactNodeViewRenderer } from '@tiptap/react';
// 导入 TitleView React 组件
import TitleView from './Title';

// 空笔记的默认文档结构：必须有一个 title + 一段正文 paragraph
// 为什么要这样？因为如果文档只有一个 atom 节点（title），
// 光标会落在 atom 旁边的 GapCursor 上，看起来有光标但实际上输不进字
export const EMPTY_NOTE_DOC: JSONContent = {
	// 文档根节点类型
	type: 'doc',
	// 子节点数组
	content: [
		// 第一个节点：标题，value 属性为空字符串
		{ type: 'title', attrs: { value: '' } },
		// 第二个节点：空段落（保证有地方可以输入正文）
		{ type: 'paragraph' },
	],
};

// 内容归一化：空内容 → 合法的空笔记文档
// 处理三种空值情况：null/undefined、空字符串、空段落 HTML
export function normalizeNoteContent(
	// 输入内容：可以是 HTML 字符串、JSON 对象、空值
	content: string | JSONContent | undefined | null,
	// 返回类型：字符串或 JSON 对象（保证非空）
): string | JSONContent {
	// 如果是 null/undefined，或空字符串，或只有一个空段落
	if (content == null || content === '' || content === '<p></p>') {
		// 返回默认空笔记结构
		return EMPTY_NOTE_DOC;
	}
	// 否则原样返回
	return content;
}

/*
 * 笔记常驻标题节点：
 * - atom: 原子节点，不可再分，光标不能进入内部
 * - group: 'title'：自定义分组，配合 Document 保证结构合法
 * - 用原生 input 编辑（NodeView），而不是 contenteditable
 */
export const TitleNode = Node.create({
	// 节点名称，唯一标识
	name: 'title',

	// 节点所属的 group，用于 schema 约束
	// 自定义 'title' 组，这样 Document.content: 'title block+' 就能约束结构
	group: 'title',

	// 原子节点：不能被光标进入，作为一个整体存在
	atom: true,

	// 不可拖拽
	draggable: false,

	// 不可选中（不能用鼠标拖选整个标题节点）
	selectable: false,

	// 定义节点的属性（attrs）
	addAttributes() {
		return {
			// value 属性：存储标题文本
			value: {
				// 默认值为空字符串
				default: '',
				// 从 HTML 解析时如何取值
				parseHTML: (el) =>
					// 优先读 data-value 属性，其次读 textContent（兼容旧数据）
					(el as HTMLElement).getAttribute('data-value') ??
					(el as HTMLElement).textContent ??
					'',
				// 渲染成 HTML 时如何输出
				renderHTML: (attrs) =>
					// 有值就输出 data-value 属性，没值就不输出（减少冗余）
					attrs.value ? { 'data-value': attrs.value as string } : {},
			},
		};
	},

	// 从 HTML 解析时的匹配规则
	parseHTML() {
		// 匹配带 data-type="note-title" 的 div 元素
		return [{ tag: 'div[data-type="note-title"]' }];
	},

	// 渲染成 HTML 时的输出结构
	renderHTML({ HTMLAttributes, node }) {
		// 返回 ProseMirror 的 DOM 输出规范：[标签名, 属性对象, 内容]
		return [
			// 外层标签：div
			'div',
			// 合并默认属性和自定义属性
			mergeAttributes(HTMLAttributes, {
				// 标记类型，用于 parseHTML 识别
				'data-type': 'note-title',
				// 把 value 存到 data-value 上，便于解析和查看
				'data-value': node.attrs.value ?? '',
			}),
			// textContent 也输出一份，兼容无 JS 环境和旧版解析
			node.attrs.value ?? '',
		];
	},

	// 添加 NodeView：用 React 组件渲染这个节点
	addNodeView() {
		// stopEvent: () => true 表示标题内的所有事件都不交给 ProseMirror 处理
		// 这样标题 input 的输入、光标、选中完全由 React 控制，不和正文打架
		return ReactNodeViewRenderer(TitleView, {
			stopEvent: () => true,
		});
	},

	// 添加 ProseMirror 插件：保证文档结构始终合法
	addProseMirrorPlugins() {
		return [
			// 创建一个新的状态插件
			new Plugin({
				// 插件唯一 key
				key: new PluginKey('singleNoteTitle'),
				// 事务追加：每次 state 变化后，自动修正文档结构
				appendTransaction(transactions, _old, state) {
					// 如果没有任何事务改变了文档或选区，直接返回 null（不追加）
					if (!transactions.some((tr) => tr.docChanged || tr.selectionSet))
						return null;

					// 基于当前 state 创建一个新事务
					let tr = state.tr;
					// 标记是否有改动
					let changed = false;

					// --- 修正1：去掉多余的 title（保证只有一个） ---
					// 收集多余 title 的位置和大小
					const extras: { pos: number; nodeSize: number }[] = [];
					// 已见到的 title 计数
					let seen = 0;
					// 遍历文档所有直接子节点
					state.doc.forEach((node, offset) => {
						// 不是 title 节点就跳过
						if (node.type.name !== 'title') return;
						// 计数 +1
						seen += 1;
						// 第二个及以后的 title 都是多余的，记录下来
						if (seen > 1) extras.push({ pos: offset, nodeSize: node.nodeSize });
					});
					// 倒序删除多余的 title（倒序避免位置偏移）
					for (let i = extras.length - 1; i >= 0; i--) {
						// 解构位置和大小
						const { pos, nodeSize } = extras[i]!;
						// 用 paragraph 替换该节点（删除后补一个段落，避免空文档）
						tr.replaceWith(pos, pos + nodeSize, state.schema.nodes.paragraph.create());
						// 标记有改动
						changed = true;
					}

					// 如果改过了，用新文档；否则用原文档
					const doc = changed ? tr.doc : state.doc;
					// 取第一个子节点（应该是 title）
					const title = doc.firstChild;
					// --- 修正2：没有正文块时补一段 ---
					// 为什么？因为 atom 节点旁边的 GapCursor 看起来像有光标但输不进字
					if (title?.type.name === 'title' && doc.childCount < 2) {
						// 在 title 后面插入一个空段落
						tr = tr.insert(title.nodeSize, state.schema.nodes.paragraph.create());
						// 标记有改动
						changed = true;
					}

					// 下一个文档（改了就用 tr.doc，否则用原文档）
					const nextDoc = changed ? tr.doc : state.doc;
					// 下一个选区
					const sel = changed ? tr.selection : state.selection;
					// --- 修正3：纠正 GapCursor 选区 ---
					// GapCursor 是块与块之间的光标，看起来有光标但父节点不是 textblock，无法输入
					const isGap =
						// 显式的 GapCursor 实例
						sel instanceof GapCursor ||
						// 或者是空选区且父节点不是文本块（也是一种间隙光标状态）
						(sel.empty && !sel.$from.parent.isTextblock);
					// 如果是间隙光标，且文档第一个节点是 title
					if (isGap && nextDoc.firstChild?.type.name === 'title') {
						// 计算 title 之后第一个可输入位置
						// nodeSize 是整个 title 节点的大小，+1 是进入下一个节点内部的起始位置
						const pos = nextDoc.firstChild.nodeSize + 1;
						// 确保位置不超过文档大小
						if (pos <= nextDoc.content.size) {
							// 把选区设置到正文第一段内部
							tr = tr.setSelection(TextSelection.create(nextDoc, pos));
							// 标记有改动
							changed = true;
						}
					}

					// 有改动就返回事务，没改动返回 null
					return changed ? tr : null;
				},
			}),
		];
	},
});

// 默认导出
export default TitleNode;

// 从文档中提取标题文本，供笔记列表展示等场景使用
export function getDocTitleText(doc: {
	// 文档对象需要有 firstChild
	firstChild?: {
		// firstChild 的类型信息
		type: { name: string };
		// 属性字典
		attrs: Record<string, unknown>;
		// 文本内容
		textContent: string;
	} | null;
}): string {
	// 取第一个子节点
	const first = doc.firstChild;
	// 第一个节点不是 title → 返回空串
	if (first?.type.name !== 'title') return '';
	// 优先从 attrs.value 取（主要存储方式）
	const fromAttr = first.attrs.value;
	// 如果是字符串，trim 后返回
	if (typeof fromAttr === 'string') return fromAttr.trim();
	// 否则从 textContent 取（兼容性兜底）
	return first.textContent.trim();
}

// 正文 Tab 缩进逻辑：
// - 在列表里 → 下沉一级（sinkListItem）
// - 在任务列表里 → 下沉一级
// - 其他情况 → 插入制表符 \t
export function indentEditor(editor: Editor): boolean {
	// 在代码块里不处理，走代码块自己的 Tab 逻辑
	if (editor.isActive('codeBlock')) return false;
	// 普通列表：尝试下沉一级，成功就返回 true
	if (editor.commands.sinkListItem('listItem')) return true;
	// 任务列表：尝试下沉一级，成功就返回 true
	if (editor.commands.sinkListItem('taskItem')) return true;
	// 其他情况：插入一个制表符 \t
	return editor.commands.insertContent('\t');
}

// 标题 input 按 Enter / Tab 时：跳到正文末尾
export function focusAfterTitle(editor: Editor) {
	// 取文档第一个子节点
	const title = editor.state.doc.firstChild;
	// 第一个节点不是 title（异常情况）→ 直接 focus 到末尾
	if (!title || title.type.name !== 'title') {
		editor.commands.focus('end');
		return;
	}
	// title 节点之后的位置
	const after = title.nodeSize;
	// 该位置处的节点（应该是第一个正文段落）
	const next = editor.state.doc.nodeAt(after);
	// 如果没有下一个节点（理论上不会发生，因为插件会保证有正文）
	if (!next) {
		// 在 title 后插入一个段落，然后聚焦到末尾
		editor
			.chain()
			.insertContentAt(after, { type: 'paragraph' })
			.focus('end')
			.run();
		return;
	}
	// 正常情况：聚焦到编辑器末尾
	editor.commands.focus('end');
}
```

---

## 11. Title 节点视图组件（title/Title.tsx）

**来源**：`apps/remote-plugins/src/components/design/RichEditor/title/Title.tsx`（共 69 行）

### 11.1 模块职责

TitleNode 的 React NodeView 组件，用原生 `<input>` 编辑标题文本。

### 11.2 设计要点

**中文 IME 处理**：
- 用 `composing` ref 标记组字状态
- 组字期间只更新本地 state，不写 `updateAttributes`
- 避免受控重渲染把拼音一起提交进框

**为什么用原生 input 而不是 contenteditable？**
1. IME 更稳定（中文输入法在 contenteditable 里有各种问题）
2. placeholder 原生支持，不用自己写
3. maxLength 原生支持
4. 选中、光标行为完全可控
5. 可以用 `tabIndex={-1}` 排除在 Tab 序之外

### 11.3 完整代码与逐行注释

```typescript
// 从 @tiptap/react 导入 NodeViewProps（节点视图属性）和 NodeViewWrapper（节点视图包装器）
import { type NodeViewProps, NodeViewWrapper } from '@tiptap/react';
// 导入笔记本笔图标
import { NotebookPen } from 'lucide-react';
// 导入 React Hook
import { useEffect, useRef, useState } from 'react';
// 导入项目的 Input 组件
import { Input } from '@/components/ui';
// 从同目录的 TitleNode.ts 导入 focusAfterTitle 工具函数
// Title.tsx 和 TitleNode.ts 都在 title/ 目录下，所以用 ./TitleNode
import { focusAfterTitle } from './TitleNode';
// 从父目录的 locale 导入中文国际化字典
import { zhCN } from '../locale';

/**
 * 原生 input 编辑标题。
 * 中文 IME：组字期间不写 attrs，避免受控重渲染把拼音一起提交进框。
 */
export default function TitleView({
	// 当前节点（ProseMirror Node）
	node,
	// 更新节点属性的函数
	updateAttributes,
	// 编辑器实例
	editor,
}: NodeViewProps) {
	// IME 组字状态标记：true 表示正在输入中文拼音（还没确认）
	// 用 ref 而不用 state，因为不需要触发重渲染
	const composing = useRef(false);
	// 本地 state 存储输入框的值（用于受控输入）
	// 初始值从 node.attrs.value 读取
	const [value, setValue] = useState(String(node.attrs.value ?? ''));

	// 当外部 attrs.value 变化时同步到本地 state
	useEffect(() => {
		// 组字期间不更新，避免打断拼音输入
		if (composing.current) return;
		// 更新本地 state
		setValue(String(node.attrs.value ?? ''));
	// 依赖：node.attrs.value（外部变化时触发）
	}, [node.attrs.value]);

	// 提交函数：更新本地 state，如果不在组字中则同步到 ProseMirror
	const commit = (next: string) => {
		// 先更新本地 state，保证输入框显示正确
		setValue(next);
		// 只有不在组字期间才写 attrs，避免 IME 中间状态污染文档
		if (!composing.current) updateAttributes({ value: next });
	};

	return (
		// NodeViewWrapper 是 Tiptap 提供的节点视图包装器
		// 它会自动处理一些 ProseMirror 相关的 DOM 绑定
		<NodeViewWrapper
			// 渲染为 div 标签
			as="div"
			// 样式类：flex 布局，列方向，间距 2，下边距 2
			className="flex flex-col gap-2 mb-2"
			// 内容不可编辑（标题用原生 input，不用 contenteditable）
			contentEditable={false}
		>
			// 标题卡片容器：相对定位，flex 列布局，内边距，边框，背景色，圆角
			<div className="relative flex flex-col gap-2 p-3 pt-9 border border-theme/5 bg-theme/5 rounded-md">
				// 左上角标签：绝对定位，主题色背景，圆角，flex 布局，图标+文字
				<div className="absolute top-0 bg-theme/20 text-theme/80 rounded-tl-md rounded-br-md pl-3 py-3 left-0 w-25 h-6 flex items-center gap-2">
					// 笔记本笔图标，尺寸 4（16px）
					<NotebookPen className="size-4" />
					// 标签文字：笔记标题
					<span className="text-sm font-medium">笔记标题</span>
				</div>
				// 标题输入框
				<Input
					// 自定义样式：高度 48px，全宽，无内边距，大字号，无边框，透明背景
					className="h-12 size-full px-0 py-0 md:text-xl rounded-none border-0 bg-transparent pr-2 text-textcolor shadow-none placeholder:text-lg placeholder:text-textcolor/60 focus-visible:border-0 focus-visible:ring-0"
					// 当前值（受控）
					value={value}
					// 占位符文本（从国际化字典取）
					placeholder={zhCN.placeholderHeadingHint}
					// 最大长度 100 字符
					maxLength={100}
					// 不进 Tab 序，避免正文按 Tab 时焦点跳到标题
					tabIndex={-1}
					// 阻止鼠标按下事件冒泡：避免点击标题时 ProseMirror 改变选区
					onMouseDown={(e) => e.stopPropagation()}
					// IME 开始：标记组字中
					onCompositionStart={() => {
						composing.current = true;
					}}
					// IME 结束（确认输入）：标记组字结束，提交最终值
					onCompositionEnd={(e) => {
						composing.current = false;
						commit(e.currentTarget.value);
					}}
					// 输入变化：提交当前值
					onChange={(e) => commit(e.target.value)}
					// 键盘事件
					onKeyDown={(e) => {
						// 正在组字时不处理（避免拼音输入时误触发）
						if (e.nativeEvent.isComposing) return;
						// 按 Enter 或 Tab：跳到正文
						if (e.key === 'Enter' || e.key === 'Tab') {
							// 阻止默认行为（避免换行或焦点跳转）
							e.preventDefault();
							// 聚焦到正文
							focusAfterTitle(editor);
						}
					}}
				/>
			</div>
		</NodeViewWrapper>
	);
}
```

---

## 12. 扩展配置（extensions/index.ts）

**来源**：`apps/remote-plugins/src/components/design/RichEditor/extensions/index.ts`（共 139 行）

### 12.1 模块职责

组装所有 Tiptap 扩展，配置默认行为。包括：
- 自定义 Document（title + block+）
- 自定义 TitleNode
- 自定义 TabIndent
- StarterKit（基础功能）
- 代码块高亮（lowlight）
- 占位符
- 高亮
- 文本对齐
- 图片
- 图片上传
- 表格
- 任务列表
- 字符计数

### 12.2 设计要点

**可覆盖性**：
- 如果传了 `options.extensions`，直接用用户的，完全覆盖默认
- 否则用默认扩展，并支持 `extraExtensions` 追加

**为什么把 codeBlock 从 StarterKit 里关掉？**
因为要用 `@tiptap/extension-code-block-lowlight` 替代，它支持语法高亮。

### 12.3 完整代码与逐行注释

```typescript
// 导入 Extension 基类
import { Extension } from '@tiptap/core';
// 导入代码块扩展（带 lowlight 语法高亮）
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
// 导入 Document 扩展（文档根节点）
import Document from '@tiptap/extension-document';
// 导入高亮扩展
import Highlight from '@tiptap/extension-highlight';
// 导入图片扩展
import Image from '@tiptap/extension-image';
// 导入任务列表扩展
import { TaskItem, TaskList } from '@tiptap/extension-list';
// 导入占位符扩展
import { Placeholder } from '@tiptap/extension-placeholder';
// 导入表格扩展套件
import { TableKit } from '@tiptap/extension-table';
// 导入文本对齐扩展
import TextAlign from '@tiptap/extension-text-align';
// 导入字符计数扩展
import { CharacterCount } from '@tiptap/extensions';
// 导入 Extensions 类型
import type { Extensions } from '@tiptap/react';
// 导入 StarterKit（基础功能套件）
import StarterKit from '@tiptap/starter-kit';
// 导入 lowlight 的 common 语言包和创建函数
import { common, createLowlight } from 'lowlight';
// 从兄弟目录 image 导入图片上传扩展和工具函数
// 因为 extensions/index.ts 在 extensions/ 目录下，所以用 ../image 回到父级再进 image/
import { ImageUpload, fileToDataUrl } from '../image';
// 从兄弟目录 locale 导入中文国际化字典
import { zhCN } from '../locale';
// 从兄弟目录 title 导入 TitleNode 和 indentEditor
import { TitleNode, indentEditor } from '../title';
// 从兄弟目录 types 导入配置选项类型
import type { CreateExtensionsOptions } from '../types';

// 创建 lowlight 实例，加载 common 语言包（约 40 种常用语言）
const lowlight = createLowlight(common);

/*
 * TabIndent 扩展：自定义 Tab 键行为
 * - 列表中：下沉一级
 * - 正文中：插入制表符 \t
 * - 优先级 1000，确保比默认快捷键高
 */
const TabIndent = Extension.create({
	// 扩展名称
	name: 'tabIndent',
	// 高优先级，确保先匹配
	priority: 1000,
	// 键盘快捷键
	addKeyboardShortcuts() {
		return {
			// Tab 键
			Tab: ({ editor }) => {
				// 代码块里不处理，走代码块自己的 Tab 缩进
				if (editor.isActive('codeBlock')) return false;
				// 调用自定义缩进逻辑
				return indentEditor(editor);
			},
			// Shift+Tab 键（反向缩进）
			'Shift-Tab': ({ editor }) => {
				// 代码块里不处理
				if (editor.isActive('codeBlock')) return false;
				// 普通列表：尝试上提一级
				if (editor.commands.liftListItem('listItem')) return true;
				// 任务列表：尝试上提一级
				if (editor.commands.liftListItem('taskItem')) return true;
				// 其他情况也返回 true（不做任何事，但阻止默认焦点跳转）
				return true;
			},
		};
	},
});

/*
 * 自定义 Document：首位固定 title，其后至少一段正文
 * 避免仅有 atom 节点时 GapCursor 无法输入
 */
const CustomDocument = Document.extend({
	// 文档内容约束：一个 title，后跟至少一个 block 节点
	content: 'title block+',
});

/**
 * 组装默认扩展；业务可通过 extensions / extraExtensions 覆盖或追加
 */
export function createExtensions(
	// 配置选项
	options: CreateExtensionsOptions = {},
	// 返回扩展数组
): Extensions {
	// 如果传了自定义 extensions，直接使用（完全覆盖默认）
	if (options.extensions) return options.extensions;

	// 占位符文本：默认用中文的
	const placeholder = options.placeholder ?? zhCN.placeholder;
	// 图片 src 解析 ref：默认用 base64
	const resolveImageSrcRef = options.resolveImageSrcRef ?? {
		current: fileToDataUrl,
	};

	// 返回扩展数组
	return [
		// 自定义文档结构
		CustomDocument,
		// 自定义标题节点
		TitleNode,
		// 自定义 Tab 缩进
		TabIndent,
		// StarterKit 基础套件（标题、段落、粗体、斜体、列表、链接等）
		StarterKit.configure({
			// 关掉默认 document，用我们自定义的
			document: false,
			// 末尾节点：始终保证最后有一个段落（方便继续输入）
			trailingNode: {
				node: 'paragraph',
			},
			// 标题级别：支持 1-5 级
			heading: { levels: [1, 2, 3, 4, 5] },
			// 关掉默认 codeBlock，用带高亮的版本
			codeBlock: false,
			// 链接配置
			link: {
				// 点击链接不自动打开（避免误触）
				openOnClick: false,
				// 自动识别 URL 并转成链接
				autolink: true,
				// 默认协议：用户输入 example.com 时自动补 https://
				defaultProtocol: 'https',
				// 链接的 HTML 属性
				HTMLAttributes: {
					// 安全属性：防止新页面访问 window.opener
					rel: 'noopener noreferrer',
					// 在新标签页打开
					target: '_blank',
				},
			},
		}),
		// 代码块 + 语法高亮
		CodeBlockLowlight.configure({
			// lowlight 实例
			lowlight,
			// 默认语言
			defaultLanguage: 'javascript',
			// 启用 Tab 缩进
			enableTabIndentation: true,
			// Tab 大小 2 空格
			tabSize: 2,
			// 代码块的 HTML class（用于 hljs 样式识别）
			HTMLAttributes: { class: 'hljs' },
		}),
		// 占位符扩展
		Placeholder.configure({
			// 动态占位符：根据节点类型返回不同文本
			placeholder: ({ editor, node }) => {
				// title 节点用自己的 placeholder（input 原生的），这里返回空
				if (node.type.name === 'title') return '';
				// 标题节点：显示「标题 1」、「标题 2」等
				if (node.type.name === 'heading') {
					return `${zhCN.placeholderHeading} ${node.attrs.level}`;
				}
				// 避免 editor 未使用告警
				void editor;
				// 其他情况（主要是段落）：用默认占位符
				return placeholder;
			},
			// 空编辑器时的 class（用于样式区分）
			emptyEditorClass: 'is-editor-empty',
			// 空节点时的 class
			emptyNodeClass: 'is-empty',
			// 只在当前节点显示（不是所有空节点都显示）
			showOnlyCurrent: true,
			// 只在可编辑状态显示
			showOnlyWhenEditable: true,
		}),
		// 高亮扩展：支持多颜色
		Highlight.configure({ multicolor: true }),
		// 文本对齐扩展
		TextAlign.configure({
			// 支持的节点类型：标题和段落
			types: ['heading', 'paragraph'],
			// 支持的对齐方式：左、中、右、两端
			alignments: ['left', 'center', 'right', 'justify'],
		}),
		// 图片扩展
		Image.configure({
			// 不是行内图片，是块级
			inline: false,
			// 允许 base64 图片
			allowBase64: true,
			// 图片的 HTML class
			HTMLAttributes: { class: 'rich-editor-image' },
			// 调整大小配置
			resize: {
				// 启用调整大小
				enabled: true,
				// 始终保持宽高比
				alwaysPreserveAspectRatio: true,
			},
		}),
		// 自定义图片上传扩展（粘贴/拖放）
		ImageUpload.configure({ resolveSrcRef: resolveImageSrcRef }),
		// 表格套件
		TableKit.configure({
			// 表格可调整列宽
			table: { resizable: true },
		}),
		// 任务列表
		TaskList,
		// 任务项：支持嵌套
		TaskItem.configure({ nested: true }),
		// 字符计数
		CharacterCount.configure({
			// 最大长度限制，null 表示不限制
			limit: options.maxLength ?? null,
			// 字符计数：用 Intl.Segmenter 按字素（grapheme）计数
			// 这样中文每个字算 1，表情符号也算 1，更符合直觉
			textCounter: (text) =>
				[...new Intl.Segmenter('zh', { granularity: 'grapheme' }).segment(text)]
					.length,
			// 词计数：中文按字算，西文按词算
			wordCounter: (text) => {
				// 匹配所有 CJK 字符（中文、日文、韩文等）
				const cjk =
					text.match(/[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff]/g)?.length ?? 0;
				// 把 CJK 字符替换成空格，然后按空白分割，数西文单词数
				const latin = text
					.replace(/[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff]/g, ' ')
					.split(/\s+/)
					.filter(Boolean).length;
				// 合计：中文字数 + 西文单词数
				return cjk + latin;
			},
		}),
		// 额外扩展：展开追加
		...(options.extraExtensions ?? []),
	];
}
```

---

## 13. 主组件 RichEditor（index.tsx）

**来源**：`apps/remote-plugins/src/components/design/RichEditor/index.tsx`（共 245 行）

### 13.1 模块职责

整个富文本编辑器的**入口组件**，对外暴露 `RichEditor`。它把所有子模块（工具栏、气泡菜单、链接表单、编辑器主体、字数统计）组装起来，并管理编辑器生命周期。

### 13.2 核心设计模式

1. **受控 + 非受控混合模式**：
   - `defaultContent` 非受控（初始值）
   - `content` 受控（外部传入时同步）
   - 内部用 `useEditor` 管理状态

2. **ref 模式传递可变数据**：
   - `resolveImageSrcRef` 用 ref 存上传函数
   - 因为扩展只在创建时组装，用 ref 可以动态更新上传实现而不重建编辑器

3. **EditorContext.Provider**：
   - 把 editor 实例放到 Context 里
   - 子组件（如 Toolbar 里的按钮）可以通过 `useCurrentEditor()` 拿到实例

### 13.3 完整代码与逐行注释

```typescript
// 导入 Editor 类型
import type { Editor } from '@tiptap/react';
// 从 @tiptap/react 导入核心组件和 Hook
import {
	// 编辑器内容渲染组件
	EditorContent,
	// 编辑器上下文
	EditorContext,
	// 创建编辑器实例的 Hook
	useEditor,
	// 订阅编辑器状态的 Hook
	useEditorState,
} from '@tiptap/react';
// 导入气泡菜单组件
import { BubbleMenu } from '@tiptap/react/menus';
// 导入 React Hook
import { useEffect, useMemo, useRef } from 'react';
// 导入 classnames 工具
import { cn } from '@/lib/utils';
// 导入创建扩展的函数（从 extensions/ 目录的 index.ts 导出）
import { createExtensions } from './extensions';
// 导入气泡菜单组件（从 toolbar/ 目录的 index.ts 导出）
import { FormatBubble } from './toolbar';
// 导入文档工具函数（从 title/ 目录的 index.ts 导出）
import { getDocTitleText, normalizeNoteContent } from './title';
// 导入图片工具（从 image/ 目录的 index.ts 导出）
import { fileToDataUrl, type ResolveImageSrc } from './image';
// 导入链接表单和 Hook（从 link/ 目录的 index.ts 导出）
import { LinkForm, useLinkEditor } from './link';
// 导入国际化类型和中文默认值
import { type RichEditorLocale, zhCN } from './locale';
// 导入编辑器样式
import './styles.css';
// 导入工具栏组件（从 toolbar/ 目录的 index.ts 导出）
import { Toolbar } from './toolbar';
// 导入 Props 类型
import type { RichEditorProps } from './types';

// 合并国际化字典：默认中文 + 用户传入的部分覆盖
function mergeLocale(partial?: Partial<RichEditorLocale>): RichEditorLocale {
	// 先用 zhCN 作为默认，再用 partial 覆盖
	return { ...zhCN, ...partial };
}

// 字数统计组件：显示词数和字符数
function CharCount({
	// 编辑器实例
	editor,
	// 国际化字典
	locale,
	// 最大字符数限制
	maxLength,
}: {
	editor: Editor;
	locale: RichEditorLocale;
	maxLength?: number;
}) {
	// 用 useEditorState 订阅字符计数状态
	// selector 函数返回需要的数据，只有数据变化时才重渲染
	const count = useEditorState({
		// 关联的编辑器实例
		editor,
		// 选择器：从 state 中提取需要的数据
		selector: ({ editor: e }) => {
			// 获取 characterCount 扩展的 storage
			const storage = e.storage.characterCount as
				| { characters: () => number; words: () => number }
				| undefined;
			// 返回字符数和词数
			return {
				chars: storage?.characters() ?? 0,
				words: storage?.words() ?? 0,
			};
		},
	});

	// 是否超过最大长度限制
	const over = maxLength != null && count.chars >= maxLength;

	return (
		// 底部字数栏；超限时加 is-limit 类（红色警告）
		<div className={cn('rich-editor-footer', over && 'is-limit')}>
			// 左侧：词数
			<span>
				{count.words} {locale.words}
			</span>
			// 右侧：字符数 / 最大限制 · 超限提示
			<span>
				{count.chars}
				// 有最大限制时显示 / maxLength
				{maxLength != null ? ` / ${maxLength}` : ''} {locale.chars}
				// 超限时显示「已达上限」提示
				{over ? ` · ${locale.limitReached}` : ''}
			</span>
		</div>
	);
}

/**
 * TipTap 二次封装富文本编辑器。
 * - 默认中文 UI
 * - 内置 Formatting / 表格 / 本地图片(选图·粘贴·拖放) / 任务 / 字数 / RTL
 * - 通过 extraExtensions / toolbarExtra / onUploadImage 扩展
 */
export function RichEditor({
	// 受控内容（HTML 字符串或 JSON 对象）
	content,
	// 默认内容（非受控初始值）
	defaultContent = '',
	// 内容变化回调
	onChange,
	// 是否可编辑
	editable = true,
	// 是否自动聚焦
	autofocus = true,
	// 占位符文本
	placeholder,
	// 外层容器类名
	className,
	// 编辑器主体类名
	editorClassName,
	// 最大字符数
	maxLength,
	// 文本方向
	textDirection = 'auto',
	// 是否显示工具栏
	showToolbar = true,
	// 是否显示气泡菜单
	showBubbleMenu = true,
	// 是否显示字数统计
	showCharCount = true,
	// 国际化字典（部分覆盖）
	locale: localePartial,
	// 自定义扩展（完全覆盖默认）
	extensions,
	// 额外扩展（追加到默认后面）
	extraExtensions,
	// 工具栏额外按钮
	toolbarExtra,
	// 图片上传回调（返回 URL 或 Promise<URL>）
	onUploadImage,
	// 编辑器创建完成回调
	onCreate,
}: RichEditorProps) {
	// 合并国际化字典：用 useMemo 缓存，避免每次渲染都合并
	const locale = useMemo(() => mergeLocale(localePartial), [localePartial]);

	// 图片 src 解析函数的 ref
	// 为什么用 ref？因为扩展只在编辑器创建时组装一次
	// 如果直接把函数传进扩展，onUploadImage 变化时不会生效
	// 用 ref 的话，扩展里读 resolveSrcRef.current，永远是最新的
	const resolveImageSrcRef = useRef<ResolveImageSrc>(fileToDataUrl);
	// 每次渲染都更新 ref.current，确保始终是最新的
	resolveImageSrcRef.current = async (file) => {
		// 有上传回调就用回调
		if (onUploadImage) return onUploadImage(file);
		// 否则默认 base64
		return fileToDataUrl(file);
	};

	// 创建编辑器实例
	const editor = useEditor({
		// 不立即渲染：等 React 准备好再渲染，避免 SSR 问题
		immediatelyRender: false,
		// 扩展列表
		extensions: createExtensions({
			// 占位符
			placeholder: placeholder ?? locale.placeholder,
			// 最大长度
			maxLength,
			// 自定义扩展（覆盖默认）
			extensions,
			// 额外扩展（追加）
			extraExtensions,
			// 图片解析 ref
			resolveImageSrcRef,
		}),
		// 初始内容：归一化处理（空内容 → 默认空笔记结构）
		content: normalizeNoteContent(content ?? defaultContent),
		// 是否可编辑
		editable,
		// 是否自动聚焦
		autofocus,
		// 文本方向
		textDirection,
		// 编辑器属性
		editorProps: {
			attributes: {
				// 编辑器元素的 class
				class: cn('tiptap focus:outline-none', editorClassName),
				// 语言：中文
				lang: 'zh-CN',
			},
		},
		// 编辑器创建完成回调
		onCreate: ({ editor: e }) => {
			// 空文档时把选区放进正文首段
			// 避免落在 title atom 旁的 GapCursor（看起来有光标但输不进字）
			const title = e.state.doc.firstChild;
			// 第一个节点是 title
			if (title?.type.name === 'title') {
				// 计算 title 之后正文第一段的起始位置
				// nodeSize 是整个 title 节点的大小，+1 进入下一个节点内部
				const pos = title.nodeSize + 1;
				// 确保位置合法
				if (pos <= e.state.doc.content.size) {
					// 设置文本选区到正文第一段
					e.commands.setTextSelection(pos);
				}
			}
			// 调用用户的 onCreate 回调
			onCreate?.(e);
		},
		// 内容更新回调
		onUpdate: ({ editor: e }) => {
			// 调用 onChange，传出多种格式
			onChange?.({
				// HTML 格式
				html: e.getHTML(),
				// JSON 格式
				json: e.getJSON(),
				// 纯文本格式（段落之间用两个换行分隔）
				text: e.getText({ blockSeparator: '\n\n' }),
				// 标题文本
				title: getDocTitleText(e.state.doc),
			});
		},
	});

	// 链接编辑器 Hook：管理链接表单的打开/关闭/应用/移除
	const link = useLinkEditor(editor);

	// 监听 editable 变化，动态设置编辑器是否可编辑
	useEffect(() => {
		// 编辑器不存在就返回
		if (!editor) return;
		// 设置可编辑状态
		editor.setEditable(editable);
	// 依赖：editor 实例和 editable prop
	}, [editor, editable]);

	// 受控同步：仅在外部 content 与当前不一致时写入，避免打断输入
	useEffect(() => {
		// 编辑器不存在，或 content 是 undefined（非受控模式）→ 不处理
		if (!editor || content === undefined) return;
		// 下一个内容：统一转成字符串比较
		const next =
			typeof content === 'string' ? content : JSON.stringify(content);
		// 当前内容：根据 content 类型选择 HTML 或 JSON
		const current =
			typeof content === 'string'
				? editor.getHTML()
				: JSON.stringify(editor.getJSON());
		// 内容相同就不更新（避免打断用户输入）
		if (next === current) return;
		// 内容不同才设置
		// emitUpdate: false 表示不触发 onUpdate，避免循环
		editor.commands.setContent(normalizeNoteContent(content), {
			emitUpdate: false,
		});
	// 依赖：editor 实例和 content prop
	}, [editor, content]);

	// EditorContext 的 value：用 useMemo 缓存，避免不必要的重渲染
	const ctx = useMemo(() => ({ editor }), [editor]);

	// 编辑器还没创建好 → 返回 null
	if (!editor) return null;

	// 工具栏额外内容：如果是函数，传 editor 调用；否则直接用
	const extra =
		typeof toolbarExtra === 'function' ? toolbarExtra(editor) : toolbarExtra;

	// 渲染编辑器
	return (
		// 提供 EditorContext，子组件可以通过 useCurrentEditor() 获取实例
		<EditorContext.Provider value={ctx}>
			// 外层容器
			<div className={cn('rich-editor', className)} lang="zh-CN">
				// 工具栏（可配置是否显示）
				{showToolbar && (
					<Toolbar
						editor={editor}
						locale={locale}
						onUploadImage={onUploadImage}
						onOpenLink={link.open}
						linkOpen={!!link.draft}
						extra={extra}
					/>
				)}

				// 链接表单：有草稿时显示（在工具栏下面，编辑器上面）
				{link.draft && (
					<LinkForm
						locale={locale}
						href={link.draft.href}
						onHrefChange={link.setHref}
						onApply={link.apply}
						onRemove={link.remove}
						onClose={link.close}
						// 没有目标范围（空行）时显示提示
						hint={link.draft.range ? undefined : locale.linkEmptyHint}
					/>
				)}

				// 气泡菜单（选中文本时浮动显示）
				{showBubbleMenu && (
					<BubbleMenu
						editor={editor}
						// 配置：在上方，偏移 8px，空间不够时翻转
						options={{ placement: 'top', offset: 8, flip: true }}
						// 控制是否显示
						shouldShow={({ editor: e, state }) => {
							// 链接表单打开时不显示气泡菜单
							if (link.draft) return false;
							// 空选区（没有选中文本）不显示
							const { empty } = state.selection;
							// 非空选区 + 不是图片 + 不是代码块 → 显示
							return !empty && !e.isActive('image') && !e.isActive('codeBlock');
						}}
					>
						// 气泡菜单内容：格式化按钮
						<FormatBubble
							editor={editor}
							locale={locale}
							onOpenLink={link.open}
						/>
					</BubbleMenu>
				)}

				// 编辑器主体区域
				<div className="rich-editor-body">
					// 编辑器内容渲染组件
					<EditorContent editor={editor} spellCheck="false" />
				</div>

				// 字数统计（可配置是否显示）
				{showCharCount && (
					<CharCount editor={editor} locale={locale} maxLength={maxLength} />
				)}
			</div>
		</EditorContext.Provider>
	);
}

// 默认导出
export default RichEditor;
// 重新导出 Editor 类型，方便外部使用
export type { Editor } from '@tiptap/react';
// 重新导出 createExtensions，方便外部自定义扩展
export { createExtensions } from './extensions';
// 重新导出 Title 节点相关（从 title/ 目录导出）
export {
	TitleNode,
	getDocTitleText,
	EMPTY_NOTE_DOC,
	normalizeNoteContent,
} from './title';
// 重新导出图片相关类型和函数（从 image/ 目录导出）
export type { ResolveImageSrc } from './image';
export { fileToDataUrl, pickImageFile } from './image';
// 重新导出代码语言相关（从 code/ 目录导出）
export type { CodeLanguage } from './code';
export { CODE_LANGUAGES } from './code';
// 重新导出国际化相关
export type { RichEditorLocale } from './locale';
export { zhCN } from './locale';
// 重新导出工具栏 Btn 组件（从 toolbar/ 目录导出）
export { Btn } from './toolbar';
// 重新导出类型定义
export type {
	CreateExtensionsOptions,
	RichEditorChangePayload,
	RichEditorContent,
	RichEditorProps,
	TextDirection,
} from './types';
```

---

## 14. 工具栏（toolbar/Toolbar.tsx）概览

**来源**：`apps/remote-plugins/src/components/design/RichEditor/toolbar/Toolbar.tsx`

### 14.1 模块职责

编辑器顶部工具栏，提供：
- 文本格式（粗体、斜体、下划线、删除线、高亮）
- 标题级别（H1-H5）
- 列表（有序、无序、任务列表）
- 对齐方式（左、中、右、两端）
- 插入（链接、图片、表格、代码块、引用、分割线）
- 撤销/重做
- 溢出处理（空间不够时收起按钮到「更多」下拉菜单）
- 额外按钮扩展位

### 14.2 核心设计

**工具栏按钮的通用模式**（每个按钮大致遵循这个结构）：

```
Btn 组件：
  - active: editor.isActive(...)
  - disabled: !editor.can().doSomething()
  - onClick: () => editor.chain().focus().command().run()
  - onMouseDown: preventDefault 避免失焦
  - title / aria-label
```

**响应式溢出处理**：
- 用 `useOverflow` 或 `ResizeObserver` 检测容器宽度
- 放不下的按钮收起到「更多」下拉菜单（DropdownMenu）

> 注：因篇幅限制，Toolbar.tsx 的 300+ 行完整代码未在此展开。其核心逻辑是按分组渲染一系列 `Btn`，每组用 `ToolbarDivider` 分隔，最后用响应式溢出处理动态显示。

---

## 15. 样式文件（styles.css）概览

**来源**：`apps/remote-plugins/src/components/design/RichEditor/styles.css`（根目录，未移动）

### 15.1 样式架构

编辑器样式遵循「BEM + CSS 变量」模式，主要类名：

| 类名 | 说明 |
|------|------|
| `.rich-editor` | 外层容器 |
| `.rich-editor-toolbar` | 工具栏容器 |
| `.rich-editor-btn` | 工具栏按钮 |
| `.rich-editor-btn.is-active` | 激活状态的按钮 |
| `.rich-editor-body` | 编辑器主体区域 |
| `.rich-editor-footer` | 底部字数栏 |
| `.rich-editor-bubble` | 气泡菜单 |
| `.rich-editor-link-form` | 链接表单 |
| `.rich-editor-image` | 图片 |
| `.tiptap` | Tiptap 编辑器主体 |

### 15.2 关键样式要点

1. **编辑器 min-height**：保证即使内容很少，编辑器也有一定高度，方便点击
2. **ProseMirror 内容样式**：h1-h6、p、ul、ol、blockquote、code、pre 等的默认样式
3. **图片可调整大小**：`.ProseMirror img[data-resizable]` 的手柄样式
4. **代码块 hljs 主题**：配合 lowlight 使用的语法高亮主题
5. **表格样式**：边框、选中态、调整列宽的手柄
6. **任务列表样式**：checkbox 美化、已完成任务删除线

---

## 16. 整体运行时调用链

### 16.1 用户输入文字的完整流程

```
用户在编辑器输入文字
    ↓
ProseMirror 捕获 input 事件
    ↓
创建 Transaction（事务）
    ↓
经过所有 Plugin 的 appendTransaction
    ├→ TitleNode 插件：检查是否有多余 title、是否缺正文、是否 GapCursor
    ├→ CharacterCount 插件：更新字数统计
    └→ 其他插件...
    ↓
应用到 EditorState
    ↓
触发 onUpdate 回调
    ↓
RichEditor 的 onChange 被调用
    ├→ 传出 html / json / text / title
    └→ 父组件更新 state（如果是受控模式）
```

### 16.2 用户点击工具栏按钮的完整流程

```
用户点击「粗体」按钮
    ↓
onMouseDown 触发 e.preventDefault()（防止编辑器失焦）
    ↓
onClick 触发
    ↓
editor.chain().focus().toggleBold().run()
    ├→ focus()：确保编辑器获得焦点
    ├→ toggleBold()：切换粗体 mark
    └→ run()：执行命令链
    ↓
创建 Transaction，更新 EditorState
    ↓
触发 onUpdate
    ↓
UI 更新（按钮的 active 态、内容样式）
```

### 16.3 粘贴图片的完整流程

```
用户 Ctrl+V 粘贴一张图片
    ↓
ProseMirror 捕获 paste 事件
    ↓
ImageUpload 插件的 handlePaste 被调用
    ├→ clipboardImageFiles() 提取剪贴板中的图片文件
    ├→ 没有图片 → return false（走默认粘贴）
    └→ 有图片 → e.preventDefault() + insertImages()
        ↓
    insertImages() 遍历文件
        ├→ resolveSrcRef.current(file) 解析 src
        │   └→ 有 onUploadImage → 上传到 CDN
        │   └→ 没有 → fileToDataUrl 转 base64
        └→ editor.chain().focus().setImage({ src, alt }).run()
            ↓
    插入图片节点到文档
            ↓
    触发 onUpdate
```

---

## 17. 文件结构总览（当前最新）

### 17.1 design 组件总目录

```
design/
├── index.ts               # 统一导出入口（RichEditor + NotePreview）
├── RichEditor/            # 富文本编辑器主组件
│   ├── index.tsx          # 主组件（入口）
│   ├── types.ts           # 类型定义
│   ├── locale.ts          # 国际化字典
│   ├── styles.css         # 样式文件
│   ├── code/              # 代码块相关
│   │   ├── index.ts       # 导出
│   │   └── languages.ts   # 代码语言列表
│   ├── extensions/        # 扩展配置
│   │   └── index.ts       # createExtensions + TabIndent + CustomDocument
│   ├── image/             # 图片相关
│   │   ├── index.ts       # 导出
│   │   ├── image.ts       # 图片工具函数
│   │   └── ImageUpload.ts # 图片上传扩展（粘贴/拖放）
│   ├── link/              # 链接相关
│   │   ├── index.ts       # 导出
│   │   ├── linkRange.ts   # 链接范围解析
│   │   └── LinkForm.tsx   # 链接表单 + useLinkEditor Hook
│   ├── title/             # 标题节点相关
│   │   ├── index.ts       # 导出
│   │   ├── Title.tsx      # 标题节点视图（React 组件）
│   │   └── TitleNode.ts   # TitleNode 自定义节点 + 工具函数
│   └── toolbar/           # 工具栏相关
│       ├── index.ts       # 导出
│       ├── Toolbar.tsx    # 工具栏主组件
│       └── FormatBubble.tsx # 选区气泡菜单
└── NotePreview/           # 笔记预览组件
    └── index.tsx          # NotePreview + stripNoteTitleHtml
```

### 17.2 设计原则：按功能域分目录

重构后遵循「按功能域分目录」的原则：

- **每个功能域一个目录**：title、image、link、toolbar、code、extensions
- **目录内有 index.ts**：作为该模块的统一出口
- **主组件只从子目录导入**：`import { createExtensions } from './extensions'`
- **外部使用从 design/index.ts 导入**：`import { RichEditor, NotePreview } from '@/components/design'`

**重构前后对比**：

| 重构前（扁平） | 重构后（分域） |
|----------------|----------------|
| `createNode.ts` | `title/TitleNode.ts` |
| `Title.tsx` | `title/Title.tsx` |
| `image.ts` | `image/image.ts` |
| `ImageUpload.ts` | `image/ImageUpload.ts` |
| `linkRange.ts` | `link/linkRange.ts` |
| `LinkForm.tsx` | `link/LinkForm.tsx` |
| `Toolbar.tsx` | `toolbar/Toolbar.tsx` |
| `FormatBubble.tsx` | `toolbar/FormatBubble.tsx` |
| `languages.ts` | `code/languages.ts` |
| `extensions.ts` | `extensions/index.ts` |

---

## 18. 笔记预览组件 NotePreview

**来源**：`apps/remote-plugins/src/components/design/NotePreview/index.tsx`（共 110 行）

### 18.1 模块职责

笔记的**只读预览**组件，用于：
- 笔记列表中点击某条笔记后，在右侧查看详情
- 顶栏显示标题（替代编辑器 toolbar）
- 正文用 `dangerouslySetInnerHTML` 渲染 Tiptap 产出的 HTML
- 自动剥离 HTML 中的 title 节点，避免与顶栏标题重复
- 支持 `headerExtra`、`footer`、`meta`、`children` 等扩展插槽

### 18.2 核心设计

**为什么需要 NotePreview？**
1. **编辑器 vs 预览分离**：编辑时是 RichEditor（可编辑，有工具栏），查看时是 NotePreview（只读，轻量）
2. **标题不重复**：编辑器里 title 是文档的第一个节点，预览时标题在顶栏，所以要从 HTML 里剥离 title 节点
3. **可扩展**：headerExtra / footer / meta / children 四个扩展位，适配不同场景

**安全考虑**：
- 用 `dangerouslySetInnerHTML` 渲染本机 TipTap 产出的 HTML
- 注释明确说明「预览信任本机 TipTap 产出的 HTML」
- 如果是外部用户输入的 HTML，应先做 XSS 清洗

### 18.3 完整代码与逐行注释

```typescript
// 导入 ReactNode 类型
import type { ReactNode } from 'react';
// 导入 ScrollArea 组件
import { ScrollArea } from '@/components/ui/scroll-area';
// 导入 classnames 工具
import { cn } from '@/lib/utils';
// 导入 RichEditor 的样式（预览也复用编辑器的内容样式）
import '../RichEditor/styles.css';

// NotePreview 组件的 Props 类型
export type NotePreviewProps = {
	// 顶栏标题（替代编辑器 toolbar）
	title: string;
	// TipTap HTML；会去掉笔记 title 节点，避免与顶栏重复
	html?: string;
	// 顶栏标题旁/下方的次要信息（时间、标签等）
	meta?: ReactNode;
	// 顶栏右侧操作（返回编辑、列表开关等）
	headerExtra?: ReactNode;
	// 自定义正文；传入时忽略 html
	children?: ReactNode;
	// 底部插槽
	footer?: ReactNode;
	// 外层容器类名
	className?: string;
	// 正文区域类名
	bodyClassName?: string;
	// 空内容时的提示文本
	emptyText?: string;
};

// 去掉文档内嵌的 title NodeView，正文只渲染 block 内容
// 为什么要剥离？因为预览时标题在顶栏显示，正文里再显示一遍就重复了
export function stripNoteTitleHtml(html: string): string {
	// 空 HTML 直接返回空串
	if (!html) return '';
	// 兜底：DOMParser 不可用时（比如 SSR），用正则替换
	if (typeof DOMParser === 'undefined') {
		return html.replace(
			// 匹配 <div data-type="note-title">...</div>
			/<div[^>]*data-type=["']note-title["'][^>]*>[\s\S]*?<\/div>/i,
			// 替换成空串
			'',
		);
	}
	// 用 DOMParser 解析 HTML（更可靠，不会误伤嵌套结构）
	const doc = new DOMParser().parseFromString(html, 'text/html');
	// 查找所有带 data-type="note-title" 的元素
	for (const el of doc.querySelectorAll('[data-type="note-title"]')) {
		// 移除该元素
		el.remove();
	}
	// 返回 body 的 innerHTML
	return doc.body.innerHTML;
}

/**
 * 笔记只读预览：顶栏标题 + 可滚动正文。
 * - 默认吃 title/html，够用
 * - children / headerExtra / footer / meta 可扩展
 */
export function NotePreview({
	// 解构 props
	title,
	html,
	meta,
	headerExtra,
	children,
	footer,
	className,
	bodyClassName,
	// 空内容默认提示
	emptyText = '暂无内容',
}: NotePreviewProps) {
	// 处理后的正文 HTML（已剥离 title 节点）
	const bodyHtml = html ? stripNoteTitleHtml(html) : '';
	// 是否有正文内容：有 children 或者 HTML 去掉标签后还有文字
	const hasBody =
		children != null || bodyHtml.replace(/<[^>]+>/g, '').trim().length > 0;

	return (
		// 外层容器：flex 列布局，占满高度，隐藏溢出
		<div
			className={cn(
				'note-preview flex h-full min-h-0 min-w-0 flex-col overflow-hidden',
				className,
			)}
		>
			// 顶栏：固定高度 40px，底部边框，flex 横向布局
			<header className="h-10 border-theme/10 bg-theme-background flex shrink-0 items-center gap-3 border-b pl-4 pr-2 py-2.5">
				// 左侧：标题 + meta，flex-1 占满剩余空间
				<div className="min-w-0 flex-1">
					// 标题：截断显示，字体稍大，加粗
					<h1 className="text-textcolor truncate text-base font-semibold leading-snug">
						{title.trim() || '无标题笔记'}
					</h1>
					// 有 meta 时显示：次要文字，小字号
					{meta ? (
						<div className="text-textcolor/45 mt-0.5 truncate text-xs">
							{meta}
						</div>
					) : null}
				</div>
				// 右侧操作区：headerExtra 插槽
				{headerExtra ? (
					<div className="flex shrink-0 items-center gap-0.5">
						{headerExtra}
					</div>
				) : null}
			</header>

			// 正文滚动区域：占满剩余空间
			<ScrollArea className="min-h-0 flex-1" viewportClassName="h-full">
				// 正文容器：复用 rich-editor-body 样式，保证内容样式一致
				<div
					className={cn(
						'rich-editor-body note-preview-body min-h-full',
						bodyClassName,
					)}
				>
					// 有 children 时优先渲染 children（自定义内容）
					{children != null ? (
						children
					// 否则有正文内容时渲染 HTML
					) : hasBody ? (
						// 用 tiptap 类名包裹，保证内容样式与编辑器一致
						// 注意：预览信任本机 TipTap 产出的 HTML
						<div
							className="tiptap text-sm"
							// 危险设置 innerHTML（但这里是本机 TipTap 产出的，可信）
							dangerouslySetInnerHTML={{ __html: bodyHtml }}
						/>
					// 空内容显示提示
					) : (
						<p className="text-textcolor/45 text-sm">{emptyText}</p>
					)}
				</div>
			</ScrollArea>

			// 底部插槽：有 footer 时显示
			{footer ? <div className="shrink-0">{footer}</div> : null}
		</div>
	);
}

// 默认导出
export default NotePreview;
```

---

## 19. 主应用分栏布局（LearningNotesApp）

**来源**：`apps/remote-plugins/src/views/learning-notes/index.tsx`（约 160 行）

### 19.1 模块职责

学习笔记插件的主应用组件，集成了：
- **左侧编辑区**：RichEditor 富文本编辑器
- **右侧列表区**：笔记列表（可折叠）
- **预览模式**：点击列表项后，左侧切换为 NotePreview 预览
- **resizable 分栏**：左右面板宽度可拖拽调整
- **状态管理**：草稿、笔记列表、列表开关、当前预览

### 19.2 核心设计

**布局模式**：

```
┌─────────────────────────────────────────┐
│  编辑器工具栏  [保存][列表]             │  ← toolbarExtra 注入
├──────────────────┬──────────────────────┤
│                  │                      │
│   编辑 / 预览    │      笔记列表        │
│   (左栏)         │      (右栏)          │
│                  │                      │
│                  │                      │
└──────────────────┴──────────────────────┘
```

**三种视图状态**：

1. **只有编辑器**（列表关闭）：左栏 100% 宽度
2. **编辑器 + 列表**（列表打开）：左 58% / 右 42%
3. **预览 + 列表**（点击列表项）：左栏切换为 NotePreview

**关键交互设计**：
- **列表开关按钮在编辑器工具栏上**：通过 `toolbarExtra` prop 注入
- **预览时保留编辑器挂载**：用 `hidden` 类隐藏，不是条件渲染，避免草稿丢失
- **点击列表项切换为预览**：左侧显示 NotePreview，顶栏有「返回编辑」按钮
- **resizable 分栏**：用 `react-resizable-panels` 实现

### 19.3 核心代码片段详解

```typescript
// 主应用组件
export default function LearningNotesApp({ api }: HostBridgeProps) {
	// 草稿状态：html 是富文本 HTML，text 是纯文本，title 是标题
	const [draft, setDraft] = useState({ html: '', text: '', title: '' });
	// 列表是否打开
	const [listOpen, setListOpen] = useState(false);
	// 当前预览的笔记；null 表示在编辑模式
	const [preview, setPreview] = useState<Note | null>(null);
	// 笔记列表
	const [notes, setNotes] = useState<Note[]>(() => [
		{
			id: 'seed',
			title: '示例笔记',
			html: '<p>示例：今天复习了 present perfect 与过去时的区别</p>',
			at: Date.now() - 60_000,
		},
	]);
```

**列表切换按钮（注入工具栏）**：

```typescript
// 工具栏额外按钮：保存 + 列表开关
const toolbarExtra = (editor: Editor) => {
	void editor; // editor 参数是为了类型兼容，这里没用到
	return (
		<div className="rich-editor-toolbar-group">
			// 保存按钮
			<Btn title="保存笔记" onClick={(e) => onSubmit(e as MouseEvent)}>
				<Save size={15} />
			</Btn>
			// 列表开关按钮
			{listToggleBtn()}
		</div>
	);
};
```

**分栏布局**：

```typescript
<ResizablePanelGroup
	id="learning-notes-split"
	orientation="horizontal" // 水平分栏（左右）
	className="h-full min-h-0 min-w-0 flex-1"
>
	// 左栏：编辑器 / 预览
	<ResizablePanel
		id="learning-notes-editor"
		// 列表打开时默认 58%，关闭时 100%
		defaultSize={listOpen ? 58 : 100}
		minSize={30}
		className="min-h-0 min-w-0"
	>
		<div className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden">
			// 编辑器：预览时用 hidden 隐藏（保留挂载，草稿不丢）
			<div
				className={cn(
					'flex h-full min-h-0 flex-1 flex-col overflow-hidden',
					preview && 'hidden',
				)}
			>
				<RichEditor ... />
			</div>
			// 预览组件：有 preview 时显示
			{preview ? (
				<NotePreview
					title={preview.title}
					html={preview.html}
					headerExtra={
						<>
							// 返回编辑按钮
							<Btn title="返回编辑" onClick={backToEdit}>
								<PenLine size={15} />
							</Btn>
							// 列表开关按钮（预览时也能切列表）
							{listToggleBtn()}
						</>
					}
				/>
			) : null}
		</div>
	</ResizablePanel>

	// 右栏：笔记列表（只有 listOpen 时才渲染）
	{listOpen ? (
		<>
			<ResizableHandle withHandle className="w-0" />
			<ResizablePanel
				id="learning-notes-list"
				defaultSize={42}
				minSize={0}
				className="min-h-0 min-w-0"
			>
				<aside className="border-theme/10 flex h-full min-h-0 min-w-0 flex-col overflow-hidden border-l">
					// 列表标题
					<div className="text-textcolor/80 mb-2 flex h-10 shrink-0 items-center border-b border-theme/10 px-3.5 font-medium tracking-wide">
						笔记列表
					</div>
					// 可滚动的列表
					<ScrollArea ...>
						<div className="flex flex-col gap-2.5 pb-2">
							{sorted.map((n) => {
								const active = preview?.id === n.id;
								return (
									// 点击切换预览
									<button onClick={() => setPreview(n)} ...>
										<div className="text-textcolor truncate text-sm font-semibold">
											{n.title}
										</div>
										<div className="text-textcolor/45 mt-1.5 text-xs">
											{new Date(n.at).toLocaleString()}
										</div>
									</button>
								);
							})}
						</div>
					</ScrollArea>
				</aside>
			</ResizablePanel>
		</>
	) : null}
</ResizablePanelGroup>
```

---

## 20. 统一导出入口（design/index.ts）

**来源**：`apps/remote-plugins/src/components/design/index.ts`（共 20 行）

### 20.1 模块职责

design 组件库的**统一出口**，外部使用时只需要从 `@/components/design` 导入，不需要知道内部目录结构。

### 20.2 完整代码与逐行注释

```typescript
// 重新导出 RichEditor 的所有类型
export type {
	CodeLanguage,
	CreateExtensionsOptions,
	RichEditorChangePayload,
	RichEditorContent,
	RichEditorLocale,
	RichEditorProps,
	TextDirection,
} from './RichEditor';

// 重新导出 RichEditor 的值（函数、组件、常量）
export {
	CODE_LANGUAGES,
	createExtensions,
	getDocTitleText,
	RichEditor as default, // 默认导出是 RichEditor
	RichEditor,
	TitleNode,
	zhCN,
} from './RichEditor';

// 重新导出 NotePreview 的类型
export type { NotePreviewProps } from './NotePreview';

// 重新导出 NotePreview 组件和工具函数
export { NotePreview, stripNoteTitleHtml } from './NotePreview';
```

### 20.3 使用方式

```typescript
// 外部使用（推荐）
import { RichEditor, NotePreview } from '@/components/design';

// 而不是（不推荐，耦合内部结构）
import { RichEditor } from '@/components/design/RichEditor';
import { NotePreview } from '@/components/design/NotePreview';
```

---

## 21. 总结（更新版）

### 21.1 核心技术栈

- **Tiptap 3.x**：基于 ProseMirror 的 React 富文本编辑器框架
- **ProseMirror**：底层文档模型和事务系统
- **React**：UI 组件化
- **lowlight**：代码块语法高亮
- **lucide-react**：图标库
- **react-resizable-panels**：左右分栏可拖拽调整
- **@radix-ui/react-dropdown-menu**：工具栏下拉菜单
- **@radix-ui/react-scroll-area**：滚动区域

### 21.2 关键设计决策

| 决策 | 原因 |
|------|------|
| 自定义 Title atom 节点 | 标题常驻首位、不可删除、用原生 input 编辑 |
| 用 ref 存上传函数 | 扩展只创建一次，ref 可动态更新 |
| 链接表单不用 window.prompt | Tauri 桌面端兼容性 + 样式统一 |
| 中文 IME 组字期间不写 attrs | 避免受控重渲染把拼音提交进文档 |
| appendTransaction 保证文档结构合法 | 防止多余 title、缺正文、GapCursor |
| 空文档必须有 title + paragraph | 避免 GapCursor 无法输入的问题 |
| 字符计数用 Intl.Segmenter | 中文按字素计数更准确 |
| 按功能域分目录 | 模块边界清晰，便于维护和扩展 |
| 预览时编辑器 hidden 而非卸载 | 保留草稿状态，返回编辑不丢失 |
| NotePreview 剥离 title 节点 | 避免预览时标题重复显示 |

### 21.3 扩展方式

1. **添加新的格式化按钮**：修改 `toolbar/Toolbar.tsx`，加一个 `Btn`
2. **添加自定义节点**：参考 `title/TitleNode.ts` 的模式
3. **添加自定义 Mark**：参考 Tiptap 官方扩展文档，通过 `extraExtensions` 传入
4. **替换图片上传**：传 `onUploadImage` prop，返回 CDN URL
5. **完全自定义扩展**：传 `extensions` prop，覆盖所有默认扩展
6. **扩展 design 组件库**：在 `design/` 下加新目录，在 `design/index.ts` 导出

---

（文档完 · 已更新至最新代码结构）

---

（若与仓库最新源码不一致，以源码为准）
