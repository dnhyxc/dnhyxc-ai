# Monaco 剪贴板：全局劫持已移除 + 编辑器内显式绑定

## 问题

在 Monaco 中无法复制选区，或无法粘贴（Tauri WebView / 部分环境下系统默认快捷键不可靠）。

## 已废弃的做法

在 `document` 上监听 `keydown`，对 Cmd/Ctrl+C 使用 `preventDefault` + `window.getSelection()` 会与 Monaco 冲突（选区在模型与隐藏 textarea 上，`getSelection()` 常为空）。

## 现行方案（两层）

### 1. 不再注册全局剪贴板 `keydown`

`apps/frontend/src/router/index.tsx` **不**再 `addEventListener('keydown', clipboard)`。

`apps/frontend/src/utils/clipboard.ts` 仅导出 **`copyToClipboard` / `pasteFromClipboard`**（内部在 Tauri 下走 **clipboard 插件**，浏览器走 `navigator.clipboard`），供按钮或编辑器显式调用。

### 2. Monaco `onMount` 中绑定 Cmd/Ctrl+C / X / V

在 `apps/frontend/src/components/design/Monaco/index.tsx` 的 `handleEditorMount` 中：

- **复制**：从 `editor.getModel()` + `getSelections()` 取文本（空选区时复制**当前行**），再 `copyToClipboard`。
- **剪切**：只读时忽略；否则复制后 `executeEdits` 清空各选区。
- **粘贴**：只读或 IME 合成中忽略；否则 `pasteFromClipboard` 后对每个选区 `executeEdits` 写入（多光标时每处插入相同剪贴板内容）。

这样不依赖 WebView 是否把系统复制事件传到隐藏 textarea，**与 Tauri 插件剪贴板一致**。

## 相关文件

| 文件 | 说明 |
|------|------|
| `apps/frontend/src/router/index.tsx` | 无全局剪贴板 keydown |
| `apps/frontend/src/utils/clipboard.ts` | `copyToClipboard` / `pasteFromClipboard` |
| `apps/frontend/src/components/design/Monaco/index.tsx` | `addCommand` 绑定 C / X / V |
