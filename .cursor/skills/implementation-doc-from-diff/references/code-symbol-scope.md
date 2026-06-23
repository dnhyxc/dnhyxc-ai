# 专题实现文 — 代码摘录的符号边界（完整定义）

围栏代码块须从**符号声明行**起笔，到该符号**闭合**为止，让读者能一眼看出「这是哪个函数 / hook / 组件 / 常量」。禁止只贴函数体内部、hook 回调内部或 `return` 对象片段而无外层定义。细则与 `SKILL.md` 硬约束 §2、工作流 §3、`code-before-after.md` 一致。

## 1. 基本原则

| 原则 | 说明 |
| ---- | ---- |
| **完整符号边界** | 摘录须包含**声明 + 主体 + 闭合**（如函数从 `function foo` / `export function foo` 到匹配 `}`；`useMemo` 从 `const x = useMemo(() => {` 到 `}, [deps]);`）。 |
| **小节标题对齐符号名** | `### 4.x \`thoughtListQuoteActions\`` 时，代码块内**必须**出现同名 `const thoughtListQuoteActions = …`（或等价声明），不得只有 `if (!cluster) return null` 等内层语句。 |
| **对比范围含同一外壳** | 改动前、改动后须是**同一符号**的完整定义；内层 diff 行须在该符号边界内对齐可见。 |
| **与「对比范围」正文一致** | `**对比范围**` 若写「`useMemo` 内 …」，代码块仍须含 `useMemo` 声明与依赖数组，而非仅回调体。 |

## 2. 按符号类型的起止边界

| 类型 | 须包含（起 → 止） | 禁止 |
| ---- | ----------------- | ---- |
| **函数 / 方法** | `export function foo(…)` 或 `const foo = (…) =>` → 函数体闭合 `}` | 仅从第一个 `if` / `const` 起笔 |
| **`useMemo` / `useCallback`** | `const name = useMemo(() => {` → `}, [deps]);` 或 `useCallback` 闭合 | 仅 `useMemo` 回调内部语句 |
| **React 组件** | `function Component(…)` / `const Component = …` → 组件函数闭合；或完整 JSX 根元素一对标签 | 仅组件内某个 `return` 分支片段且无组件名 |
| **`useEffect` 等 hook 注册** | `useEffect(() => {` → `}, [deps]);` | 仅 effect 回调体 |
| **类** | `class Foo {` → 类闭合 `}`；方法对比时仍须含方法签名行 | 仅方法体且无 `methodName(` 行 |
| **对象 / 配置导出** | `export const config = {` → `};`（或对称摘录 + `// ...`） | 仅对象内个别属性且无 `config` 声明 |
| **接口 / type**（若本次改动） | `interface X {` / `type X =` → 闭合 | 仅个别字段行 |

## 3. 反例与正例

### 3.1 反例：仅函数体 / 回调体（禁止）

小节标题为 `thoughtListQuoteActions`，但代码从 `if` 起笔——**缺少** `const thoughtListQuoteActions = useMemo(...)`：

```typescript
// ❌ 禁止：读者无法对应到源码中的符号
if (!thoughtListCluster) return null;
const quote = getThoughtClusterDisplayQuote(thoughtListCluster);
// ...
return { hasHighlight: Boolean(highlight) };
```

### 3.2 正例：完整 `useMemo` 符号

```typescript
// ✅ 从声明到依赖数组闭合
const thoughtListQuoteActions = useMemo(() => {
  // 无 cluster 时不渲染引用操作条
  if (!thoughtListCluster) return null;
  // …
  return {
    labels: thoughtDrawerLabels,
    hasHighlight: isSelectionFullyHighlighted(/* … */),
    // onCopy 等回调与基线相同，略
    // ... onCopy / onUnderline / onRemoveUnderline / onWriteThought / onAskBook
  };
}, [
  // 依赖项与基线相同，略
  // ... thoughtListCluster, highlights, …
]);
```

### 3.3 反例：仅 `return` 对象片段（禁止）

```typescript
// ❌ 禁止：缺少 useMemo 外壳与 hasHighlight 前的 subject 获取逻辑
return {
  labels: thoughtDrawerLabels,
  hasHighlight: isSelectionFullyHighlighted(/* … */),
};
```

## 4. 摘录与 `// ...` 的配合

- **允许**在符号边界**内部**用 `// ...` 省略与 diff 无关、且前后对称的尾部（如未改动的回调、`deps` 列表）。
- **禁止**用省略代替**符号声明行**或**依赖数组闭合**（`}, […]);`）——除非整段 `useMemo` 完全未改且该对比组不写此符号（一般不成立）。
- 省略行仍须上一行讲解注释（见 `code-line-comments.md`）。

## 5. 纯新增符号

纯新增函数 / 常量：改动后块须从**首行声明**写到闭合；改动前无块。示例见 `code-before-after.md` §4。

## 6. Agent 自检（符号边界专项）

- [ ] 每个代码块是否从**符号声明**起笔（而非内层 `if` / `return`）？
- [ ] `useMemo` / `useCallback` / `useEffect` 是否含 `}, [deps]);` 闭合？
- [ ] 小节标题中的符号名是否在代码块内**可见**？
- [ ] 改动前、改动后是否为**同一符号**的完整定义对比？
- [ ] `**对比范围**` 描述是否与代码块实际起止一致？
