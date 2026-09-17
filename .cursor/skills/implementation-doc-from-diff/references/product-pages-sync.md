# 产品姊妹稿 → 应用内结构化页同步规则

当本轮在 **`<WIKI_ROOT>/项目更新信息.md`** 和/或 **`<WIKI_ROOT>/项目指南.md`** 中增删改用户向正文时，须**同轮**同步下列前端数据源，使 `/update-info`、`/project-guide` 与 Markdown 姊妹稿一致。

`<WIKI_ROOT>` = `/Users/dnhyxc/Documents/code/micro-apps/remote-docs/wiki/`（相对本仓：`../micro-apps/remote-docs/wiki/`）。

| Markdown 姊妹稿 | 中文主数据 | 英文映射（`locale === 'en-US'` 时覆盖） |
|-----------------|------------|----------------------------------------|
| `<WIKI_ROOT>/项目更新信息.md` | `micro-apps/remote-docs/src/views/updateInfo/updateInfoSections.ts` | `…/updateInfoSectionsEnOverlay.ts` |
| `<WIKI_ROOT>/项目指南.md` | `micro-apps/remote-docs/src/views/projectGuide/projectGuideSections.ts` | `…/projectGuideSectionsEnOverlay.ts` |

**允许改动的业务源码范围**（仅此 4 个文件 + `<WIKI_ROOT>/` 内姊妹稿与专题文）：不得借同步之名改动本仓其它 `apps/**` 文件；数据源在 `micro-apps/remote-docs`。

---

## 1. 章节与 Markdown 的对应关系

### 1.1 更新信息（update-info）

| Markdown | 前端 `section.id` | `section.title` 与 Markdown `## N.` 标题一致 |
|----------|-------------------|-----------------------------------------------|
| `## 1. 发布与更新` | `s1` | |
| （其余章节按现有 `updateInfoSections.ts` 与 Markdown 对齐） | `sN` | |

新增条目 id：`{sN}-{下一序号}`，勿复用已删 id。

### 1.2 产品指南（project-guide）

| Markdown | 前端小节 id 形态 |
|----------|------------------|
| 既有章节内新小节 | `pg-s{N}-{x}` |

新增小节勿复用已删 id；英文 overlay **同 id** 覆盖 title + description。

---

## 2. 同步步骤（同轮必做）

1. 定稿 `<WIKI_ROOT>/项目更新信息.md` / `项目指南.md`（产品向、无路径）。
2. 更新对应 `*Sections.ts`（中文主数据）。
3. **同 id** 更新 `*EnOverlay.ts`（英文）。
4. 本地切换界面语言 **中文 / English** 预览 `/update-info` 与 `/project-guide`。

---

## 3. 自检

- [ ] 每条修改的 update-info / project-guide 条目 **EN overlay 已对齐**。
- [ ] 正文无 `apps/`、`docs/`、`wiki/`、`.ts` 路径（路由如 `/update-info` 可保留）。
- [ ] 未改动白名单外的本仓业务源码。
