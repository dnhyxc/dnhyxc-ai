# richtext-kit React Demo

只演示 **编辑器 / 预览**（对齐 `learning-notes` 用法与 UI），不做整页笔记列表壳。

| 场景     | 组件                                                                                     |
| -------- | ---------------------------------------------------------------------------------------- |
| 短文编辑 | `RichEditor`（`defaultContent` + `onCreate` + `showCharCount={false}` + `toolbarExtra`） |
| 长文编辑 | `LargeRichEditor` + `isLargeNoteHtml`                                                    |
| 短文预览 | `NotePreview` + `html`                                                                   |
| 长文预览 | `NotePreview` + `children={<WindowedNotePreview />}`                                     |

## 运行

```bash
pnpm --filter @dnhyxc-ai/richtext-kit build
pnpm --filter @dnhyxc-ai/richtext-kit-demo dev
# 或：cd packages/richtext-kit && pnpm demo
```

`http://localhost:5179`
