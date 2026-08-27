# registry/

插件清单（`plugins-registry.json`）的拉取、缓存、校验与落盘。

## 职责

- 从 COS / 静态 `/remotes/` 拉取 registry（Web / Tauri 路径由 `resolveUploadedFileUrl` 决定）
- localStorage 缓存与 `hostApiRange` 兼容校验
- 管理端保存 registry、overlay 用户上架状态
- 暴露常量：`PLUGIN_REGISTRY_CACHE_KEY`、`PLUGIN_REGISTRY_FILENAME` 等

## 主要导出

| 符号 | 说明 |
|------|------|
| `fetchPluginRegistry` | 拉取并写缓存 |
| `persistPluginEnabled` | 上架/下架后刷新 registry |
| `savePluginRegistry` | 管理端写入 |
| `assertRegistryHostApiCompatible` | 保存前校验 Host API 版本 |
| `formatRegistryUpdatedAt` | 展示用时间格式 |

## 数据流

```
COS / /remotes/plugins-registry.json
  → fetchPluginRegistry → localStorage 缓存
  → mf.manager 加载 Remote entry
```

## 关联

- 运行时注入 → [`../runtime/`](../runtime/README.md)
- 账号偏好 overlay → [`../enabled/`](../enabled/README.md)
