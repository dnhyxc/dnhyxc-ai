# 专题实现文 — 逐行上方讲解注释

围栏代码块内（**改动前**与**改动后**均适用）对**每一行非空、非纯花括号**的源码，在**紧邻上一行**写详细中文注释。与 `SKILL.md` 硬约束 §2、工作流 §3 一致；要求见下文。

## 1. 硬约束：100% 覆盖（非空、非纯花括号）

| 原则 | 说明 |
| ---- | ---- |
| **覆盖范围** | 代码块内**每一个**非空、且**不是**纯花括号/纯闭合行的源码行，正上一行必须有讲解注释。**禁止**只注释「关键行」「首行」「改动行」。 |
| **注释内容** | 须同时说清 **「做了什么」** + **「为什么这么做」**（意图、边界、与上下游/本次改动的关系）。禁止废话式注释（如「赋值变量」「条件判断」）。 |
| **位置** | 注释在源码**上方**，不是行尾（仓库自带行尾注释除外）。 |
| **改动前 / 后均须满覆盖** | 两侧各自完整；不得因「与另一侧相同」而省略。 |
| **中文** | 统一中文；英文术语可保留，首次可加括号释义。 |
| **不改写源码正文** | 讲解为文档层追加行；下方源码与对应版本一致。 |
| **禁止前缀** | 不加 `讲解：`、`说明：`、`注：`。 |

### 1.1 必须逐行注释的行类型

下列行**一律**须有上一行注释（含但不限于）：

- **import** 语句
- **变量声明**（`const` / `let` / `var`）
- **函数 / 方法声明行**、**每个参数行**、返回类型行
- **return** 语句
- **条件判断**（`if` / `else` / `switch` / `case`）
- **循环**（`for` / `while` / …）
- **方法 / 函数调用**（含链式调用每一行有实参或调用语义的行）
- **对象 / 数组**多行字面量的**每个属性 / 元素行**
- **装饰器**（`@Decorator`）
- **类型声明**（`type` / `interface` 及成员行）
- JSX/TSX：**带逻辑的属性行**、含表达式的子节点行；纯展示开闭标签也建议短注释角色（见 §5 示例）

另须覆盖本仓库高频漏注（见 §1.3）：`return { … }` 内每个回调属性、回调体内、`useMemo` deps 等。

### 1.2 豁免（可不加注释）

- **纯空行**（仅空白）。
- **纯花括号 / 纯闭合行**（去空白后仅为）：`{`、`}`、`},`、`};`、`]);`、`);`、`];`、`)` 等**无标识符、无表达式**的结构闭合。
- **文档层讲解注释行**本身。
- 围栏外的 Markdown 正文。

**注意**：豁免闭合行**下方**若紧跟须注释的源码行，该行仍须在其正上方有注释（可紧贴在闭合行之后）。

### 1.3 机械判定（落盘前必做）

对每个围栏代码块**自上而下扫描**：

1. 空行 → 跳过。
2. 文档层讲解注释（去缩进后以 `//`、`#` 开头，或整行 `/* … */`）→ 跳过。
3. 纯花括号 / 纯闭合行（§1.2）→ 跳过。
4. 否则为**须注释源码行** → **上一行**必须是讲解注释。若上一行是空行、源码行或另一源码行 → **不合格，须补注释**。

未达覆盖不得落盘。

### 1.4 `useMemo` 返回对象与回调属性（高频漏注）

| 须注释的行 | 说明 |
| ---------- | ---- |
| `return {` | 返回配置对象开块（有语义，**不**算纯花括号豁免） |
| `labels:` / `hasHighlight:` 等 | 每个非回调属性行 |
| **`onCopy:` / `onUnderline:` / …** | 每个回调属性行；**禁止**只注释 diff 字段而裸贴其余回调 |
| 回调体内 `if` / `return` / 调用等 | 体内**每一行**非豁免源码 |
| `[` 后每个依赖项 | deps **每个元素行**（`[` / `]` / `});` 若为纯闭合可豁免） |

**不合格**：仅 `hasHighlight` 有注释，后面一长串 `onCopy`～`onAskBook` 与 deps 裸贴。  
**合格替代**：回调与基线完全相同且过长时，用对称 `// ... onCopy 等 N 个回调与基线相同` **单行省略**（省略行上方仍须说明范围）——禁止展开写出却不注释。

## 2. 注释写法

- 语法随 `lang`：TS/JS/TSX → `//`；Python/Shell → `#`；CSS → `/* … */`。
- 一条注释可拆成两行 `//`（先「做什么」、再「为什么」），仍算覆盖其下那一行源码。
- `// ...` / `// ...（未改动）` 省略行上方也须一行注释，说明省略范围与原因。

## 3. 「做什么 + 为什么」与禁止的空洞注释

每条注释至少包含：

1. **做什么**：该行执行的动作 / 读写的数据  
2. **为什么**：意图、边界、相对改动前的变化、或上下游衔接（能从图上下文看懂的可略写，但不可只剩空标签）

**禁止**作为唯一内容的废话（须改写）：

| 不合格 | 应改为（示例方向） |
| ------ | ------------------ |
| `// 赋值变量` | `// 缓存 rendition，避免多次读 ref；无则后续无法解析 CFI` |
| `// 条件判断` | `// cluster 为空时提前 return，不挂载引用操作条` |
| `// 闭合当前块` | （纯 `}` 已豁免；若有语义的 `return {` 则写返回意图） |
| `// 导入模块` | `// 从 React 导入 useState，用于组件内计数状态` |
| `// 调用函数` | `// 将 chapterHighlights 与 subject 传入覆盖度 API，判定是否满覆盖` |

## 4. 禁止的偷懒模式

- 只注释函数头 + 改动行，中间参数行、链式实参行、对象属性行无注释。
- **一块注释管多行**：一条注释后连续多行须覆盖源码而无各自上一行注释。
- 只注释 diff 行：基线块未改行同样须注释。
- 用 `// ...` 逃避须展示且须注释的行（对称未改段除外）。
- 对纯 `}` 写「结束 xxx 分支」凑数——**应豁免，不要注水**。

## 5. 正确示例

### 5.1 简明示例（做什么 + 为什么）

```typescript
// 从 React 导入 useState Hook，用于管理组件内部的状态
import { useState } from 'react';

// 定义并导出默认计数器组件；initialValue 可配，便于复用
export default function Counter({ initialValue = 0 }) {
	// 创建 count 状态与 setCount；初始值来自 props，保证可配置
	const [count, setCount] = useState(initialValue);

	// 点击增加：用函数式更新，避免连续点击时闭包读到过期 count
	const handleIncrement = () => setCount((prev) => prev + 1);

	// 渲染当前计数与增加按钮；点击绑定 handleIncrement
	return (
		// 根容器：包裹文案与按钮
		<div>
			{/* 展示当前计数值 */}
			<p>Count: {count}</p>
			{/* 触发 handleIncrement */}
			<button onClick={handleIncrement}>+</button>
		</div>
	);
}
```

（TSX 中亦可用 `//` 写在标签上一行，与 `lang` 一致即可；空行与纯 `}` 无注释。）

### 5.2 业务摘录方向（完整符号 + 逐行）

```typescript
// 导出：解析与展示一致的 CFI + quote，供侧栏划线判定
export function getThoughtClusterHighlightSubject(
	// 入参：聚合后的 cluster（quoteGroups / selectedThoughtId）
	cluster: EbookThoughtClickCluster,
	// 入参：rendition，用于 DOM 并集与 CFI 回写；可选
	rend?: Rendition,
): { cfiRange: string; quote: string } {
	// 取展示用 quote 并 trim，作为比对基准
	const quote = getThoughtClusterDisplayQuote(cluster).trim();
	// 默认配对的 display CFI（单条或 primary）
	const cfiRange = getThoughtClusterDisplayCfi(cluster);
	// 无 rendition 或无 quote 时无法做 DOM 并集，直接回退 display 侧
	if (!rend || !quote) return { cfiRange, quote };

	// 多分组且未选中单条时，尝试 DOM 并集得到更准的 subject
	if (cluster.quoteGroups.length > 1 && !cluster.selectedThoughtId) {
		// 将各分组 CFI 解析为 Range，滤掉失败项后求并集
		const ranges = cluster.quoteGroups
			.map((group) => resolveCfiDomRange(rend, group.cfiRange))
			.filter((range): range is Range => range !== null);
		const union = mergeDomRangeUnion(ranges);
		const unionQuote = union?.toString().trim();
		// 并集文本与展示 quote 完全一致才采用并集 CFI，避免错划
		if (union && unionQuote && unionQuote === quote) {
			const unionCfi = cfiFromDomRange(rend, union);
			if (unionCfi) {
				return { cfiRange: unionCfi, quote: unionQuote };
			}
		}
	}

	// 并集不可用或未对齐时，回退 display 侧 CFI + quote
	return { cfiRange, quote };
}
```

（上例中单独的 `}` 行无注释，符合 §1.2；`map` / `filter` 行若拆成多行则每行须注。）

## 6. 与源码自带注释的关系

- 仓库已有注释保留在原位置。
- 文档讲解在源码**上方**追加；若重复，上方可写「见下行源码注释」并补 diff 语境（相对基线改了什么）。

## 7. Agent 自检（逐行注释专项）

- [ ] 是否已做 §1.3 扫描：非空、非纯闭合行上一行均为讲解注释？
- [ ] 注释是否含 **做什么 + 为什么**，无「赋值变量」类废话？
- [ ] 是否覆盖 import / 声明 / 参数 / return / 分支 / 循环 / 调用 / 对象属性 / 装饰器 / 类型（§1.1）？
- [ ] `return { … }` 回调属性与 deps 是否无漏注（§1.4）？
- [ ] 是否无「一块注释管多行」？是否未对纯 `}` 注水？
- [ ] 改动前、改动后是否**各自**满覆盖？
- [ ] 是否无 `讲解：` / `说明：` 前缀？源码正文是否与对应版本一致？
