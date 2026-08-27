# sync/

跨窗消息**基础设施**（BroadcastChannel + Tauri 全局 emit），不直接注入 bridge。

## 文件

| 文件 | 说明 |
|------|------|
| `hostSyncBus.ts` | `createHostPluginSyncBus`：封装 kit 的 `createPluginSyncBus` + Tauri transport |

## 新插件接入 sync

1. 在本目录工厂上建插件 bus（见 `modules/learningNotes/syncBus.ts`）
2. 定义消息联合类型（须含 `type` 字段）
3. 在 `hostApi` 或插件 SDK 中 publish / subscribe

```ts
import { createHostPluginSyncBus } from '@/federation';

const bus = createHostPluginSyncBus<MyMsg>({
  channel: 'dnhyxc-my-plugin-sync-v1',
  windowIdKey: 'dnhyxc_my_plugin_window_id',
});
```

## 双通道行为

- **Web / 同进程**：BroadcastChannel + 本窗同步 dispatch
- **Tauri 多 WebView**：额外 `onEmit` / `onListen` 全局事件（BC 常不通）

## 关联

- kit 原语 → `packages/federation-kit/src/host-api/pluginSyncBus.ts`
- 示例实现 → [`../modules/learningNotes/syncBus.ts`](../modules/learningNotes/syncBus.ts)
