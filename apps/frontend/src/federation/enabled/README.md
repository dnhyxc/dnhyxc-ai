# enabled/

**账号维度**的插件上架偏好（用户勾选了哪些插件可用），与 registry 里的全局 `enabled` 字段配合。

## 职责

- 从后端拉取当前用户的插件上架 ID 列表
- 提供 `getPluginEnabledPref` / `setPluginEnabledPref` 给 federation `enabledStore`
- 未就绪前返回 false，避免误显示「已下架」（见 `arePluginEnabledPrefsReady`）

## 主要导出

| 符号 | 说明 |
|------|------|
| `getPluginEnabledPref(id)` | 该插件对此账号是否上架 |
| `setPluginEnabledPref(id, on)` | 切换并同步后端 |
| `ensurePluginEnabledPrefsLoaded` | App 启动时预拉 |
| `arePluginEnabledPrefsReady` | 偏好是否已加载 |
| `prefetchPluginEnabledPrefs` | 提前拉取 |

## 常用

```tsx
import { usePluginEnabled, ensurePluginEnabledPrefsLoaded } from '@/federation';

const enabled = usePluginEnabled('learningNotes');
```

## 关联

- Registry 全局开关 → [`../registry/`](../registry/README.md)
- UI 门闩 → [`../host/PluginHostPage.tsx`](../host/PluginHostPage.tsx)
