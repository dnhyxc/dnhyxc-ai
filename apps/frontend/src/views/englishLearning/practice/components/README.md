# 英语练习 — 组件目录

页面编排见上级：`Session.tsx`、`Setup.tsx`、`Summary.tsx`、`index.tsx`。

## 目录

| 目录 | 用途 |
|------|------|
| `shell/` | 页面壳、卡片、分段选择、快捷键菜单 |
| `session/` | 单题卡：字段网格、叠层壳、软揭示、错题底栏、紧凑布局 |
| `prompt/` | 作答题干：听写 `DictationPromptBody`、拼写 `SpellingPromptBody`、共享播放控件 |
| `reveal/` | 完整揭示：`RevealedPanelInner`、`revealedDetailRows` |
| `summary/` | 结算统计、错题列表、操作按钮 |

## 单题三阶段

1. **作答** — `SessionPromptPanel` + `prompt`（听写 / 拼写）
2. **软揭示** — `SoftWrongStage` + `HintFieldRows`
3. **完整揭示** — `RevealedPanelInner` + `revealedDetailRows`

## Import

- 布局常量：`'./constants'`（`PRACTICE_PAGE_CONTENT_CLASS`、`SESSION_CARD_H` 等）
- 壳组件：`'./components/shell'`
- 作答题干：`'./components/prompt'`
- 揭示：`'./components/reveal'`
- 结算：`'./components/summary'`
