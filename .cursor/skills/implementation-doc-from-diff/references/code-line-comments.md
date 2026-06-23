# 专题实现文 — 逐行上方讲解注释（100% 覆盖）

围栏代码块内的**每一条源码行**（改动前块与改动后块均适用）须在**紧邻上一行**放置一行**详细**讲解注释。细则与 `SKILL.md` 硬约束 §2、工作流 §3 一致。

## 1. 硬约束：100% 逐行覆盖

| 原则 | 说明 |
| ---- | ---- |
| **每一行源码、一行上方注释** | 除 §6 豁免外，代码块内**每一个物理源码行**的正上一行必须是讲解注释。**禁止**只注释「关键行」「首行」「改动行」而跳过其余行。 |
| **注释在上、代码在下** | 讲解写在源码**上一行**；禁止行尾 inline（仓库自带行尾注释除外）。 |
| **改动前 / 改动后均须 100%** | 两侧各自完整逐行注释；不得因「与另一侧相同」而省略。 |
| **「详细」** | 每条注释须让读者理解**该行本身**：结构角色（声明/分支/闭合等）、运行时行为或数据、与上下游关系；改动后块还须点出相对基线的变化（若适用）。禁止空洞套话（见 §4）。 |
| **中文** | 统一中文；英文术语可保留，首次出现可加括号释义。 |
| **不改写源码正文** | 讲解为文档层追加行；下方源码与对应版本一致。 |
| **禁止「讲解：」前缀** | 直接写注释正文，不加 `讲解：`、`说明：` 等（见 §2）。 |

### 1.1 何谓「源码行」（须注释）

围栏代码块内，**除去** §6 豁免项外，凡**不是**文档层讲解注释行的每一物理行，均属源码行，**必须**有其正上一行讲解注释。

常见**仍须注释**、易被漏掉的行类型（**全部**须覆盖，非择要）：

- 函数 / 方法 / 箭头函数**声明行**与**每个参数行**、返回类型行、`{` 开块行
- **每个** `if` / `for` / `while` / `try` / `catch` / `switch` 行及体内**每一行**
- **每个** `return`、赋值、`const` / `let`、表达式语句行
- 多行调用的**每一行**（含 `(`, 实参行, `)`, `;`）
- 链式调用每一行（`.map(`, 回调参数行, `)`, `.filter(` …）
- 对象 / 数组字面量**每个属性行**、`{` / `}` 闭合行
- **`return { … }` 配置对象**：`labels`、`hasHighlight` 等**每个属性键行**（含 `key: value` 与 `key: () =>` 箭头属性行）
- **对象方法 / 回调属性**（`onCopy`、`onUnderline`、`onRemoveUnderline`、`onWriteThought`、`onAskBook` 等）：**属性行本身**正上一行须注释；箭头函数体**开 `{` 行、体内每一行、闭合 `}`** 均须注释；多行箭头函数（`() =>` 与实参分行）**每一行**须注释
- **`useMemo` / `useCallback` 依赖数组** `[` 行、**每个依赖项行**、`]` 与 `});` 闭合行
- **每个**单独出现的 `}`、`});`、`},`、`];`、`);` 等闭合行
- JSX/TSX：**开标签行、每个属性行、`>`、子节点行、`</…>`、`/>`**
- `useMemo` / `useEffect` 的 `}, [deps]);` **整行**
- 类型断言、内联 `interface` / `type` 对象的**每一行**

### 1.2 机械判定（落盘前必做）

对每个围栏代码块**自上而下扫描**：

1. 若当前行是**空行**（仅空白）→ 跳过。
2. 若当前行是**文档层讲解注释**（去缩进后以 `//`、`#` 开头，或整行为 `/* … */`）→ 跳过。
3. 否则视为**源码行** → **上一行**必须是讲解注释（步骤 2 那种行）。若上一行是空行或源码行 → **不合格，须补注释**。

**禁止**在未达 100% 覆盖时结束步骤 3 / 落盘专题文。

### 1.3 `useMemo` 返回对象与回调属性（高频漏注）

`const xxxQuoteActions = useMemo(() => { … return { … }; }, [deps])` 类摘录中，**下列行极易被漏注，须逐项检查**：

| 须注释的行 | 说明 |
| ---------- | ---- |
| `return {` | 返回配置对象开块 |
| `labels: …` | 每个非回调属性行 |
| `hasHighlight: …` 及多行调用每一行 | 含 `(`, 实参行, `),` |
| **`onCopy:` / `onUnderline:` / … 每个回调属性行** | **禁止**只注释 `hasHighlight` 而裸贴 `onCopy` 等（常见不合格模式） |
| 回调内 `if` / `return` / `setState` / `setTimeout` 等 | 箭头函数体内**每一行** |
| `},` / `};` | 对象与 `useMemo` 回调闭合 |
| `[` / 每个 `thoughtDraft.quote` 等依赖项 / `]);` | 依赖数组**每一行** |

**不合格反例**（仅 `hasHighlight` 有上一行注释，`onCopy`～`onAskBook` 及 deps **均无**注释——**禁止落盘**）：

```typescript
	return {
		labels: thoughtDrawerLabels,
		// 与 PopBar 统一的 full 覆盖判定
		hasHighlight: isSelectionFullyHighlighted(/* … */),
		onCopy: () => void copyToClipboard(thoughtDraft.quote),
		onUnderline: () =>
			openHighlightPopBarAtBookContent(cfiRange, thoughtDraft.quote, {
				ensureHighlight: true,
			}),
		onRemoveUnderline: () =>
			void removeHighlightForQuote(cfiRange, thoughtDraft.quote),
		onWriteThought: () => { /* … 体内每一行也须有上一行注释 … */ },
		onAskBook: () => { /* … */ },
	};
}, [
	thoughtDraft.quote,
	thoughtDraft.cfiRange,
	/* … 每个依赖项行均须有上一行注释 … */
]);
```

**合格方向**：对上述**每一源码行**补上一行注释；若回调与基线**完全相同**且篇幅过长，可改用具上一行说明的**对称** `// ... onCopy 等 N 个回调与基线相同` **单行省略**代替展开——**禁止**展开写出却不对每行注释。

## 2. 注释写法

- 语法与 `lang` 一致：TS/JS/TSX → `// …`；Python/Shell → `# …`；CSS → `/* … */`。
- **禁止** `讲解：`、`说明：`、`注：` 前缀。
- `// ...` / `// ...（未改动）` **省略行本身**上方也须一行注释，说明省略范围与原因。

## 3. 「详细」与禁止的空洞注释

每条注释至少满足其一（最好多条）：

- 该行**执行什么**、读写哪些变量 / props
- 该行在**控制流**中的作用（进入/退出哪个分支、为何在此 return）
- 与**本次改动**的关系（新增/删除/替换的行为）
- 与**上下游**的衔接（数据从哪来、传给谁）

**禁止**作为唯一内容的空洞套话（须改写为具体说明）：

| 不合格 | 应改为（示例方向） |
| ------ | ------------------ |
| `// 条件判断` | `// cluster 为空时提前 return，不挂载引用操作条` |
| `// 闭合当前块` | `// 结束 union 对齐分支，未命中则落到下方回退 return` |
| `// 结束函数调用` | `// 将 chapterHighlights 与 subject 传入覆盖度 API` |
| `// 获取变量` | `// 从 epubNavRef 取当前 rendition，无则 undefined` |

## 4. 禁止的偷懒模式

- **只注释函数头 + 改动行**，中间 `}`、参数行、链式调用中间行无注释。
- **一块注释管多行**：上方一条注释后连续多行源码而无各自上一行注释。
- **只注释 diff 行**：基线块中未改行也须注释。
- **用 `// ...` 整段代替逐行**：仅当该段在前后块**对称**且确实未改；省略行仍须上一行说明；**不得**用省略逃避须逐行展示的行。
- **只注释 `hasHighlight` 等 diff 字段**：`return` 对象中 `onCopy` / `onUnderline` / `onWriteThought` 等回调属性行及体内每一行、依赖数组每个元素行**同样须注释**（见 §1.3）；**禁止**裸贴一长串回调方法。

## 5. 完整示例（每一源码行均有上一行注释）

```typescript
// 导出：为侧栏划线判定解析与展示一致的 CFI + quote
export function getThoughtClusterHighlightSubject(
	// 入参：当前点击聚合后的 cluster（含 quoteGroups、selectedThoughtId）
	cluster: EbookThoughtClickCluster,
	// 入参：EPUB rendition，用于 DOM 并集与 CFI 回写；可选
	rend?: Rendition,
// 返回类型：划线 subject 所需的 CFI 范围与 quote 文本
): { cfiRange: string; quote: string } {
	// 引用区实际展示的 quote 文本（trim 去首尾空白）
	const quote = getThoughtClusterDisplayQuote(cluster).trim();
	// 与展示 quote 默认配对的 CFI（单条或 primary）
	const cfiRange = getThoughtClusterDisplayCfi(cluster);
	// 无 rendition 或无 quote 时无法做 DOM 并集，直接返回 display 侧数据
	if (!rend || !quote) return { cfiRange, quote };

	// 多分组聚合展示且未选中单条想法时，尝试用 DOM 并集得到准确 subject
	if (cluster.quoteGroups.length > 1 && !cluster.selectedThoughtId) {
		// 将每个 quoteGroup 的 CFI 解析为 DOM Range 列表
		const ranges = cluster.quoteGroups
			// 对每个分组 CFI 调用 resolveCfiDomRange
			.map((group) => resolveCfiDomRange(rend, group.cfiRange))
			// 滤掉解析失败的 null，收窄为 Range[]
			.filter((range): range is Range => range !== null);
		// 合并多个 Range 为覆盖所有分组的并集
		const union = mergeDomRangeUnion(ranges);
		// 并集 Range 对应的纯文本，用于与展示 quote 比对
		const unionQuote = union?.toString().trim();
		// 并集存在、有文本且与展示 quote 完全一致时才采用并集 CFI
		if (union && unionQuote && unionQuote === quote) {
			// 将 DOM 并集反写为 EPUB CFI 字符串
			const unionCfi = cfiFromDomRange(rend, union);
			// 反写成功则返回并集侧的 subject
			if (unionCfi) {
				// 返回并集 CFI 与并集 quote 作为划线 subject
				return { cfiRange: unionCfi, quote: unionQuote };
			// 结束 if (unionCfi) 分支
			}
		// 结束 if (union 对齐) 分支
		}
	// 结束 if (multi-group 并集) 分支
	}

	// 并集不可用或未与展示 quote 对齐时，回退 display 侧的 CFI + quote
	return { cfiRange, quote };
// 结束 getThoughtClusterHighlightSubject 函数体
}
```

## 6. 不必注释的行（唯一豁免）

- 代码块内的**纯空行**（仅空白字符）。
- **文档层讲解注释行**本身（即 `// …` / `# …` 那些行）。
- 围栏外的 Markdown 正文。

**注意**：源码中的空行**上方可不注释**；但空行**下方**若紧跟源码行，该源码行仍须有上一行注释（注释在空行之前紧贴该源码行）。

## 7. 与源码自带注释的关系

- 仓库已有注释保留在源码行上或原位置。
- 文档讲解一律在源码**上方**额外一行追加；若与源码注释重复，上方可写「见下行源码注释」并补 diff 语境。

## 8. Agent 自检（逐行注释专项，全部须勾选）

- [ ] 每个代码块是否已做 §1.2 **自上而下扫描**，源码行上一行均为讲解注释？
- [ ] 是否达到 **100%** 覆盖（非「大部分」「关键行」）？
- [ ] `return { … }` 内 **每个属性行**（含 `onCopy` / `onUnderline` 等回调）及回调**体内每一行**、**deps 每个元素行**是否均已注释（§1.3）？
- [ ] 是否无「一块注释管多行」？
- [ ] 是否无空洞套话（§3 表）？
- [ ] 文档层注释是否未使用 `讲解：` / `说明：` 前缀？
- [ ] 改动前、改动后两块是否**各自**完整逐行注释？
- [ ] 源码正文是否与对应版本一致？
