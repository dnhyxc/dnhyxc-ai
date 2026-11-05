# @dnhyxc-ai/richtext-kit

面向应用侧的 TipTap **富文本编辑 + 静态 HTML 预览** 工具包（含长文窗口化）。对偶于 [`@dnhyxc-ai/markdown-kit`](../markdown-kit)（Markdown→HTML）。

参考实现：`micro-apps/dnhyxc-ai-plugins` 学习笔记。下文示例从该应用与本包 [`demo/`](./demo/) 提炼，已改为可直接拷贝的独立代码（风格对齐 TipTap / shadcn 一类成熟组件文档）。

---

## 安装

```bash
pnpm add @dnhyxc-ai/richtext-kit
# 或
npm install @dnhyxc-ai/richtext-kit
```

- **peer**：`react` / `react-dom` **>= 18**
- TipTap、lowlight、lucide-react、radix-ui 等为包 **dependencies**，一般无需在应用里重复安装

发布 tarball 含 **`prepack` 构建**；从 **git / workspace** 安装请先构建：

```bash
pnpm --filter @dnhyxc-ai/richtext-kit run build
```

---

## 条件导出

| 子路径                               | 说明                                                                               |
| ------------------------------------ | ---------------------------------------------------------------------------------- |
| `@dnhyxc-ai/richtext-kit`            | `RichEditor`、`Btn`、`createExtensions`、`zhCN` / `enUS`、`getDocTitleText`、slots |
| `@dnhyxc-ai/richtext-kit/preview`    | `NotePreview`、`preparePreviewBody`、`useNoteImagePreview`                         |
| `@dnhyxc-ai/richtext-kit/windowed`   | `LargeRichEditor`、`WindowedNotePreview`、`isLargeNoteHtml`、`LARGE_MIN_BLOCKS`    |
| `@dnhyxc-ai/richtext-kit/styles.css` | 编辑 + 预览样式（含 `--rtk-*` / `--theme-*` 变量）                                 |

`package.json` 中 CSS 标了 **`sideEffects`**：请通过 `styles.css` 引入样式，勿指望只靠 tree-shaking 得到完整排版。

---

## 能力一览

| 能力           | 用法要点                                                               |
| -------------- | ---------------------------------------------------------------------- |
| 短文编辑       | `RichEditor`：`defaultContent` / `content` + `onChange` / `onCreate`   |
| 短文预览       | `NotePreview` + `html`                                                 |
| 长文编辑       | `isLargeNoteHtml` 为真时用 `LargeRichEditor` + `onReady(editor, save)` |
| 长文预览       | `NotePreview` 的 `children={<WindowedNotePreview html={…} />}`         |
| 图片           | `onUploadImage(file) => url`；不传则本地 data URL                      |
| 文案           | `locale={zhCN}` / `enUS`，或 `richEditorLocaleOf('zh-CN')`             |
| 工具栏业务按钮 | `toolbarExtra` + 包内 `Btn`                                            |
| Host UI        | `slots={{ ScrollArea, Button, Input, ImagePreview }}`                  |
| 正文滚动       | 内置 Radix/shadcn `ScrollArea`（`data-slot="scroll-area-viewport"`）   |

---

## 可运行 Demo

```bash
pnpm --filter @dnhyxc-ai/richtext-kit build
pnpm --filter @dnhyxc-ai/richtext-kit-demo dev
# 或：cd packages/richtext-kit && pnpm demo
```

`http://localhost:5179`。源码 [`demo/`](./demo/)。

版本用仓库根目录 **Changesets**（`pnpm changeset`），测试：

```bash
pnpm --filter @dnhyxc-ai/richtext-kit test
```

---

## 快速开始：短文编辑 + 预览

与学习笔记短文路径一致：**样式 + `RichEditor`（非受控初始内容）+ `NotePreview`**。

```tsx
import { useState } from "react";
import { RichEditor, zhCN } from "@dnhyxc-ai/richtext-kit";
import { NotePreview } from "@dnhyxc-ai/richtext-kit/preview";
import "@dnhyxc-ai/richtext-kit/styles.css";

export function NotePane() {
	const [html, setHtml] = useState("<p></p>");
	const [title, setTitle] = useState("");

	return (
		<div style={{ display: "flex", height: "100%", minHeight: 0 }}>
			<RichEditor
				defaultContent={html}
				locale={zhCN}
				placeholder="开始记录…"
				showCharCount={false}
				autofocus="end"
				className="flex h-full min-h-0 flex-1 flex-col overflow-hidden"
				editorClassName="min-h-[6rem]"
				onUploadImage={async (file) => URL.createObjectURL(file)}
				onChange={(p) => {
					setHtml(p.html);
					setTitle(p.title);
				}}
			/>
			<NotePreview title={title || "无标题"} html={html} />
		</div>
	);
}
```

要点：

- 必须 **`import '@dnhyxc-ai/richtext-kit/styles.css'`**，否则工具栏 / 标题卡 / 下拉菜单无完整样式。
- 父级需是 **定高 flex 列**（`height: 100%; min-height: 0`），正文才由内部 `ScrollArea` 滚动。
- 短文用 **`defaultContent` + `onCreate` / `onChange`**；需要受控回写时用 **`content`**（仅外部与当前 HTML 不一致时才会 `setContent`）。

---

## 样式与主题 token

一键引入：

```ts
import "@dnhyxc-ai/richtext-kit/styles.css";
```

宿主可覆盖 CSS 变量（与产品 `--theme-*` 对齐）：

```css
:root {
	--theme-color: #14b8a6;
	--theme-background: #fff;
	--theme-textcolor: #111827;
	--theme-border: #e5e7eb;
	--rtk-accent: var(--theme-color);
	--rtk-bg: var(--theme-background);
	--rtk-text: var(--theme-textcolor);
	--rtk-border: var(--theme-border);
}
```

工具栏高度固定 **40px**（`h-10`），与学习笔记 / `NotePreview` 顶栏一致，不依赖宿主是否扫描 Tailwind。

---

## `RichEditor` Props

| Prop              | 类型                                        | 默认               | 说明                                                          |
| ----------------- | ------------------------------------------- | ------------------ | ------------------------------------------------------------- |
| `content`         | `string \| JSONContent`                     | —                  | 受控 HTML / JSON                                              |
| `defaultContent`  | 同上                                        | `''`               | 非受控初值                                                    |
| `onChange`        | `(p: { html, text, title, json? }) => void` | —                  | 正文或标题变化                                                |
| `onCreate`        | `(editor: Editor) => void`                  | —                  | 实例就绪（可 `editor.getHTML()`）                             |
| `onUploadImage`   | `(file: File) => Promise<string>`           | data URL           | 工具栏 / 粘贴 / 拖放                                          |
| `locale`          | `Partial<RichEditorLocale>`                 | `zhCN`             | 工具栏与占位文案                                              |
| `placeholder`     | `string`                                    | locale.placeholder | 空段占位                                                      |
| `showToolbar`     | `boolean`                                   | `true`             |                                                               |
| `showBubbleMenu`  | `boolean`                                   | `true`             | 选区气泡                                                      |
| `showCharCount`   | `boolean`                                   | `true`             | 底栏字数；学习笔记关                                          |
| `showTitle`       | `boolean`                                   | `true`             | 文档首位 title 节点                                           |
| `toolbarExtra`    | `ReactNode \| (editor) => ReactNode`        | —                  | 工具栏右侧业务按钮                                            |
| `slots`           | `Partial<RichTextKitSlots>`                 | 包内默认           | 注入 Host ScrollArea 等                                       |
| `className`       | `string`                                    | —                  | 根节点；建议 `h-full min-h-0 flex-1 flex-col overflow-hidden` |
| `editorClassName` | `string`                                    | —                  | ProseMirror 根 class                                          |

---

## 工具栏业务按钮 + locale

与学习笔记一致：用包内 **`Btn`** 塞进 **`toolbarExtra`**，文案用 **`zhCN` / `enUS`**。

```tsx
import { Btn, RichEditor, enUS, zhCN } from "@dnhyxc-ai/richtext-kit";
import { Eye, Save } from "lucide-react";

<RichEditor
	defaultContent={html}
	locale={lang === "en" ? enUS : zhCN}
	showCharCount={false}
	toolbarExtra={
		<>
			<Btn title="保存" onClick={onSave} className="relative">
				<Save size={15} />
				{dirty ? (
					<span className="pointer-events-none absolute top-0 right-0 size-2 rounded-full bg-orange-500" />
				) : null}
			</Btn>
			<Btn title="预览" onClick={onPreview}>
				<Eye size={15} />
			</Btn>
		</>
	}
	onCreate={(editor) => {
		editorRef.current = editor;
	}}
	onChange={() => setDirty(true)}
/>;
```

应用 locale 映射：

```ts
import { richEditorLocaleOf } from "@dnhyxc-ai/richtext-kit";

const locale = richEditorLocaleOf(appLocale); // 'zh-CN' | 'en-US'
```

读取标题（与 `onChange` 的 `title` 同源）：

```ts
import { getDocTitleText } from "@dnhyxc-ai/richtext-kit";

const title = getDocTitleText(editor.state.doc).trim();
```

---

## 图片上传

工具栏插图、粘贴、拖放都走 **`onUploadImage`**，须返回可给 `<img src>` 用的 URL。

```tsx
async function upload(file: File) {
	const fd = new FormData();
	fd.append("file", file);
	const res = await fetch("/api/upload", { method: "POST", body: fd });
	const { url } = await res.json();
	return url as string;
}

<RichEditor onUploadImage={upload} />;
```

本地 / 桌面端可退回 Object URL 或包内 `fileToDataUrl`。

---

## 长文：窗口化编辑 + 预览

块数 ≥ **`LARGE_MIN_BLOCKS`（80）** 或 HTML 体积过大时走窗口化，避免全文 DOM 拖垮侧栏滚动。与学习笔记相同分支：

```tsx
import { useRef, useState } from "react";
import { RichEditor, zhCN, type Editor } from "@dnhyxc-ai/richtext-kit";
import { NotePreview } from "@dnhyxc-ai/richtext-kit/preview";
import {
	isLargeNoteHtml,
	LargeRichEditor,
	WindowedNotePreview,
	type LargeNoteSaveApi,
} from "@dnhyxc-ai/richtext-kit/windowed";
import "@dnhyxc-ai/richtext-kit/styles.css";

export function AdaptiveNote({ initialHtml }: { initialHtml: string }) {
	const editorRef = useRef<Editor | null>(null);
	const saveRef = useRef<LargeNoteSaveApi | null>(null);
	const [html, setHtml] = useState(initialHtml);
	const large = isLargeNoteHtml(initialHtml);

	const snapshot = () => {
		if (saveRef.current) {
			return {
				title: saveRef.current.getTitle(),
				html: saveRef.current.getHTML(),
			};
		}
		const e = editorRef.current;
		if (!e || e.isDestroyed) return { title: "", html };
		return { title: /* getDocTitleText */ "", html: e.getHTML() };
	};

	if (large) {
		return (
			<LargeRichEditor
				defaultContent={initialHtml}
				locale={zhCN}
				onUploadImage={async (file) => URL.createObjectURL(file)}
				onReady={(editor, save) => {
					editorRef.current = editor;
					saveRef.current = save;
				}}
				onChange={() => setHtml(saveRef.current?.getHTML() ?? html)}
				className="flex h-full min-h-0 flex-1 flex-col overflow-hidden"
				editorClassName="min-h-[6rem]"
			/>
		);
	}

	return (
		<RichEditor
			defaultContent={initialHtml}
			locale={zhCN}
			showCharCount={false}
			autofocus="end"
			onCreate={(e) => {
				editorRef.current = e;
				saveRef.current = null;
			}}
			onChange={(p) => setHtml(p.html)}
			className="flex h-full min-h-0 flex-1 flex-col overflow-hidden"
			editorClassName="min-h-[6rem]"
		/>
	);
}

export function AdaptivePreview({
	title,
	html,
}: {
	title: string;
	html: string;
}) {
	if (isLargeNoteHtml(html)) {
		return (
			<NotePreview title={title}>
				<WindowedNotePreview html={html} />
			</NotePreview>
		);
	}
	return <NotePreview title={title} html={html} />;
}
```

`LargeRichEditor` 要点：

- 只用 **`defaultContent`**（非受控窗口），换篇请 **`key`** remount。
- 持久化读 **`save.getHTML()` / `getText()` / `getTitle()`**，不要对窗口内 `editor.getHTML()` 当全文。
- 兼容旧名 `LargeNoteEditor` / `WindowedPreviewBody` 已 **deprecated**，请用上表名称。

---

## Host UI（slots）

默认 ScrollArea 为 **Radix/shadcn**（`radix-ui` 的 `ScrollArea`，Viewport + Thumb）；Button / Input / 简易灯箱仍为薄实现。插件 Host 可注入自家组件（须保留 **`data-slot="scroll-area-viewport"`**，便于长文滚窗找视口）：

```tsx
import { RichEditor, type RichTextKitSlots } from '@dnhyxc-ai/richtext-kit';

const slots: Partial<RichTextKitSlots> = {
  ScrollArea: HostScrollArea,
  Button: HostButton,
  Input: HostInput,
  ImagePreview: HostImagePreview,
};

<RichEditor slots={slots} defaultContent={html} />
<NotePreview slots={slots} title="预览" html={html} />
```

也可包一层 `RichTextKitProvider`，子树共用 slots。

---

## Vite

```ts
// vite.config.ts
export default defineConfig({
	optimizeDeps: {
		include: ["@dnhyxc-ai/richtext-kit", "@tiptap/react"],
	},
});
```

升级包后若出现绑定找不到，清理 `node_modules/.vite` 后加 `--force`。

---

## 与 markdown-kit 的分工

| 包                        | 文档形态                           | 典型入口                                      |
| ------------------------- | ---------------------------------- | --------------------------------------------- |
| `@dnhyxc-ai/richtext-kit` | TipTap HTML（笔记标题节点 + 正文） | `RichEditor` / `NotePreview`                  |
| `@dnhyxc-ai/markdown-kit` | Markdown 字符串 → HTML             | `MarkdownParser` + `useMermaidInMarkdownRoot` |

不要把 Markdown 源直接塞进 `RichEditor`；先在业务侧选定一种存储格式。

---

## License

以发布该包时所附根仓库许可证为准。
