# EPUB 读书想法（服务端存储 + 虚线下划线）

## 文档角色

**主文档（数据与下划线）**：EPUB 阅读页「写想法 / 查看 / 编辑 / 删除」——数据库持久化、API、阅读区虚线下划线；含**重叠选区去重**、**点击/选区防误触**、**统一列表入口**等交互细节。弹窗/底部抽屉等 **UI 容器已废弃**，见下。

**逐步拆解（推荐）**：[epub-thought-underline-impl.md](./epub-thought-underline-impl.md)（想法虚线全流程 + 逐行注释代码）。用户彩色划线见 [epub-user-highlight-impl.md](./epub-user-highlight-impl.md)。

**延伸阅读（UI，按当前产品阅读顺序）**：

| 文档 | 说明 |
|------|------|
| [epub-thought-side-panel.md](./epub-thought-side-panel.md) | **当前主 UI**：右侧分栏（与 MK 问书互斥） |
| [epub-selection-popbar-visual.md](./epub-selection-popbar-visual.md) | 选区浮动 PopBar 视觉与阴影令牌 |
| [epub-thought-underlines-sync.md](./epub-thought-underlines-sync.md) | 下划线同步稳定性 |
| [epub-assistant-context-menu.md](./epub-assistant-context-menu.md) | EPUB 右键与 CFI 选区 |
| [epub-thought-drawer.md](./epub-thought-drawer.md) | **已废弃归档**（全屏底部抽屉，勿作实现依据） |
| [ebook-reader-shelf.md](./ebook-reader-shelf.md) | 阅读页总览 |

---

## 1. 背景与目标

用户在阅读 **EPUB** 时，可对选中段落写下感想（类微信读书「想法」），并在正文中以**细琥珀色虚线下划线**标记；点击下划线可查看、编辑或删除。需求要点：

- **登录**后使用；想法存**服务端**，换设备可同步（同一账号）。
- **同一段落（同一 CFI）可有多条想法**，不互相覆盖；列表按创建时间**倒序**（最新在前）。
- **不同选区重叠**（如「黑美人」与「傻皇帝与黑美人」嵌套）时，重叠部分**只画一条可见线**，避免多条虚线叠在一起变粗变密。
- 展示发帖 **username**（查询时从 user 表实时解析，**不**写入想法表）。
- **删除书籍**时级联删除该书下该用户的全部想法。
- **仅 EPUB**；PDF 暂无正文选区，不在本轮范围。

---

## 2. 改动范围

| 区域 | 路径 |
|------|------|
| 实体与迁移 | `apps/backend/src/services/ebook/ebook-thought.entity.ts`、`apps/backend/src/migrations/1781803529705-ebook_thought.ts` |
| DTO / API | `dto/create-ebook-thought.dto.ts`、`dto/update-ebook-thought.dto.ts`、`ebook.controller.ts`、`ebook.service.ts`、`ebook.module.ts` |
| 前端类型与 API | `apps/frontend/src/views/ebook/types.ts`、`apps/frontend/src/service/api.ts`、`index.ts` |
| 阅读页集成 | `apps/frontend/src/views/ebook/read.tsx` |
| 右侧面板 UI | `components/EpubThought.tsx`、`EpubThoughtList.tsx`、`EpubThoughtPanelShell.tsx`、`EpubThoughtParts.tsx` |
| 下划线与点击 | `utils/epubThoughtAnnotations.ts`、`components/EpubPane.tsx` |
| 右键菜单 | `utils/buildEpubContextMenuItems.ts`、`utils/epubContextMenuAttach.ts` |
| i18n | `apps/frontend/src/i18n/locales/zh-CN.ts`、`en-US.ts` |

---

## 3. 实现思路

1. **数据模型**：`ebook_thought` 表存 `user_id`、`book_id`、`cfi_range`（epub.js 定位）、`quote`（摘录）、`content`（正文）；**不存 username**。
2. **API**：JWT 鉴权下 CRUD——`GET /ebook/thoughts/:bookId`、 `POST /ebook/thoughts`、 `PUT /ebook/thoughts/:id`、 `DELETE /ebook/thoughts/:id`；列表 `createdAt DESC`。
3. **username**：`list/create/update` 返回 DTO 时按 `userId` 批量查 `user` 表填充 `username`，用户改名后下次拉取即更新。
4. **删书级联**：`ebook.service.remove()` 在删书前 `thoughtRepo.delete({ bookId, userId })`。
5. **下划线**：用 epub.js `annotations.underline` + marks-pane SVG；**同 CFI 只画一条线**，`data.thoughtIds` 携带该段全部想法 id。
6. **marks-pane 样式**：库默认会在 `g` 上继承 stroke 导致**虚线框**；且 line 默认黑色在深色主题不可见。通过注入 CSS + 在 `content` hook 后 **patch** 各 `line`/`rect`（隐藏 rect 描边、琥珀色虚线、线下偏移）。
7. **重叠选区（嵌套）**：
   - **可见线**：若 CFI 区间 A 被 B **严格包含**，则 A **不画可见虚线**，只保留透明命中层；最外层（如「一 傻皇帝与黑美人」）画一条线即可。
   - **点击**：所有 CFI 仍注册 underline；绘制顺序按 **quote 跨度从长到短**（短选区后画、在上层），点击重叠处优先命中更精确的短选区。
   - **包含判定**：优先用 `contents.range(cfi)` 转 DOM `Range` 比较边界；无法解析时回退为同章 `quote` 严格子串 + spine hint 一致。
8. **点击交互**：
   - **无论 1 条还是多条**，点击下划线**先打开想法列表**，再点列表项进详情（与多条逻辑一致）。
   - **拖动选字松手**时 marks-pane 可能误触 `markClicked`：iframe 内 `mousedown` 临时 `pointer-events: none`，`pointerup` 后恢复；且 `markClicked` 时若存在非空选区则忽略。
9. **右侧面板**：列表 / 详情 / 写想法在 `EbookReadSplitLayout` 的 `sidePanel` 内（与 MK 问书互斥）；`EpubThoughtPanelShell` 统一顶栏与滚动区；从列表进详情后关闭详情**回到列表**（`returnToListCfiRef`）。UI 细节见 [epub-thought-side-panel.md](./epub-thought-side-panel.md)。
10. **写想法入口**：EPUB 右键选中文字 →「写想法」；`contextPayloadRef` 在菜单动作时同步读取，避免菜单关闭清空 payload。

---

## 4. 关键代码与注释

### 4.1 实体与删书级联

**来源**：`apps/backend/src/services/ebook/ebook-thought.entity.ts`（全文）

```typescript
@Entity('ebook_thought') // 映射到 PostgreSQL 表 ebook_thought
@Index('idx_ebook_thought_user_book', ['userId', 'bookId']) // 复合索引：按用户+书籍查列表
export class EbookThought { // 读书想法 ORM 实体
	@PrimaryGeneratedColumn('uuid') // 主键 UUID，由数据库自动生成
	id: string; // 想法记录主键

	@Column({ type: 'int', name: 'user_id' }) // 列定义：整型 user_id
	userId: number; // 所属用户 id，与 JWT 中的 userId 对应

	@Column({ type: 'uuid', name: 'book_id' }) // 列定义：UUID book_id
	bookId: string; // 所属书籍 id，关联 ebook_book

	@Column({ type: 'text', name: 'cfi_range' }) // 列定义：text 存 CFI
	cfiRange: string; // epub.js 的 CFI range 字符串，用于正文定位与下划线

	@Column({ type: 'text' }) // 列定义：text 存摘录
	quote: string; // 写想法时选中的原文摘录，用于列表/详情展示

	@Column({ type: 'text' }) // 列定义：text 存正文
	content: string; // 用户填写的想法正文

	@CreateDateColumn({ name: 'created_at', type: 'timestamp' }) // 自动维护创建时间
	createdAt: Date; // 创建时间，列表按此倒序

	@UpdateDateColumn({ name: 'updated_at', type: 'timestamp' }) // 自动维护更新时间
	updatedAt: Date; // 最后编辑时间
} // EbookThought 实体结束
```

**来源**：`apps/backend/src/services/ebook/ebook.service.ts`（`remove` 方法内，约 L397）

```typescript
// 在删除书籍记录之前，先删除该书下当前登录用户的全部读书想法
await this.thoughtRepo.delete({ bookId, userId }); // 条件删除，避免留下无书籍关联的孤儿想法
```

### 4.2 列表与 username 实时解析

**来源**：`apps/backend/src/services/ebook/ebook.service.ts`（约 L743–L800）

```typescript
/** 按 userId 批量查 user 表；username 不持久化在 ebook_thought，每次响应时实时解析 */
private async buildUsernameMap(
	userIds: number[], // 待解析的用户 id 列表（可能含重复）
): Promise<Map<number, string>> { // 返回 userId → username 映射
	const unique = [...new Set(userIds.filter((id) => id > 0))]; // 去重并过滤非法 id
	const map = new Map<number, string>(); // 结果：userId -> 展示用 username
	if (unique.length === 0) return map; // 无有效 id 时直接返回空 Map

	const users = await this.userRepo.find({ // 批量查询 user 表
		where: { id: In(unique) }, // 一次 IN 查询，避免 N+1
		select: { id: true, username: true }, // 只取需要的字段
	}); // find 结束
	for (const user of users) { // 遍历查到的用户行
		map.set(user.id, user.username); // 写入真实用户名
	} // for user 结束
	for (const id of unique) { // 补齐未查到的 id（如用户已删除）
		if (!map.has(id)) map.set(id, String(id)); // 用户已删等异常时兜底为 id 字符串
	} // for id 结束
	return map; // 返回完整映射
} // buildUsernameMap 结束

async listThoughts(
	userId: number, // 当前登录用户
	bookId: string, // 要拉取想法的书籍
): Promise<EbookThoughtDto[]> { // 返回带 username 的 DTO 数组
	await this.assertBookOwned(userId, bookId); // 校验书籍存在且属于该用户
	const rows = await this.thoughtRepo.find({ // 查询数据库原始行
		where: { userId, bookId }, // 只查本书、本用户的想法
		order: { createdAt: 'DESC' }, // 最新创建的想法排在最前
	}); // find 结束
	const usernameMap = await this.buildUsernameMap(rows.map((row) => row.userId)); // 批量解析 username
	return Promise.all( // 并行组装 DTO
		rows.map((row) => this.toThoughtDtoWithUsername(row, usernameMap)), // 逐条组装带 username 的 DTO
	); // Promise.all 结束
} // listThoughts 结束
```

### 4.3 重叠选区：只画外层可见线 + 短选区优先点击

**来源**：`apps/frontend/src/views/ebook/utils/epubThoughtAnnotations.ts`（约 L375–L646）

```typescript
/** 选区跨度：优先用 quote 字符数，否则用 CFI 字符串长度，供排序用 */
function cfiGroupSpanLength(group: EbookThought[]): number { // 返回用于比较的跨度数值
	const quote = group[0]?.quote?.trim(); // 同 CFI 下 quote 相同，取首条即可
	if (quote && quote.length > 0) return quote.length; // 有摘录时用字符数衡量跨度
	return group[0]?.cfiRange.length ?? 0; // 无法取 quote 时用 CFI 长度兜底
} // cfiGroupSpanLength 结束

/** 绘制顺序：长选区先画（底层），短选区后画（上层），重叠处优先响应更精确选区 */
function sortCfiGroupsForUnderlineStack(
	entries: [string, EbookThought[]][], // [cfiRange, 该段想法列表]
): [string, EbookThought[]][] { // 返回排序后的 entries
	return [...entries].sort((a, b) => { // 复制后原地 sort，不 mutate 原 Map 迭代顺序
		const spanDiff = cfiGroupSpanLength(b[1]) - cfiGroupSpanLength(a[1]); // b 跨度减 a 跨度
		if (spanDiff !== 0) return spanDiff; // 跨度大的排前面（先绘制、在底层）
		return a[0].length - b[0].length; // 跨度相同时按 CFI 字符串长度稳定排序
	}); // sort 比较函数结束
} // sortCfiGroupsForUnderlineStack 结束

/** 计算哪些 CFI 需要绘制「可见」虚线；被外层严格包含的内层只保留透明命中层 */
function computeLineVisibleCfis(
	entries: [string, EbookThought[]][], // 全部分组
	rend: Rendition, // epub.js 渲染实例，用于 DOM Range 解析
): Set<string> { // 应显示可见线的 cfi 集合
	const visible = new Set<string>(); // 需要画可见线的 cfiRange 集合
	for (const [cfi, group] of entries) { // 逐个 CFI 判断是否被更大选区包裹
		const contained = entries.some( // 是否存在某个 other 严格包含当前 cfi
			([otherCfi, otherGroup]) =>
				otherCfi !== cfi && // 不与自身比较
				isCfiRangeStrictlyContained(cfi, otherCfi, group, otherGroup, rend), // inner=cfi 是否被 other 严格包含
		); // some 结束
		if (!contained) visible.add(cfi); // 未被任何更大选区包裹 → 需要可见线
	} // for 结束
	return visible; // 返回可见线 CFI 集合
} // computeLineVisibleCfis 结束

// —— syncEpubThoughtUnderlines 内绘制循环（摘录）——
const sortedEntries = sortCfiGroupsForUnderlineStack([...grouped.entries()]); // 先按跨度排序
const lineVisibleCfis = computeLineVisibleCfis(sortedEntries, rend); // 再算可见线集合
for (const [cfiRange, group] of sortedEntries) { // 按排序顺序逐个注册 underline
	const thoughtIds = group.map((t) => t.id); // 该 CFI 下全部想法 id，点击时用于过滤
	const showLine = lineVisibleCfis.has(cfiRange); // 是否绘制可见虚线
	rend.annotations.remove(cfiRange, 'underline'); // 先移除旧 mark，避免重复或数据陈旧
	rend.annotations.underline( // 注册 epub.js 下划线批注
		cfiRange, // epub.js 定位串
		{ // data 对象，marks-pane 写入 dataset
			thoughtIds, // 批注 data，markClicked 时带回
			showLine: showLine ? '1' : '0', // marks-pane 写入 dataset，patch 时读此字段
		}, // data 结束
		undefined, // 不使用 epub.js 内置 click 回调，统一走 rend.on('markClicked')
		EPUB_THOUGHT_UNDERLINE_CLASS, // SVG g 的 class/ref，便于 CSS 与 querySelector
		showLine
			? EPUB_THOUGHT_UNDERLINE_STYLES // 可见：琥珀色虚线
			: EPUB_THOUGHT_UNDERLINE_HIT_STYLES, // 不可见：透明 stroke，仅 rect 作点击热区
	); // underline 调用结束
	appliedRef.set(cfiRange, thoughtIds); // 记录已应用，卸载或 diff 时清理
} // for 绘制循环结束
```

**来源**：`apps/frontend/src/views/ebook/utils/epubThoughtAnnotations.ts`（`isCfiRangeStrictlyContained`，约 L508–L534）

```typescript
function isCfiRangeStrictlyContained(
	inner: string, // 待判断是否被包裹的 CFI（较短选区）
	outer: string, // 候选外层 CFI（较长选区）
	innerGroup: EbookThought[], // inner 对应的想法组（取 quote 做回退）
	outerGroup: EbookThought[], // outer 对应的想法组
	rend: Rendition, // 渲染实例
): boolean { // true 表示 inner 严格位于 outer 内部
	if (inner === outer) return false; // 完全相同不算「严格包含」

	const innerRange = resolveCfiDomRange(rend, inner); // 尝试在当前章节 iframe 解析为 DOM Range
	const outerRange = resolveCfiDomRange(rend, outer); // 解析外层 Range
	if (innerRange && outerRange) { // 两 Range 均可用
		return isDomRangeStrictlyContained(innerRange, outerRange); // DOM 精确比较
	} // if Range 分支结束

	const innerQuote = innerGroup[0]?.quote?.trim() ?? ''; // 内层摘录（DOM 不可用时）
	const outerQuote = outerGroup[0]?.quote?.trim() ?? ''; // 外层摘录
	if (!isQuoteStrictlyNested(innerQuote, outerQuote)) return false; // outer 须严格包含 inner 子串
	return extractCfiSpineHint(inner) === extractCfiSpineHint(outer); // 须同一 spine 章节，防跨章误判
} // isCfiRangeStrictlyContained 结束
```

**来源**：`apps/frontend/src/views/ebook/utils/epubThoughtAnnotations.ts`（`isDomRangeStrictlyContained`，约 L433–L447）

```typescript
function isDomRangeStrictlyContained(inner: Range, outer: Range): boolean { // DOM 层级严格包含判定
	const startsAfterOrEqual =
		inner.compareBoundaryPoints(Range.START_TO_START, outer) >= 0; // inner 起点不早于 outer 起点
	const endsBeforeOrEqual =
		inner.compareBoundaryPoints(Range.END_TO_END, outer) <= 0; // inner 终点不晚于 outer 终点
	if (!startsAfterOrEqual || !endsBeforeOrEqual) return false; // 任一边界不满足则非包含关系
	const sameStart =
		inner.compareBoundaryPoints(Range.START_TO_START, outer) === 0; // 起点是否重合
	const sameEnd = inner.compareBoundaryPoints(Range.END_TO_END, outer) === 0; // 终点是否重合
	return !(sameStart && sameEnd); // 起终点全同则为相等而非「严格包含」
} // isDomRangeStrictlyContained 结束
```

### 4.4 选区防误触 + 统一点击进列表

**来源**：`apps/frontend/src/views/ebook/utils/epubThoughtAnnotations.ts`（`attachThoughtMarkClickGuard`，约 L288–L350）

```typescript
function attachThoughtMarkClickGuard(rend: Rendition): () => void { // 返回卸载函数
	const contentCleanups = new Map<EpubIframeContents, () => void>(); // 各 iframe 解绑函数

	const onSelectionPointerDown = () => { // 选区开始回调
		setThoughtMarkPointerEvents('none'); // 选字开始时禁用下划线 SVG 的鼠标事件
	}; // onSelectionPointerDown 结束

	const onSelectionPointerUp = () => { // 选区结束回调
		setTimeout(() => setThoughtMarkPointerEvents('auto'), 0); // 下一轮宏任务再恢复，避免 mouseup 仍命中 mark
	}; // onSelectionPointerUp 结束

	const bindContents = (contents: EpubIframeContents) => { // 绑定单个 iframe document
		if (contentCleanups.has(contents)) return; // 同一 iframe 只绑定一次
		const doc = contents.document; // iframe 内 document
		doc.addEventListener('mousedown', onSelectionPointerDown, true); // 捕获阶段：正文按下即触发
		doc.addEventListener('touchstart', onSelectionPointerDown, true); // 触摸设备同理
		contentCleanups.set(contents, () => { // 登记解绑逻辑
			doc.removeEventListener('mousedown', onSelectionPointerDown, true); // 移除 mouse 监听
			doc.removeEventListener('touchstart', onSelectionPointerDown, true); // 移除 touch 监听
		}); // set cleanup 结束
	}; // bindContents 结束

	rend.hooks.content.register(bindContents); // 新章节 iframe 加载时自动 bind

	const existing = rend.getContents(); // 获取当前已挂载的章节 contents
	if (Array.isArray(existing)) { // 连续滚动等多 iframe 场景
		for (const item of existing) bindContents(item as EpubIframeContents); // 多 iframe 逐个绑定
	} else if (existing) { // 单 iframe 分页场景
		bindContents(existing as EpubIframeContents); // 单 iframe 直接绑定
	} // if existing 结束

	document.addEventListener('pointerup', onSelectionPointerUp, true); // 顶层松手统一恢复（mouseup 可能在 marks 层）
	document.addEventListener('touchend', onSelectionPointerUp, true); // 触摸松手同理

	return () => { // 组件卸载 / sync 清理时调用
		for (const fn of contentCleanups.values()) fn(); // 卸载时移除 iframe 监听
		contentCleanups.clear(); // 清空 Map
		document.removeEventListener('pointerup', onSelectionPointerUp, true); // 移除顶层 pointerup
		document.removeEventListener('touchend', onSelectionPointerUp, true); // 移除顶层 touchend
		setThoughtMarkPointerEvents('auto'); // 兜底恢复可点击
	}; // return cleanup 结束
} // attachThoughtMarkClickGuard 结束
```

**来源**：`apps/frontend/src/views/ebook/utils/epubThoughtAnnotations.ts`（`onMarkClicked`，约 L673–L687）

```typescript
const onMarkClicked = ( // epub.js markClicked 事件处理器
	cfiRange: string, // epub.js 传来的被点击批注 CFI
	data: { thoughtIds?: string[] }, // underline 注册时写入的 data
) => { // 处理器函数体
	if (hasTextSelectionInRend(rend)) return; // 用户仍在选区中则不打开面板（双保险）
	const ids = data?.thoughtIds ?? []; // 优先用 mark 上携带的 id 列表
	const matched = // 解析本次点击应对应的想法数组
		ids.length > 0
			? thoughts.filter((t) => ids.includes(t.id)) // 精确匹配该 mark 下的想法
			: thoughts.filter((t) => t.cfiRange === cfiRange); // 兜底：按 CFI 字符串匹配
	if (matched.length === 0) return; // 无匹配则忽略
	handlers.onThoughtGroupClick(matched); // 统一打开列表（即使只有 1 条）
}; // onMarkClicked 结束
```

**来源**：`apps/frontend/src/views/ebook/read.tsx`（`openThoughtGroup`，约 L210–L214）

```typescript
const openThoughtGroup = useCallback((group: EbookThought[]) => { // 下划线点击后的统一入口
	if (group.length === 0) return; // 空组不处理
	setThoughtListGroup(group); // 写入列表面板数据源
	setThoughtListOpen(true); // 打开 EpubThoughtList（单条也先列表）
}, []); // 无外部依赖，回调引用稳定
```

### 4.5 SVG patch 与隐藏内层线

**来源**：`apps/frontend/src/views/ebook/utils/epubThoughtAnnotations.ts`（`patchThoughtUnderlineMarks`，约 L123–L177）

```typescript
function patchThoughtUnderlineMarks(root: ParentNode = document): void { // 修正 SVG 下划线 DOM
	const groups = root.querySelectorAll( // 查询所有想法 underline 的 g 分组
		`g.${EPUB_THOUGHT_UNDERLINE_CLASS}, g[ref="${EPUB_THOUGHT_UNDERLINE_CLASS}"]`, // class 或 ref 匹配
	); // querySelectorAll 结束

	groups.forEach((g) => { // 逐个 g 分组处理
		const showLine =
			(g as SVGElement).dataset.showLine !== '0'; // dataset.showLine='0' 表示仅命中、不画线
		const rects = g.querySelectorAll('rect'); // marks-pane 用 rect 表示文字块热区
		const lines = g.querySelectorAll('line'); // 实际可见下划线

		rects.forEach((rect) => { // 每个 rect 仅作点击热区
			rect.setAttribute('stroke', 'transparent'); // 去掉 rect 描边，防 marks-pane 默认虚线框
			rect.setAttribute('stroke-width', '0'); // 描边宽度归零
			rect.setAttribute('fill', 'none'); // rect 不参与填充，仅作点击区域
		}); // rects.forEach 结束

		lines.forEach((line, index) => { // 每条 line 与同 index 的 rect 配对
			const rect = rects[index]; // 与同序 rect 配对（换行时段落有多 rect/line）
			if (rect) { // 有对应 rect 时根据 rect 几何计算线位置
				const x = Number.parseFloat(rect.getAttribute('x') ?? '0'); // rect 左上角 x
				const y = Number.parseFloat(rect.getAttribute('y') ?? '0'); // rect 左上角 y
				const width = Number.parseFloat(rect.getAttribute('width') ?? '0'); // rect 宽度
				const height = Number.parseFloat(rect.getAttribute('height') ?? '0'); // rect 高度
				const lineY = y + height + THOUGHT_LINE_OFFSET_PX; // 下划线画在文字底边下方 1px
				line.setAttribute('x1', String(x)); // 线起点 x
				line.setAttribute('x2', String(x + width)); // 线终点 x，与 rect 同宽
				line.setAttribute('y1', String(lineY)); // 线起点 y
				line.setAttribute('y2', String(lineY)); // 线终点 y（水平线）
			} // if rect 结束

			if (!showLine) { // 内层被包含选区：不绘制可见线
				line.setAttribute('stroke', 'transparent'); // 线 stroke 透明
				line.setAttribute('stroke-opacity', '0'); // 完全不可见
				return; // 跳过后续可见样式
			} // if !showLine 结束

			line.setAttribute('stroke', THOUGHT_LINE_COLOR); // 琥珀色 #d97706
			line.setAttribute('stroke-opacity', THOUGHT_LINE_OPACITY); // 0.55 半透明
			line.setAttribute('stroke-width', '1'); // 1px 细线
			line.setAttribute('stroke-dasharray', THOUGHT_LINE_DASHARRAY); // 1 6 细虚线
			line.setAttribute('stroke-linecap', 'round'); // 虚线端点圆角
		}); // lines.forEach 结束
	}); // groups.forEach 结束
} // patchThoughtUnderlineMarks 结束
```

### 4.6 阅读页：拉取、保存、列表回退

**来源**：`apps/frontend/src/views/ebook/read.tsx`（约 L152–L214）

```typescript
// 进入阅读页或切换书籍时，按 bookId 拉取全书想法
useEffect(() => { // 副作用：拉取服务端想法列表
	if (!bookId) return; // 无书籍 id 不请求
	let cancelled = false; // 竞态标记：组件卸载或 bookId 变化时忽略旧响应
	void fetchEbookThoughts(bookId) // 调用 GET /ebook/thoughts/:bookId
		.then((list) => { // 请求成功
			if (!cancelled) setThoughts(list); // 写入状态，触发 EpubPane 下划线同步
		}) // then 结束
		.catch((e) => { // 请求失败
			if (cancelled) return; // 已卸载则不 Toast
			Toast({ type: 'error', title: t('ebook.read.thought.loadFailed'), message: getRequestErrorMessage(e) }); // 拉取失败提示
		}); // catch 结束
	return () => { // effect cleanup
		cancelled = true; // 标记取消，防止 setState on unmounted
	}; // cleanup 结束
}, [bookId, t]); // bookId 变化重新拉取；t 用于 i18n 错误文案

const openViewThought = useCallback( // 打开想法详情面板
	(thought: EbookThought, // 要查看/编辑的想法
	fromList = false, // 是否从列表面板点进（决定关闭详情后是否回到列表）
) => { // 回调函数体
	if (fromList) { // 从列表进入详情
		returnToListCfiRef.current = thought.cfiRange; // 记住 CFI，关闭详情后恢复列表
		setThoughtListOpen(false); // 暂时关闭列表，避免列表与详情同屏叠层
	} else { // 非列表路径（如将来扩展直达详情）
		returnToListCfiRef.current = null; // 清空 ref，关闭详情不回列表
	} // if fromList 结束
	setThoughtDraft({ // 写入详情面板受控表单
		id: thought.id, // 想法 id，编辑/删除时用
		quote: thought.quote, // 原文摘录
		cfiRange: thought.cfiRange, // CFI，保存时不变
		content: thought.content, // 想法正文
		username: thought.username, // 展示用用户名
		updatedAt: thought.updatedAt, // 最后更新时间
	}); // setThoughtDraft 结束
	setThoughtDialogMode('view'); // 只读查看模式（可切 edit）
	setThoughtDialogOpen(true); // 打开 EpubThought（右侧分栏详情）
	}, // useCallback 函数体结束
	[], // 空依赖：回调稳定
); // openViewThought 结束

// 详情面板关闭后：若来自列表则重新打开同 CFI 的想法列表
useEffect(() => { // 监听详情关闭 + thoughts 变化
	if (thoughtDialogOpen) return; // 详情仍打开时不处理
	const cfiRange = returnToListCfiRef.current; // 读取关闭前要回到的 CFI
	if (!cfiRange) return; // 非列表路径进入则跳过
	returnToListCfiRef.current = null; // 消费 ref，避免重复打开
	const next = thoughts.filter((t) => t.cfiRange === cfiRange); // 按 CFI 筛同段想法
	if (next.length > 0) { // 该段仍有想法（可能删到 0 条）
		setThoughtListGroup(next); // 刷新列表数据（含编辑/删除后的最新 thoughts）
		setThoughtListOpen(true); // 再次打开列表面板
	} // if next.length 结束
}, [thoughtDialogOpen, thoughts]); // 依赖 thoughts：删除最后一条后 next 为空则不打开
```

---

## 5. 兼容性与影响

| 项 | 说明 |
|----|------|
| 登录 | 未登录调用想法 API 会 401；阅读 EPUB 本身不强制登录，写想法需登录。 |
| 存储 | 想法在服务端；**不**再使用 localStorage。 |
| 删书 | 该书下当前用户想法一并删除。 |
| PDF | 无想法 UI；`read.tsx` 仅在 `book.fmt === 'epub'` 时挂载右侧分栏想法面板。 |
| 重叠选区 | **嵌套**（子串/包含）只显示最外层一条可见线；**部分相交**时重叠段只画一条虚线（patch 层 blocker，见 [epub-thought-partial-overlap.md](./epub-thought-partial-overlap.md)）。 |
| 性能 | 想法按 CFI 去重绘制；SVG patch 在 `content`/`relocated` 触发；一般单书想法量可接受。 |

---

## 6. 建议回归

1. EPUB 选中文字 → 右键「写想法」→ 保存 → 出现琥珀虚线下划线。
2. 同段写第二条 → 仍一条可见下划线 → 点击**先出列表**（含仅 1 条）→ 进详情 → 关闭回到列表。
3. 对「黑美人」「傻皇帝与黑美人」「一 傻皇帝与黑美人」分别写想法 → 整句**仅一条**可见虚线 → 点「黑美人」出短选区列表、点仅长选区覆盖处出对应列表。
4. 拖动选字结束**不**打开想法列表；**主动点击**下划线才打开。
5. 编辑 / 删除想法后下划线与列表同步。
6. 删书后重新打开：该书记录与下划线均消失。
7. 深色 / 浅色阅读背景、连续滚动与分页模式下划线可见且可点。

---

## 7. 相关源码路径

| 说明 | 路径 |
|------|------|
| 实体 | `apps/backend/src/services/ebook/ebook-thought.entity.ts` |
| 服务 / 级联删 | `apps/backend/src/services/ebook/ebook.service.ts` |
| 控制器 | `apps/backend/src/services/ebook/ebook.controller.ts` |
| 下划线同步 | `apps/frontend/src/views/ebook/utils/epubThoughtAnnotations.ts` |
| 阅读页状态机 | `apps/frontend/src/views/ebook/read.tsx` |
| 详情 / 列表面板 | `apps/frontend/src/views/ebook/components/EpubThought.tsx`、`EpubThoughtList.tsx`、`EpubThoughtPanelShell.tsx`、`EpubThoughtParts.tsx` |

若与仓库最新源码不一致，以源码为准。
