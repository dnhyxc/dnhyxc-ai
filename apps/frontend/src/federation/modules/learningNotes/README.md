# modules/learningNotes/

学习笔记插件的 `api.modules.learningNotes` 与跨窗 sync 通道。

## 职责

- Popout 窗口身份、关窗前钩子（`registerBeforeClose`）
- 跨窗 sync 发布/订阅（主窗 ↔ 独立窗）
- 权限门闩：`modules:learningNotes`（registry 须声明）

## 文件

| 文件 | 说明 |
|------|------|
| `hostApi.ts` | `createLearningNotesModulesApi`；`sync.*` / `openPopoutWindow` |
| `syncBus.ts` | BC + Tauri 双通道；类型 `LearningNotesSyncMessage` |

## Host 侧

- Popout 关窗 → `runLearningNotesBeforeCloseHandlers`（[`usePopoutCloseSave`](../../../views/englishLearning/notes/usePopoutCloseSave.ts)）

## 插件侧（推荐）

```ts
import { connectLearningNotes } from '@dnhyxc-ai/plugin-host-sdk';

export function activate(api) {
  const sync = connectLearningNotes(api, storeBinding);
  return () => sync?.dispose();
}
```

## 关联

- sync 基础设施 → [`../../sync/`](../../sync/README.md)
- Popout 路由与壳 → `views/englishLearning/notes/`
