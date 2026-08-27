# capabilities/

注入 `createFederation({ capabilities })` 的**通用** Host 能力，经 bridge 的 `api.ui.*` 暴露给所有插件。

## 文件

| 文件 | bridge | 权限 |
|------|--------|------|
| `appFullscreen.ts` | `api.ui.setAppFullscreen` | `ui:toast` |
| `pickLocalFiles.ts` | `api.ui.pickLocalFiles` | `ui:toast` |

## 说明

- **appFullscreen**：应用级影院态 + Tauri/Web 系统全屏；Layout / `PluginPageShell` 订阅显隐
- **pickLocalFiles**：Tauri 系统对话框 / Web 隐藏 input；返回 `path` + 可播放 `src`

## 常用

插件内（需 registry 声明 `ui:toast`）：

```ts
await api.ui?.setAppFullscreen?.(true);
const files = await api.ui?.pickLocalFiles?.({ accept: '.epub', multiple: false });
```

## 关联

- 装配入口 → [`../runtime/`](../runtime/README.md)
- 插件专属模块 → [`../modules/`](../modules/README.md)
