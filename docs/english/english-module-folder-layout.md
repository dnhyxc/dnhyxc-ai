# 英语学习模块目录整理（components / reference / favorites）

> **文档角色**：说明 `englishLearning` 前端子模块在 2026-05 一轮**纯结构整理**后的目录约定与 import 路径；**不改变**路由、API 与用户可见行为。  
> **延伸阅读**：[vocabulary-mistakes-and-shared-ui.md](./vocabulary-mistakes-and-shared-ui.md)（横切 UI 组件职责）、[classic-practice-and-mistakes.md](./classic-practice-and-mistakes.md)（收藏/错题面板）。

---

## 1. 背景与目标

英语学习页面积累多个子功能（主区 Agent、词包、收藏、错题、练习、参考资料）。此前存在三类可维护性问题：

1. **横切 UI 目录名 `shared/`** 与各子模块已有的 `components/`（如 `favorites/components`）语义重复，新人难以判断「该放哪一层」。
2. **参考资料 `reference/`** 根目录堆叠 `dataSource.ts`（语法 + 词形合计约 1.3 万行）、`types.ts`、`grammarData.ts` 等，语法与词形边界不清。
3. **收藏子页** 曾拆 `*Panel.tsx` + `index.tsx` 两层，逻辑薄、跳转成本高（已在 commit `498ca0c3` 将 Panel 并入 `index.tsx`，本轮文档一并登记目录约定）。

本轮目标：**按产品子域收拢文件、统一命名**，import 批量替换；**零产品行为变更**。

---

## 2. 改动范围

### 2.1 `shared/` → `components/`（模块级横切 UI）

| 操作 | 路径 |
|------|------|
| 重命名目录 | `apps/frontend/src/views/englishLearning/shared/` → `.../components/` |
| 更新 import | 约 18 处：`../shared/`、`../../shared/`、`./shared/` → 对应 `components/` |

`components/` 内文件（名称不变）：

- `ClassicQuoteCard.tsx`、`EnglishLearningPanelHeader.tsx`、`EnglishSource.tsx`
- `LearningToolbar.tsx`、`SegmentationLine.tsx`、`VocabularyWordCard.tsx`
- `WebSearchResultsBar.tsx`、`practiceEntry.tsx`

### 2.2 `reference/` 按 grammar / morphology 分域

| 原路径（删除或迁出） | 新路径 |
|----------------------|--------|
| `reference/dataSource.ts` | `reference/grammar/dataSource.ts`、`reference/morphology/dataSource.ts` |
| `reference/types.ts` | `reference/grammar/types.ts`、`reference/morphology/types.ts` |
| `reference/grammarData.ts` | `reference/grammar/grammarData.ts` |
| `reference/morphologyData.ts` | `reference/morphology/morphologyData.ts` |
| `reference/GrammarPointBlock.tsx` | `reference/grammar/GrammarPointBlock.tsx` |
| `reference/ReferencePageShell.tsx` | `reference/components/ReferencePageShell.tsx` |
| `reference/referenceNavItemClass.ts` | `reference/utils/referenceNavItemClass.ts` |

保留：`reference/index.tsx`（仍导出 `EnglishGrammarReferencePage`、`EnglishMorphologyReferencePage`）；路由 `reference/grammar`、`reference/morphology` **不变**。

### 2.3 收藏页（前序 commit，结构约定）

| 路径 | 约定 |
|------|------|
| `favorites/vocabulary/index.tsx` | 列表 + 选择 + 导出 + 底栏，**单文件** |
| `favorites/classic/index.tsx` | 同上 |
| `favorites/vocabulary/useVocabularyFavoritesList.ts` | 分页与 API |
| `favorites/classic/useClassicFavoritesList.ts` | 分页与 API |

已删除：`VocabularyFavoritesPanel.tsx`、`ClassicQuotesFavoritesPanel.tsx`。

---

## 3. 实现思路

### 3.1 为何用 `components/` 而非 `shared/`

- 与 `favorites/components`、`mistakes/components`、`practice/components` **同级命名**，表示「本模块内复用的展示组件」。
- `reference/components/` 仅服务参考资料两页，**不**与模块根 `components/` 混用——前者是 reference 子域私有壳层。

### 3.2 参考资料数据拆分

- 原 `dataSource.ts` 为 `{ grammar, morphology }` 单对象；拆开后各子域 `dataSource.ts` 直接 `export const grammarDataSource` / `morphologyDataSource`，由同目录 `grammarData.ts` / `morphologyData.ts` 消费。
- **类型**随数据走：`GrammarReference` 仅在 `grammar/types.ts`；`MorphologyReference` 仅在 `morphology/types.ts`，避免交叉 import。
- 静态 JSON 体量不变，仅**物理文件**分离，便于按需打开编辑器、减少 merge 冲突面。

### 3.3 import 约定（整理后）

| 引用方所在目录 | 引用模块根 `components/` | 引用 reference 壳层 |
|----------------|--------------------------|---------------------|
| `englishLearning/index.tsx` | `./components/EnglishSource` | — |
| `favorites/vocabulary/index.tsx` | `../../components/VocabularyWordCard` | — |
| `pack/VocabularyPackList.tsx` | `../components/VocabularyWordCard` | — |
| `reference/grammar/index.tsx` | — | `../components/ReferencePageShell`、`../utils/referenceNavItemClass` |

### 3.4 未改动的边界

- 路由表 `apps/frontend/src/router/routes.ts` 仍从 `@/views/englishLearning/reference` 具名导入两页。
- 组件 props、练习入口 URL、参考资料 `?section=` 查询参数语义不变。
- **不**更新 `project-guide.md` / `project-update-info.md`（用户无感知）。

---

## 4. 关键代码与注释

### 4.1 模块入口：横切组件 import

**来源**：`apps/frontend/src/views/englishLearning/index.tsx`（约 L24–L28）

```tsx
// 主区左侧：资料源切换（词包 / 经典句等）
import EnglishSource from './components/EnglishSource';
// 主区右侧：Agent 工具栏（快捷意图、模式）
import {
	EnglishLearningToolbar,
	type QuickIntentInputSyncPayload,
} from './components/LearningToolbar';
```

### 4.2 子页引用统一单词卡片

**来源**：`apps/frontend/src/views/englishLearning/favorites/vocabulary/index.tsx`（约 L25–L27）

```tsx
// 自模块根 components/ 引入横切卡片（相对 favorites/vocabulary 上两级）
import { VocabularyWordCard } from '../../components/VocabularyWordCard';
// favorites 子域私有底栏仍在 favorites/components/
import { FavoritesPanelFooter } from '../components/FavoritesPanelFooter';
```

### 4.3 参考资料：语法页本地聚合

**来源**：`apps/frontend/src/views/englishLearning/reference/grammar/index.tsx`（约 L13–L23）

```tsx
// 语法域私有：知识点块、导航构建、静态数据
import { GrammarPointBlock } from './GrammarPointBlock';
import {
	buildGrammarNavItems,
	buildGrammarNavRows,
	findGrammarNavBySectionId,
	grammarReference,
	resolveGrammarSection,
} from './grammarData';
// reference 子域共享壳与导航样式（非 englishLearning 根 components）
import { ReferencePageShell } from '../components/ReferencePageShell';
import { referenceNavItemClass } from '../utils/referenceNavItemClass';
import type { GrammarSubsection } from './types';
```

### 4.4 语法静态数据独立导出

**来源**：`apps/frontend/src/views/englishLearning/reference/grammar/dataSource.ts`（约 L1–L10，摘录）

```ts
/**
 * 英语学习参考静态数据 — 语法
 * 由原 reference/dataSource.ts 的 grammar 字段拆出，内容未改。
 */
import type { GrammarReference } from './types';

export const grammarDataSource = {
	title: '英语语法大全',
	description: '系统全面的英语语法参考，涵盖词法、句法、时态、语态、从句、非谓语等所有核心语法板块',
	parts: [
		// ... 各 part / chapter / section 树（约 3000 行）
	],
} as GrammarReference;
```

### 4.5 语法导航层消费本地 dataSource

**来源**：`apps/frontend/src/views/englishLearning/reference/grammar/grammarData.ts`（约 L1–L24）

```ts
import { grammarDataSource } from './dataSource';
import type { GrammarNavItem, GrammarReference, GrammarSection } from './types';

/** 对外仍暴露 grammarReference，页面与其它模块无感 */
export const grammarReference: GrammarReference = grammarDataSource;

export function buildGrammarNavItems(): GrammarNavItem[] {
	const items: GrammarNavItem[] = [];
	// 遍历 parts → chapters → sections，扁平化为左侧导航项
	grammarDataSource.parts.forEach((part, partIndex) => {
		part.chapters.forEach((chapter, chapterIndex) => {
			chapter.sections.forEach((section, sectionIndex) => {
				items.push({
					sectionId: section.id,
					label: section.title,
					depth: 2,
					partIndex,
					chapterIndex,
					sectionIndex,
				});
			});
		});
	});
	return items;
}
```

### 4.6 词形域对称结构

**来源**：`apps/frontend/src/views/englishLearning/reference/morphology/morphologyData.ts`（约 L1–L11）

```ts
import { morphologyDataSource } from './dataSource';
import type { MorphologyReference, MorphologySectionKey } from './types';

/** 词根词缀三块：prefixes / suffixes / roots */
export const morphologyReference: MorphologyReference = morphologyDataSource;

export const MORPHOLOGY_SECTION_KEYS: MorphologySectionKey[] = [
	'prefixes',
	'suffixes',
	'roots',
];
```

### 4.7 参考资料 barrel 导出不变

**来源**：`apps/frontend/src/views/englishLearning/reference/index.tsx`（全文）

```ts
/**
 * 英语学习参考资料入口：词根词缀、语法大全
 * 路由层继续 import { EnglishGrammarReferencePage, ... } from '@/views/englishLearning/reference'
 */
export { default as EnglishGrammarReferencePage } from './grammar';
export { default as EnglishMorphologyReferencePage } from './morphology';
```

---

## 5. 兼容性与影响

| 维度 | 影响 |
|------|------|
| 用户可见 UI | 无 |
| 路由 / URL | 无 |
| 后端 API | 无 |
| 开发者 | 旧路径 `shared/`、`reference/dataSource.ts` 等 **失效**；全文搜索应改用上表新路径 |
| 文档 | 历史专题文中 `shared/` 路径需改为 `components/`（见各文「延伸阅读」或本表） |

**建议回归**（smoke）：

1. 主区 `/english-learning`：左侧 `EnglishSource`、工具栏、词包/经典句切换。
2. 收藏 `/english-learning/favorites?kind=vocab|classic`：卡片、朗读、底栏练习入口。
3. 参考资料 `/english-learning/reference/grammar`、`.../morphology`：左侧导航、右侧正文、词形例词朗读。
4. 练习揭示区：分词行 `SegmentationLine` 仍正常显示。

---

## 6. 相关源码路径

| 说明 | 路径 |
|------|------|
| 模块级横切 UI | `apps/frontend/src/views/englishLearning/components/` |
| 参考资料入口 | `apps/frontend/src/views/englishLearning/reference/index.tsx` |
| 语法参考 | `apps/frontend/src/views/englishLearning/reference/grammar/` |
| 词形参考 | `apps/frontend/src/views/englishLearning/reference/morphology/` |
| 参考页壳 / 导航样式 | `reference/components/ReferencePageShell.tsx`、`reference/utils/referenceNavItemClass.ts` |
| 单词收藏页 | `apps/frontend/src/views/englishLearning/favorites/vocabulary/index.tsx` |
| 经典句收藏页 | `apps/frontend/src/views/englishLearning/favorites/classic/index.tsx` |

若与仓库最新源码不一致，以源码为准。
