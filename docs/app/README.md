# 前端应用壳层

路径前缀：`apps/frontend/`（非单一业务模块的横切能力）。

本目录现仅保留**构建优化、网络、文件选择、语音输入**等通用壳层能力。插件系统、Tauri 桌面、认证、样式隔离、视频播放、国际化、通用 UI 已拆分为独立功能域目录。

| 文档 | 说明 |
|------|------|
| [build-optimization.md](../app/build-optimization.md) | 前端打包优化：路由 `React.lazy` + `manualChunks` + mermaid 动态 `import()`、CSS 显式引入、Monaco/Prettier 懒加载、barrel 瘦身 |
| [http-network-error-toast.md](../app/http-network-error-toast.md) | 网络错误 Toast |
| [voice-input-implementation.md](./voice-input-implementation.md) | 语音输入（对话等） |
| [unified-file-selection.md](../app/unified-file-selection.md) | 通用文件选择命令统一：Tauri `select_files` 命令、前端 `select-files.ts` 模块、`assetProtocol` 配置 |
| [pick-file-object.md](../app/pick-file-object.md) | 跨端 pickFileObject 统一文件选取：Web input + Tauri `convertFileSrc` + `fetch` |
| [block-file-drop-nav.md](./block-file-drop-nav.md) | 拦截拖放文件导航：Rust `block_file_drop_navigation` 插件 + 前端 `dragover` / `drop` `preventDefault` |
| [learning-notes-implementation.md](./learning-notes-implementation.md) | 学习笔记实现：MobX `LearningNotesStore`、Host API 依赖注入、累积分页加载、DOCX 导出 |

---

## 已拆分至独立功能域

| 新目录 | 说明 | 入口 |
|--------|------|------|
| [plugins/](../plugins/) | 插件/微前端系统（MF、插件开发、样式隔离） | [plugins/mf-implementation-guide.md](../plugins/mf-implementation-guide.md) |
| [tauri/](../tauri/) | Tauri 桌面特性（窗口、菜单、全屏、右键） | [tauri/tauri-window-zoom-unveil.md](../tauri/tauri-window-zoom-unveil.md) |
| [auth/](../auth/) | 认证登录（路由守卫、SecretInput、小程序绑定） | [auth/route-auth.md](../auth/route-auth.md) |
| [style/](../style/) | 样式隔离（@scope、Portal、qiankun 加固） | [style/style-isolation-implementation.md](../style/style-isolation-implementation.md) |
| [video/](../video/) | 视频播放器（组件化、影院态、画中画） | [video/video-player-plugin.md](../video/video-player-plugin.md) |
| [i18n/](../i18n/) | 国际化（中英文界面） | [i18n/i18n-zh-en-implementation-guide.md](../i18n/i18n-zh-en-implementation-guide.md) |
| [ui/](../ui/) | 通用 UI/UX（组件、交互、编辑器） | [ui/ui-tint-polish.md](../ui/ui-tint-polish.md) |

上级：[../README.md](../README.md)
