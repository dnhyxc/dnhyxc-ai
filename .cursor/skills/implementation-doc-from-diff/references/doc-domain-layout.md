# docs/ 功能域目录与落盘规则

专题实现文**必须**落在与改动**产品功能**一致的 `docs/<功能域>/` 下，**禁止**再使用已废弃的 `docs/backend/`、`docs/frontend/` 等按技术栈划分的顶层目录。

权威登记表：仓库根 [`docs/README.md`](../../../../docs/README.md)。

---

## 1. 如何选择功能域

按**用户/维护者关心的能力**选目录，不按 `apps/backend` vs `apps/frontend` 路径选目录。

| 改动涉及 | 落盘目录 | 典型源码前缀（仅供对照） |
|----------|----------|-------------------------|
| 主站对话、分享、联网、聊天附件 | `docs/chat/` | `apps/backend/src/services/chat/`、`apps/frontend/src/views/chat/`、`ChatBot` |
| 知识库、RAG、文档助手、本地文件夹 | `docs/knowledge/` | `apps/frontend/src/views/knowledge/`、knowledge/assistant 后端 |
| 英语学习（词包、收藏、TTS、Agent） | `docs/english/` | `english-learning`、`agent` 英语学习 |
| 腾讯云 COS 上传、`/ext-cos/` 展示 | `docs/cos/` | `upload/cos`、`resolveCosUrl*`、vite `/ext-cos` |
| 大模型接入（硅基、`createLlm`、设置页 LLM） | `docs/llm/` | `create-llm`、`llm-runtime-settings`、`siliconflow` |
| 部署、Nginx、本地上传 `uploads/` | `docs/ops/` | `deploy`、`nginx`、`upload-paths` |
| 路由守卫、401、Tauri、i18n、登录流程 | `docs/app/` | `router/`、`src-tauri/`、全局 `utils` 横切（非单一业务页） |
| Monaco / Markdown 编辑器 | `docs/monaco/` | `MarkdownEditor`、`monaco` |
| Mermaid 围栏、预览缩放 | `docs/mermaid/` | `Mermaid`、`markdown-kit` 图表 |
| `@dnhyxc-ai/markdown-kit` 包 | `docs/tools/` | `packages/markdown-kit` |
| React Hooks 通用模式 | `docs/react/` | `hooks/` 且**无**单一业务域 |
| 系统快捷键 | `docs/setting/` | `views/setting/system` |
| 发布、更新页同步脚本 | `docs/meta/` | `scripts/release`、`update-info` 生成 |

**跨域改动**：专题文放在**主功能域**；其它域只在文首「延伸阅读」或 `docs/README.md` 常见排查中交叉链接。不要把同一主题拆到 `backend/` 与 `frontend/` 两份实现文。

**仅根目录**（不写进子目录）：`docs/project-guide.md`、`docs/project-update-info.md`（产品向姊妹稿）。

---

## 2. 目录命名（必须简短）

- 使用**小写**、**短**、**单一功能**：如 `chat`、`cos`、`llm`、`ops`、`app`、`english`。
- **禁止**过长或泛名目录：`backend`、`frontend`、`notes`、`misc`、`temp`。
- **禁止**恢复 `docs/backend/`、`docs/frontend/`；历史链接应改指向上表对应域。

新建目录示例（仅当产品新增独立能力域且上表无合适项时）：

| 可接受 | 避免 |
|--------|------|
| `pay/`、`notify/` | `payment-integration-docs/` |
| `auth/`（若与 `app/` 路由守卫拆不开则仍用 `app/`） | `user-authentication-module/` |

新目录名建议 **2～8 个字符**；创建后必须在 `docs/README.md`「功能域目录」表增一行。

---

## 3. 目录不存在时（必须创建）

落盘前检查 `docs/<功能域>/` 是否存在：

1. **无此目录** → 创建 `docs/<功能域>/`。
2. **无 `README.md`** → 新建 `docs/<功能域>/README.md`（一句话说明该域职责 + 表格索引已有/本轮新增专题）。
3. 在 [`docs/README.md`](../../../../docs/README.md) 的「功能域目录」表补一行入口。
4. 若现象适合排查表 → 在 `docs/README.md`「常见排查」补链。

不得把专题文直接写在 `docs/` 根下（`project-guide.md` / `project-update-info.md` 除外）。

---

## 4. 从源码路径反推功能域（速查）

```
apps/backend/src/services/chat/     → chat/（后端部分写在 chat 专题即可）
apps/backend/src/services/upload/   → cos/ 或 ops/（COS 用 cos/，本地上传用 ops/）
apps/backend/src/services/share/    → chat/
apps/backend/src/services/english-learning/ → english/
apps/frontend/src/views/chat/       → chat/
apps/frontend/src/views/knowledge/  → knowledge/
apps/frontend/src/views/english-learning/ → english/
apps/frontend/src/utils/index.ts    → 若仅 COS 展示链 → cos/；若路由鉴权 → app/
packages/markdown-kit/              → tools/
```

---

## 5. 自检（落盘前）

- [ ] 专题路径是否为 `docs/<功能域>/<简短文件名>.md`？
- [ ] `<功能域>` 是否在 `docs/README.md` 已登记？
- [ ] 是否误用 `docs/backend/`、`docs/frontend/` 或 `docs/` 根目录堆专题？
- [ ] 跨域内容是否指定了主文档 + 它处摘要链接（见 `docs-maintenance.md` §2）？
