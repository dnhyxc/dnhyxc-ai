# Monaco Markdown 编辑器：中文 IME 重影 / 叠字问题与解决方案

本文记录知识库等页面使用 `@monaco-editor/react` + 透明主题编辑 Markdown 时，**中文输入法（IME）** 出现**重影、拼音与汉字叠画、仅首行正常换行后必现**等问题的**成因**与**最终解决办法**，便于后续维护与排查。

---

## 1. 现象归纳

| 现象 | 说明 |
|------|------|
| 拼音/汉字叠在一起 | 输入过程中同一位置像画了两次字 |
| 受控模式下更明显 | 向 `<Editor>` 传 `value` + 库自带 `onChange` 时尤甚 |
| 仅首行正常、回车后每行都重影 | 与多行后的折行、布局重算强相关 |
| 换应用主题后偶发重影 | 全透明 `editor.background` 与页面背景同时变化时合成层更易错位 |

---

## 2. 根因分析（分层）

### 2.1 受控 `value` 与库内全文同步

`@monaco-editor/react` 在传入**非 undefined 的 `value`** 时，会在 `value` 变化时对整篇文档执行 **`executeEdits` 类全文替换**。

中文 IME 组合过程中，真实内容在 **隐藏 `textarea` 的合成串** 与 **Monaco 模型** 之间存在时间差；若此时父组件又根据**略旧的 `value`** 回写编辑器，就会与合成层**叠绘**，表现为重叠、抖动。

**对策**：对业务侧保持「看起来像受控」的体验，但对 **Monaco 组件不传 `value`**，改用 **`defaultValue` + 稳定 `path` + `key`**，在 `onMount` 里用 `onDidChangeModelContent` 等方式上报，并用 `lastEmittedRef` + `useEffect` 仅在**外部数据源**变化时 `setValue`。

### 2.2 `defaultValue` 每键都变 → `memo(Editor)` 无意义

即使去掉受控 `value`，若每次渲染都把**最新全文**当作 `defaultValue` 传入，`Editor` 的 props 仍在变，子组件持续重渲染，同样会放大与 IME 的冲突。

**对策**：用 **`editorBootstrapTextRef`**（或等价逻辑）仅在 **`monacoModelPath` / `documentIdentity` 变化**时更新「引导用的初始文本」；同一条文档内输入时 **`defaultValue` 对 React 比较保持恒定**。

### 2.3 透明主题 + 主题切换

自定义主题若将 `editor.background` 设为 **`#00000000`**，画布背后会直接透出页面的 `color-mix`、渐变等。全局换肤时底层重绘与编辑器层合成不同步时，容易出现**重影感**（与「纯换行 IME」问题不同维度）。

当前仍保留**玻璃主题**（继承 `vs` / `vs-dark` / `hc-black` 高亮、仅 chrome 透明）时，若再遇到换肤重影，可考虑在换肤后 **`editor.layout()`** 或改为**不透明**编辑区底色（见历史迭代说明）。

### 2.4 换行后重影：`wordWrap` + `automaticLayout`（本次关键）

**首行**往往不触发「整篇折行重算」；**一回车成多行**后，`wordWrap: on` 会按视口宽度反复重算折行，再叠加 **`automaticLayout: true`** 在内容高度变化时触发布局，与**透明底 + Canvas + IME 合成层**容易在**第二行及之后**叠画。

**对策（Markdown 专用）**：

- **`wordWrap: 'off'`**：取消视口折行，长行横向滚动，避免换行后每键触发大范围重排。  
- 关闭 **`folding` / `stickyScroll` / `glyphMargin`** 等额外装饰层，减少多行时的多余绘制。  
- **`accessibilitySupport: 'off'`**、**`cursorBlinking: 'solid'`**：减少辅助层与光标闪烁带来的重绘。  
- **`onDidCompositionEnd`** 后在 **`requestAnimationFrame` 链中调用 `editor.layout()` 两次**，让合成结束后的几何与 IME 对齐。

### 2.5 组合事件时序

部分浏览器上 **`compositionstart` 晚于首字符进入模型**，若仅靠 Monaco 的 `onDidCompositionStart`，仍可能在组合初期误触发 `pushToParent`。

**对策**：在 **`textarea.inputarea` 上监听原生 `compositionstart` / `compositionend`**，尽早置位 `imeComposingRef`；内容变更上报时同时判断 **`editor.inComposition`**；**结束时的正文上报**以 **`onDidCompositionEnd` + `queueMicrotask`** 为主，避免与原生 `compositionend` 各推一次。

### 2.6 外部 `value` 回写

MobX/React 回显时，若 `value` 与编辑器当前内容一致但仍是「父级回传的本人编辑」，应用 **`lastEmittedRef`**：与最近一次**本编辑器**推上去的内容相同则**不要 `setValue`**；且 **`hasTextFocus()`** 且 props 落后于模型时**不要用旧 props 覆盖**（避免 IME 中间态被整篇替换）。

### 2.7 分屏预览抢主线程

分屏时右侧 Markdown 全量 `render` 若与左侧同帧执行，会加重卡顿与「像重影」的观感。

**对策**：预览侧使用 **`useDeferredValue(value)`** 等方法降低优先级（实现见 `index.tsx`）。

---

## 3. 解决方案总览（实现清单）

相关代码主要在：

- `apps/frontend/src/components/design/Monaco/index.tsx` — 主编排、IME、`mergedEditorOptions`、`Editor` 的 props  
- `apps/frontend/src/components/design/Monaco/glassTheme.ts` — 继承内置主题的透明 chrome 主题注册  
- `apps/frontend/src/components/design/Monaco/options.ts` — 全局默认编辑器选项（Markdown 在 index 内再覆盖一部分）  
- `apps/frontend/src/views/knowledge/index.tsx` — 传入 **`documentIdentity`**，保证换篇时 model 与引导文本一致  

### 3.1 数据流（概念）

```mermaid
flowchart LR
  subgraph 禁止
    A["Editor 受控 value + 库 onChange"]
  end
  subgraph 采用
    B["defaultValue 仅随 path 快照"]
    C["onMount: onDidChangeModelContent + IME"]
    D["lastEmittedRef + useEffect 外部 setValue"]
  end
  A -.->|避免| B
  B --> C
  C --> D
```

### 3.2 `Editor` 侧要点

- **`beforeMount`**：`registerMonacoGlassThemes`，主题 id 使用 `GLASS_THEME_BY_UI[theme]`。  
- **`path={monacoModelPath}`**，**`key={monacoModelPath}`**，**`defaultValue={editorBootstrapTextRef.current}`**。  
- **不传 `value`、不传库自带 `onChange`**（变更只在 `onMount` 订阅里处理）。

### 3.3 Markdown 专用 `mergedEditorOptions`（与换行重影直接相关）

在 `language === 'markdown'` 时额外设置（与 `index.tsx` 保持一致，后续若有改动以代码为准）：

| 选项 | 作用 |
|------|------|
| `wordWrap: 'off'` | 避免多行后反复折行重算与 IME 打架 |
| `folding: false` / `foldingHighlight: false` | 减少装饰层 |
| `stickyScroll: { enabled: false }` | 关闭粘性滚动条区域 |
| `glyphMargin: false` | 关闭字形边距 |
| `accessibilitySupport: 'off'` | 减少无障碍树带来的额外绘制 |
| `cursorBlinking: 'solid'` | 稳定光标，减少闪烁重绘 |
| `fontFamily`（中文优先栈）、`fontLigatures: false`、`disableMonospaceOptimizations: true`、`colorDecorators: false` | 混排与装饰对 IME 测量的干扰 |

### 3.4 内容上报与 `layout`

- 非组合阶段：`onDidChangeModelContent` → **`requestAnimationFrame` 合并**同一帧内多次变更再 `pushToParent`。  
- `onDidCompositionStart`：**取消**挂起的 `pushRaf`，并置 `imeComposingRef`。  
- `onDidCompositionEnd`：`queueMicrotask` 内 **`pushToParent` + 双 `requestAnimationFrame` 调用 `editor.layout()`**。  
- `editor.onDidDispose`： **`cancelAnimationFrame(pushRaf)`**。

### 3.5 知识库 `documentIdentity`

传入 `detailStore.knowledgeEditingKnowledgeId ?? 'draft-new'`，使 **`monacoModelPath` 随条目变化**，避免多篇文档共用同一 URI 或错误复用引导文本。

---

## 4. 权衡与后续可调项

- **`wordWrap: 'off'`** 下，超长行需**横向滚动**。若产品强需求自动折行，可尝试 **`wordWrap: 'bounded'`** 或较大 **`wordWrapColumn`** 等折中，并在真机 IME 上回归。  
- 玻璃主题仍使用**全透明**编辑区底色时，若在**仅换肤**场景再出现合成问题，可评估：换肤后强制 **`layout()`**，或改为读取设计 token 的**不透明**底色写入 `defineTheme`。

---

## 5. 回归检查建议

1. 单行中文、连续组词。  
2. **首行输入后回车**，在第二行、第三行再输入中文。  
3. 中英文混排、换行前后各输入一段。  
4. 切换 **vs / vs-dark**（及页面明暗主题）。  
5. **分屏预览**下快速输入（观察卡顿与视觉是否异常）。  
6. **切换知识库条目**后内容是否与列表一致、无串篇。

---

## 6. 修订记录

- 文档初稿：总结「受控回写 + 换行折行布局 + IME 时序 + 玻璃主题」等成因与当前代码中的对策。  
- 代码为准：若 `index.tsx` / `glassTheme.ts` 与本文不一致，**以仓库实现优先**，并建议同步更新本节。
