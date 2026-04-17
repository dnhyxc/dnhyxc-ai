# 剪贴板：Monaco 显式绑定 + Tauri 普通输入框

## 背景

Tauri WebView 内系统级复制/粘贴对 **Monaco** 与普通 **`<input>` / `<textarea>`** 常不可靠。若在 `document` 上用 **`getSelection()`** 统一劫持 **Cmd+C**，又会破坏 Monaco（选区在模型内）。

## 现行方案（三层）

### 1. 不再使用「全 document + getSelection」的旧 `clipboard` 键盘函数

避免与富编辑器冲突；不再导出该处理器。

### 2. Monaco：`onMount` 中 `addCommand` 绑定 C / X / V

`apps/frontend/src/components/design/Monaco/index.tsx`：用模型选区 + `copyToClipboard` / `pasteFromClipboard`（Tauri 走插件）。

**无选区剪切整行（Cmd/Ctrl + X）**：与 VS Code 一致的光标行删除范围（`rangeForCutWhenCursorOnly`）见 **`docs/monaco-cut-line-without-selection-cmd-x.md`**。

### 3. Tauri：仅对普通 `input` / `textarea` 注册窄范围快捷键

`apps/frontend/src/utils/clipboard.ts` 导出 **`attachTauriPlainFieldClipboardShortcuts()`**，在 `router` 的 `useEffect` 中挂载：

- **Cmd/Ctrl+A**：`select()` 全选。
- **Cmd/Ctrl+C**：`selectionStart` / `selectionEnd` 切片 + `writeClipText`。
- **Cmd/Ctrl+X**：同上复制后删区并派发 `input`（只读/禁用跳过）。
- **Cmd/Ctrl+V**：`readClipText` 后插入并派发 `input`（只读跳过）。
- **Cmd/Ctrl+Z**：**不拦截**，保留 WebView 原生撤销。
- **跳过**：`.monaco-editor` / `.monaco-diff-editor` / `.cm-editor` / `native-edit-context` / `textarea.inputarea`（Monaco）。
- **受控 Input**：通过 **`HTMLInputElement.prototype` 的 `value` setter** 写值并派发 **`InputEvent('input', …)`**，与 React 受控组件兼容。

非 Tauri 环境该函数为空操作，**浏览器**仍使用原生快捷键。

## 相关文件

| 文件 | 说明 |
|------|------|
| `apps/frontend/src/router/index.tsx` | 调用 `attachTauriPlainFieldClipboardShortcuts`，卸载时 detach |
| `apps/frontend/src/utils/clipboard.ts` | `copyToClipboard`、`pasteFromClipboard`、Tauri 普通字段快捷键 |
| `apps/frontend/src/components/design/Monaco/index.tsx` | Monaco C/X/V；无选区 X 整行见 `docs/monaco-cut-line-without-selection-cmd-x.md` |
| `apps/frontend/src/components/ui/input.tsx` | 无逻辑变更；在 Tauri 下由上述快捷键处理 |
