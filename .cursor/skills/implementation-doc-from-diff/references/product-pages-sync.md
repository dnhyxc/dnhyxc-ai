# 产品姊妹稿 → 应用内结构化页同步规则

当本轮在 **`docs/project-update-info.md`** 和/或 **`docs/project-guide.md`** 中增删改用户向正文时，须**同轮**同步下列前端数据源，使 `/update-info`、`/project-guide` 与 Markdown 姊妹稿一致。

| Markdown 姊妹稿 | 中文主数据 | 英文映射（`locale === 'en-US'` 时覆盖） |
|-----------------|------------|----------------------------------------|
| `docs/project-update-info.md` | `apps/frontend/src/views/updateInfo/updateInfoSections.ts` | `apps/frontend/src/views/updateInfo/updateInfoSectionsEnOverlay.ts` |
| `docs/project-guide.md` | `apps/frontend/src/views/projectGuide/projectGuideSections.ts` | `apps/frontend/src/views/projectGuide/projectGuideSectionsEnOverlay.ts` |

**允许改动的业务源码范围**（仅此 4 个文件 + `docs/` 内姊妹稿与专题文）：不得借同步之名改动其它 `apps/**` 文件。

---

## 1. 章节与 Markdown 的对应关系

### 1.1 更新信息（update-info）

| Markdown | 前端 `section.id` | `section.title` 与 Markdown `## N.` 标题一致 |
|----------|-------------------|-----------------------------------------------|
| `## 1. 发布与更新` | `s1` | |
| `## 2. 账号与访问控制` | `s2` | |
| … | `sN` | 编号 **N** 与 `sN` 一致（现有 §1–§24） |
| `## 24. …` | `s24` | 新增大章时须同时补 `UPDATE_INFO_SECTION_TITLES_EN[s24]` |

- 条目标题以 Markdown bullet 的 **`**标题**`** 为准，写入 `UpdateInfoBullet.title`。
- 日期从 `（更新：YYYY-MM-DD）` 解析为 `dateLabel: 'YYYY-MM-DD'`（去掉「待提交」等后缀仅保留日期部分，备注可并入 `description`）。
- 正文为冒号后的描述，写入 `description`；**禁止**出现仓库路径、`.ts` 文件名（与姊妹稿相同）。

### 1.2 产品指南（project-guide）

| Markdown | 前端 `section.id` | 条目 `id` 模式 |
|----------|-------------------|----------------|
| `## N. 章节标题` | `pg-sN` | |
| `### N.x 小节标题` | 仍属 `pg-sN` 节下 | `pg-sN-x`（如 `### 4.2` → `pg-s4-2`） |

- `ProjectGuideItem.title` = 小节标题（含 `4.2` 编号，与 Markdown `###` 一致）。
- `description`：将该小节下所有 bullet 与段落**合并为一段字符串**；多条列表用 `\n` 连接；子 bullet 的 `**标签**` 可保留为「标签：内容」行内说明。
- 无 `dateLabel` 字段。

---

## 2. 条目 `id` 分配与变更策略

### 更新信息

- 格式：`{sectionId}-{序号}`，如 `s4-1`、`s13-3`。
- **新增** bullet：在该 `section.items` 末尾追加，序号为当前最大 +1（勿复用已删除 id，避免英文 overlay 错位）。
- **修改**已有能力：优先**原地更新**同 `id` 的 `title` / `dateLabel` / `description`（日期以姊妹稿最新为准）。
- **删除** bullet：从 TS 与 `UPDATE_INFO_BULLETS_EN` 同时移除对应 key（少见，需确认无外链依赖该 id）。

### 产品指南

- 格式：`pg-s{节号}-{序号}`，如 `pg-s4-2`。
- **修改**小节：更新同 `id` 的 `description`（及必要时 `title`）。
- **新增** `###` 小节：在对应 `pg-sN` 的 `items` 中按 x 编号插入 `pg-sN-x`；**必须**在 `PROJECT_GUIDE_ITEMS_EN` 增加同 key。

---

## 3. 英文 overlay 必做项

对每一个**新增或修改**的中文条目：

| 文件 | 更新对象 |
|------|----------|
| `updateInfoSectionsEnOverlay.ts` | `UPDATE_INFO_BULLETS_EN['s4-9']` = `{ title, description }`；新章节补 `UPDATE_INFO_SECTION_TITLES_EN` |
| `projectGuideSectionsEnOverlay.ts` | `PROJECT_GUIDE_ITEMS_EN['pg-s4-2']`；新章节补 `PROJECT_GUIDE_SECTION_TITLES_EN` |

- 英文为产品向表述，**不是**机器直译腔；可略写，但须覆盖中文要点。
- 若只改中文、未改语义，仍建议扫一遍英文是否需对齐。
- 页首导语变更时：更新 `UPDATE_INFO_INTRO_ZH`（`updateInfoSections.ts` 底部常量）与 `UPDATE_INFO_INTRO_EN`（overlay）。

---

## 4. Markdown → 字段提取示例

**更新信息 bullet（Markdown）：**

```markdown
- **对话模型接入统一**（更新：2026-05-21）：主站智能对话的后端生成链路统一为硅基流动 OpenAI 兼容接口……
```

**对应 TS：**

```typescript
{
  id: 's4-9',
  title: '对话模型接入统一',
  dateLabel: '2026-05-21',
  description: '主站智能对话的后端生成链路统一为硅基流动 OpenAI 兼容接口……',
}
```

**产品指南小节（Markdown）** 下多 bullet 合并进单条 `description`，见 `pg-s5-6` 现有写法。

---

## 5. 同步自检清单

- [ ] 姊妹稿 § 编号与前端 `sN` / `pg-sN` 一致。
- [ ] 每条新增 update-info bullet 均有唯一 `id` 且 **EN overlay 已补齐**。
- [ ] 每条修改的 project-guide 小节 **EN overlay 已对齐**。
- [ ] 正文无 `apps/`、`docs/`、`.ts` 路径（路由如 `/update-info` 可保留）。
- [ ] 未改动 `index.tsx`、`paths.ts` 等路由文件（除非用户另开任务）。

---

## 6. 与姊妹稿维护顺序

推荐顺序：

1. 定稿 `docs/project-update-info.md` / `docs/project-guide.md`（产品向、无路径）。
2. 按上表写入 `updateInfoSections.ts` / `projectGuideSections.ts`。
3. 同步两个 `*EnOverlay.ts`。
4. 本地切换界面语言 **中文 / English** 预览 `/update-info` 与 `/project-guide`。
