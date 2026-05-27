# docs/ 目录整理规则（新增或更新专题文后必做）

在 `docs/` 下**新建**或**显著改名/搬迁**专题 `*.md` 后，除写入正文外，须**自动整理**整个 `docs/` 索引体系，避免文档孤岛与重复叙述。

## 1. 必更新索引（按影响范围）

| 文件 | 何时更新 |
|------|----------|
| [`docs/README.md`](../../../../docs/README.md) | 新功能域、新「常见排查」现象、跨域重要专题 |
| `docs/<功能域>/README.md` | 该功能域下新增/更名/废弃的专题文（如 `chat/`、`cos/`、`knowledge/`） |
| 相关专题文文首「延伸阅读」 | 与本轮改动强相关的旧文：补链到新文，或改为「详见 xxx（主文档）」避免双份维护 |

**不再使用**已废弃的 `documentation-master-index.md`；以 `docs/README.md` + 各子目录 `README.md` 为登记表。

## 2. 功能域落盘（与 SKILL 硬约束一致）

- 专题文路径：**`docs/<功能域>/<file>.md`**，规则见 [`doc-domain-layout.md`](doc-domain-layout.md)。
- **禁止** `docs/backend/`、`docs/frontend/`；**禁止**在 `docs/` 根目录新增专题（姊妹稿除外）。
- 无对应目录时：**创建** `docs/<功能域>/` + `README.md`，并更新 `docs/README.md`。

## 3. 去重与主从分工

- **同一主题只保留一份「实现细节 + 代码摘录」**：例如 COS 展示代理以 `cos/cos-dev-http-proxy.md` 为主，`app/route-auth.md` §12、`app/tauri-macos-ats-http.md` 只保留摘要 + 链接。完整功能域表见 `docs/README.md`。
- **用户向 vs 开发者向**：`project-guide.md` / `project-update-info.md` 不写路径；实现路径写在专题文与 `docs/README.md`。
- **文件名**：简短 kebab-case，与 SKILL §4 一致；勿用 `notes.md`、`update.md`。

## 4. 整理自检清单

- [ ] 新专题是否落在正确 `docs/<功能域>/`（见 `doc-domain-layout.md`）？
- [ ] 新功能域目录与 `README.md` 是否已创建并登记 `docs/README.md`？
- [ ] 新专题是否出现在对应 `docs/<功能域>/README.md`？
- [ ] 是否需在 `docs/README.md`「按功能域」或「常见排查」表增一行？
- [ ] 是否与既有文档重复？若重复，是否已收窄旧文并加交叉链接？
- [ ] 专题文文首是否有「延伸阅读 / 文档角色（主文档）」说明？
- [ ] `project-guide.md` 入口（§14）是否仍指向 `docs/README.md`（仅维护索引链接，不在产品正文写仓库路径）

## 5. 子目录无 README 时

若在某功能域首批落盘且尚无 `README.md`，须**新建**该目录（若整个目录也不存在则一并创建）及 `README.md`（一句话职责 + 专题索引表），并在 `docs/README.md` 功能域表补一行入口。
