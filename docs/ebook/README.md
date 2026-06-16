# 电子书（书架与阅读）

本域收录 EPUB / PDF 书架、双端导入、阅读进度同步与阅读页交互相关实现说明。

| 专题 | 说明 |
|------|------|
| [ebook-reader-shelf.md](./ebook-reader-shelf.md) | **主文档**：本轮书架 + 阅读页全链路（后端 API、MobX Store、Tauri/Web 分流、顶栏面包屑修复） |
| [shelf-reader-polish.md](./shelf-reader-polish.md) | **增量**：书架卡片 UI、导入不自动阅读、PDF 目录与顶栏翻页、EPUB 主题文字与渲染稳定性 |
| [shelf-cover-title.md](./shelf-cover-title.md) | **增量**：自定义封面（文件落盘）、书名编辑、卡片 hover 操作层、桌面端「选择本地文件」文案 |
| [epub-reader-settings-scroll.md](./epub-reader-settings-scroll.md) | **增量**：EPUB 阅读设置（字号/行距/颜色/背景/翻页方式）、连续滚动章节衔接 |
| [ebook-cos-local-shelf.md](./ebook-cos-local-shelf.md) | **增量**：COS 云端备份、桌面本地优先、书架分页、阅读设置 12 色块、PDF/EPUB 滚动条统一 |
| [pdf-reader-fit-scroll.md](./pdf-reader-fit-scroll.md) | **增量**：PDF 适应宽度、顶栏缩放、滚动换页（停稳后翻页） |

**延伸阅读**：上传目录与 `uploads/ebooks` 落盘见 [ops/upload-storage-paths.md](../ops/upload-storage-paths.md)；路由鉴权与公开路径见 [app/route-auth.md](../app/route-auth.md)。
