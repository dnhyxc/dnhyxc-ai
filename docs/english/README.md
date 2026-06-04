# 英语学习

路径：`apps/frontend/src/views/english-learning/`、`apps/backend/src/services/english-learning/`、`agent/`。

## 入口与总览

| 文档 | 说明 |
|------|------|
| [english-learning-impl-overview.md](./english-learning-impl-overview.md) | 产品能力总览 |
| [english-learning-backend-implementation.md](./english-learning-backend-implementation.md) | 后端模块总览 |
| [english-learning-master-agent-web-search-to-llm.md](./english-learning-master-agent-web-search-to-llm.md) | 主 Agent 与联网 |

## 词包 / 流式 / 会话

| 文档 | 说明 |
|------|------|
| [english-learning-pack-sse.md](./english-learning-pack-sse.md) | 词包 SSE |
| [english-pack-stream-store.md](./english-pack-stream-store.md) | 流式状态跨路由 |
| [english-learning-pack-session-storage.md](./english-learning-pack-session-storage.md) | Session/Item 存储模型 |
| [english-learning-pack-session-items.md](./english-learning-pack-session-items.md) | 结果页分页 |
| [english-learning-pack-history-ux.md](./english-learning-pack-history-ux.md) | 历史 UX |

## 收藏 / 资源库 / 导入

| 文档 | 说明 |
|------|------|
| [english-learning-library-import.md](./english-learning-library-import.md) | 资源库导入 |
| [english-learning-json-import.md](./english-learning-json-import.md) | JSON 导入 |
| [classic-quotes-library-import.md](./classic-quotes-library-import.md) | 经典句库 |
| [vocab-favorite-status-query.md](./vocab-favorite-status-query.md) | 收藏状态查询 |
| [english-learning-favorites-drawer.md](./english-learning-favorites-drawer.md) | 收藏抽屉 |
| [english-favorites-docx-export.md](./english-favorites-docx-export.md) | 导出 DOCX |

## 练习

| 文档 | 说明 |
|------|------|
| [practice-review-srs.md](./practice-review-srs.md) | **今日复习（SRS）**、侧栏整合、复习设置页入口、随机分页补足 |
| [practice-summary-ui.md](./practice-summary-ui.md) | 听写/拼写练习与结算页 UI、作答明细、统计条 |
| [practice-session-hint.md](./practice-session-hint.md) | 单题练习「提示」：听写释义/音标、拼写音标、固定高度无滚动 |
| [practice-session-controls.md](./practice-session-controls.md) | 两档答错、再试连播、软揭示布局、音波动画、播放钮 |
| [practice-wrong-panel-shortcuts.md](./practice-wrong-panel-shortcuts.md) | **答错/揭示面板 UI**、播放单次/三连播策略、顶栏快捷键 ? 菜单 |
| [practice-reveal-playback-continuity.md](./practice-reveal-playback-continuity.md) | 软揭示 → 完整揭示**播放不中断**（共用 Session `playing` / `playWord`） |
| [practice-keyboard-previous.md](./practice-keyboard-previous.md) | **Shift+空格** 播放、**上一题** 与方向键 **↑←→↓** 重映射 |
| [practice-entry-navigation.md](./practice-entry-navigation.md) | 多入口（资源库列表/历史抽屉）、设置页词数、返回导航 |
| [vocabulary-mistakes-and-shared-ui.md](./vocabulary-mistakes-and-shared-ui.md) | **单词**错题集、练习入口组件 `EnglishPracticeEntry`、单词卡片统一 |
| [classic-practice-and-mistakes.md](./classic-practice-and-mistakes.md) | **经典句**练习、`contentKind=classic`、语句错题集、判分与 batch 更新错拼 |

| 说明 | 路径 |
|------|------|
| 听写 / 拼写 | `/english-learning/practice`；`contentKind=vocab`（默认）或 `classic`；设置页总量显示「词」/「句」 |
| 错题集（单词/语句） | `/english-learning/mistakes?kind=vocab\|classic`；顶栏 Tab + 底栏练习；`/mistakes/classic` 会 replace |

## UI / 目录约定

| 文档 | 说明 |
|------|------|
| [english-module-folder-layout.md](./english-module-folder-layout.md) | **模块目录**：`components/`、`reference/`、`favorites`/`pack`/`library`/`sections` 分域；顶栏单行截断 |

## TTS / UI / 其它专题

- TTS：[english-tts-playback.md](./english-tts-playback.md)、[english-tts-cache-consistency.md](./english-tts-cache-consistency.md)
- 列表/UI：[english-learning-list-network-retry.md](./english-learning-list-network-retry.md)、[english-learning-vocab-ui-refactor.md](./english-learning-vocab-ui-refactor.md)
- 完整列表：`ls docs/english/*.md`

LLM 工厂与设置见 [../llm/README.md](../llm/README.md)。

上级：[../README.md](../README.md)
