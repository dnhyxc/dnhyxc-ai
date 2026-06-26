# EPUB 边听边读（听当前 + 听书）— 开发者实现手册

## 文档角色

**本文档**：EPUB **听当前**（选区/引用/想法朗读）与 **听书**（顶栏全书连续听）的 **唯一完整开发者手册**。目标读者是需要维护、扩展或从零复刻该能力的工程师。

**与产品/增量专题的关系**：

| 类型 | 路径 | 用途 |
|------|------|------|
| 本手册 | `docs/ebook/developer/epub-listen-dev.md` | 原理、模块边界、调用链、可照抄源码 |
| 听当前增量 | `docs/ebook/epub-quote-listen.md` | 三入口、历史 diff |
| 听书增量 | `docs/ebook/epub-chapter-listen.md` | 听书定稿架构、废弃方案 |
| 播放背景 | `docs/ebook/epub-listen-sentence-bg.md` | plain 偏移与 `onCadenceChunk` |
| 自动跟随 FAB | `docs/ebook/epub-listen-auto-follow-fab.md` | scroll guard 细节 |
| 与用户划线 | `docs/ebook/epub-listen-user-highlight-reconcile.md` | 播放层 DOM 隔离 |

**推荐阅读顺序**：

| 顺序 | 章节 | 内容 |
|------|------|------|
| 1 | **§0** | 维护定位表、M1–M5 从零阶段 |
| 2 | **§1–§2** | 能力边界、架构总览、数据流 |
| 3 | **§3** | **听当前**完整链路 |
| 4 | **§4** | **听书**完整链路 |
| 5 | **§5** | 共享层：TTS、高亮、滚动、互斥 |
| 6 | **§6–§7** | 阅读页接线、验收清单 |
| 7 | **§8** | 带逐行注释的关键源码 |

---

## 0. 开发者从何下手（必读）

### 0.1 先判断：你要哪种工作？

| 你的目标 | 走哪条路 |
|----------|----------|
| 改 bug / 小需求 | [§0.2 维护路径](#02-维护现有功能按现象定位) |
| 理解听当前 vs 听书差异 | [§1.2](#12-听当前与听书对比) |
| 从零做一版 EPUB 听读 | [§0.3 M1–M5](#03-从零实现严格按阶段) |
| 跟一遍运行时 | [§0.4 调用链](#04-运行时调用链) |

### 0.2 维护现有功能：按现象定位

| 现象 | 先打开 | 关键符号 | 怎么验 |
|------|--------|----------|--------|
| 点「听当前」无声 | `useEbookQuoteListen.ts` | `playEnglishPreferred` | 控制台 TTS 报错 |
| 听当前有句背景、听书没有 | `epubListenChapterHighlight.ts` | `indexChapterSentenceRanges` 是否全 null | 断点 `sentenceRanges[i]` |
| 听书误报「本章暂无文字」 | `epubListenVisibleSection.ts` | `getRenditionViewsList`、`pickDocumentForListen` | `views()` 不可 `for…of` |
| 换句背景残留/叠层 | `epubListenMarkHighlight.ts` | 换句前 `clearListenMarkHighlight` | marks-pane SVG |
| 播放句不在视口、不自动滚 | `epubListenSegmentOverlay.ts` | `activeDomRange`、`requestListenAutoFollowScroll` | session 是否有 Range |
| 手动滚后无 FAB | `EpubListenFollowFab.tsx` | `subscribeEpubListenAutoFollow` | `active && !autoFollow` |
| 听书与听当前同时响 | `epubListenController.ts` | `invokeStop*` | 互斥注册 |
| 听书节末不翻章 | `epubListenVisibleSection.ts` | `waitForNextSection` | `rend.next()` + `relocated` |
| 目录跳转后听书错位 | `useEpubChapterListen.ts` | `syncToCurrentView` | TOC `onSelect` 回调 |
| 背景与用户划线互删 | `epubListenMarkHighlight.ts` | class `moke-epub-listen-bg` | 与用户 `moke-epub-user-hl` 分离 |

### 0.3 从零实现：严格按阶段

#### M1：TTS 能播一句

| 步 | 做什么 | 文件 |
|----|--------|------|
| 1 | `playEnglishPreferred(text)` | `apps/frontend/src/utils/englishTts.ts` |
| 2 | `buildSentenceOffsetSpans(plain)` 句界 | 同上 |
| 3 | `isEnglishPlaybackAvailable` + Toast | hook 内 |

**验收**：控制台调用 `playEnglishPreferred('Hello world.')` 能出声。

**不要做**：EPUB DOM、高亮、滚动。

#### M2：听当前（无背景）

| 步 | 做什么 |
|----|--------|
| 1 | `useEbookQuoteListen` + PopBar `onListen` |
| 2 | `resolveEpubListenPlain` 取选区文本 |
| 3 | `playEnglishPreferred(plain)` 一次播完 |

**验收**：拖选 → 听当前 → 能朗读 → 停止。

#### M3：听当前句级背景 + 自动跟随

| 步 | 做什么 |
|----|--------|
| 1 | `beginEpubListenOverlaySession` + `buildDomSentenceIndex` |
| 2 | `onCadenceChunk` → `showEpubListenPlainSpan` → `paintSentence` |
| 3 | `epubListenMarkHighlight.showListenMarkHighlight` |
| 4 | `attachListenScrollGuard` + `EpubListenFollowFab` |

**验收**：长选区逐句淡黄底；手动滚动出 FAB；点 FAB 回位。

#### M4：听书连续播放

| 步 | 做什么 |
|----|--------|
| 1 | `extractVisibleListenSection`（innerText） |
| 2 | `useEpubChapterListen` 状态机 + `runListenLoop` |
| 3 | `indexChapterSentenceRanges` 节级句 Range |
| 4 | `EpubListenPlayerBar` + 顶栏耳机 |

**验收**：听书从可见章连续播；底部播放条；节末 `next()`。

#### M5：互斥与边界

| 步 | 做什么 |
|----|--------|
| 1 | `epubListenController` 双向 stop |
| 2 | `syncToCurrentView`（目录跳转） |
| 3 | `……` / `——` / 省略号句界（`buildSentenceOffsetSpans`） |

### 0.4 运行时调用链

**听当前（选区 PopBar）**：

```text
1. 用户拖选 → EpubSelectionPopBar → onListen
2. read.tsx → toggleListen(text, key, cfiRange, frozenRange)
3. invokeStopChapterListen()  // 互斥
4. resolveEpubListenPlain → plain + selectionRange
5. beginEpubListenOverlaySession(rend, plain, { cfi, selectionRange })
   └─ buildDomSentenceIndex(outerRange) → sentences + plain
   └─ attachListenScrollGuard
6. playEnglishPreferred(speakPlain, { onCadenceChunk })
   └─ emitCadenceChunk(phase:'start') → showEpubListenPlainSpan → paintSentence
      └─ sentenceToRange → showListenMarkHighlight + requestListenAutoFollowScroll
   └─ emitCadenceChunk(phase:'end', isLastInSentence) → clearActiveListenHighlight
7. finally → clearEpubListenSegmentOverlay
```

**听书（顶栏耳机）**：

```text
1. toggleChapterListen → startFromCurrentPosition
2. invokeStopQuoteListen(); clearEpubListenSegmentOverlay(); beginChapterListenAutoFollow
3. extractVisibleListenSection → plain + outerRange + spineIndex
4. runListenLoop(gen):
   a. prepareSection → buildSentenceOffsetSpans + indexChapterSentenceRanges
   b. playSentencesFromCursor:
      └─ 每句 stripMarkdownForTts(plain.slice) → playEnglishPreferred(spokenRaw)
      └─ showChapterListenSentenceHighlight → syncChapterListenScrollSession
         └─ showEpubListenDomRange → showListenMarkHighlight + autoFollow scroll
      └─ 句末 clearChapterListenSentenceHighlight
   c. waitForNextSection → rend.next() → 下一节循环
5. stopInternal → teardownChapterListenHighlight + clearEpubListenSegmentOverlay
```

---

## 1. 背景与能力边界

### 1.1 产品能力（EPUB only）

| 能力 | 入口 | 播放范围 | UI |
|------|------|----------|-----|
| **听当前** | 选区 PopBar、想法卡片、上下文菜单 | 用户选中的一段 | 无独立播放条；工具条可保持 |
| **听书** | 顶栏耳机图标 | 当前可见 spine 节起，逐句至全书末 | 底部 `EpubListenPlayerBar` |

二者 **互斥**：启动一方会 `invokeStop*` 停止另一方。

**PDF**：暂无听当前/听书入口。

### 1.2 听当前与听书对比

| 维度 | 听当前 | 听书 |
|------|--------|------|
| Hook | `useEbookQuoteListen` | `useEpubChapterListen` |
| 正文来源 | 选区 DOM → `buildDomSentenceIndex` | `body.innerText` + `stripMarkdownForTts` |
| 句界 | 与 TTS 共用 `buildSentenceOffsetSpans` | 同上 |
| 句 → DOM | `DomListenSentence.anchor`（字符流锚点） | `indexChapterSentenceRanges`（TreeWalker + indexOf） |
| TTS 调用 | 一次 `playEnglishPreferred(整段plain)` | **每句** `playEnglishPreferred(spokenRaw)` |
| 句背景触发 | TTS `onCadenceChunk` 回调 | 每句播放前同步调用 |
| 滚动 session | `beginEpubListenOverlaySession`（含 plain 句表） | `beginChapterListenAutoFollow` + `showEpubListenDomRange`（`activeDomRange`） |
| 节/章衔接 | 无 | `waitForNextSection` → `rend.next()` |

**设计原则**：播放文本与句界算法 **必须与 TTS 同源**（`stripMarkdownForTts` + `buildSentenceOffsetSpans`），否则背景句与朗读句错位。

### 1.3 刻意不做（当前版本）

- 词级卡拉 OK、唇形同步
- Whispersync 级精确进度持久化
- 听书预扫描全书 DOM 句表（易卡死）
- 听书走 `onCadenceChunk` + overlay plain 映射（与 innerText 句表易失配）
- 每句 `window.find` 搜索 DOM（O(n²) 卡死）

---

## 2. 架构总览

### 2.1 模块分层

```text
┌─────────────────────────────────────────────────────────────┐
│ read.tsx — 入口接线、互斥、TOC syncToCurrentView            │
├─────────────────────────────────────────────────────────────┤
│ Hooks                                                       │
│  useEbookQuoteListen    useEpubChapterListen                │
├─────────────────────────────────────────────────────────────┤
│ 播放编排                                                    │
│  epubListenSegmentOverlay（session、autoFollow、句表/DOM）  │
│  epubListenVisibleSection（听书：可见节 innerText）         │
│  epubListenController（互斥 stop 注册）                     │
├─────────────────────────────────────────────────────────────┤
│ 句 ↔ DOM                                                    │
│  epubListenSentenceIndex（听当前：DOM 字符流锚点）          │
│  epubListenChapterHighlight（听书：TreeWalker 顺序匹配）    │
├─────────────────────────────────────────────────────────────┤
│ 视觉 + 滚动                                                 │
│  epubListenMarkHighlight（淡黄 SVG/iframe 单层）            │
│  epubScrolledNav.scrollEpubRangeIntoView                    │
├─────────────────────────────────────────────────────────────┤
│ TTS                                                         │
│  englishTts — playEnglishPreferred / buildSentenceOffsetSpans│
└─────────────────────────────────────────────────────────────┘
```

### 2.2 播放背景（共用）

- 颜色：`rgba(251, 231, 128, 0.28)`（`EPUB_LISTEN_SEGMENT_FILL`）
- 实现：`epubListenMarkHighlight.ts` 单例浮层
- **不用** CSS Highlight API、不用 epub annotation 作主路径（`……` 等易残留）
- **与用户划线分离**：class `moke-epub-listen-bg`，清除时不碰 `moke-epub-user-hl`

### 2.3 自动跟随（共用）

- 模块：`epubListenSegmentOverlay.ts`
- Session 字段：`autoFollow`（默认 true）、`activeDomRange`（听书）或 `lastSentenceIndex`（听当前）
- 用户 `scroll` / `wheel` → `pauseListenAutoFollow` → FAB 显示
- `resumeEpubListenAutoFollow` → 滚回当前句 + 恢复跟随
- 程序滚动用 `programmaticScroll` 计数，避免误判为用户打断

### 2.4 数据流（简图）

```mermaid
flowchart TB
  subgraph quote [听当前]
    Q1[选区 Range] --> Q2[buildDomSentenceIndex]
    Q2 --> Q3[overlay session]
    Q3 --> Q4[playEnglishPreferred + onCadenceChunk]
    Q4 --> Q5[paintSentence → markHighlight]
  end

  subgraph chapter [听书]
    C1[innerText plain] --> C2[buildSentenceOffsetSpans]
    C2 --> C3[indexChapterSentenceRanges]
    C3 --> C4[每句 playEnglishPreferred]
    C4 --> C5[syncChapterListenScrollSession → markHighlight]
  end

  Q5 --> M[epubListenMarkHighlight]
  C5 --> M
  M --> S[scrollEpubRangeIntoView]
```

---

## 3. 听当前 — 实现原理

### 3.1 入口（三处）

| 入口 | read.tsx 调用 |
|------|----------------|
| 选区 PopBar | `toggleListen(quote, listenKey, cfiRange, frozenRange)` |
| 想法卡片 | `toggleListen(thoughtDraft.quote, listenKey, thoughtDraft.cfiRange)` |
| 上下文菜单 | 包装 `onListen` |

Hook 签名：

```typescript
useEbookQuoteListen(t, getRendition, onListenSessionEnd?)
→ { toggleListen, playingKey, listenLabel }
```

### 3.2 文本与 Session 建立

1. **`resolveEpubListenPlain`**：优先级 `frozenRange` > 记忆的 PopBar Range > 当前 Selection > `fallbackText`。
2. **`stripMarkdownForTts`** 得 TTS 用 `plain`。
3. **`beginEpubListenOverlaySession(rend, plain, { cfi, selectionRange })`**：
   - 用选区 `outerRange` 调 **`buildDomSentenceIndex`**：DOM 正向字符流，每个字符对应 `{node, offset}`，再按 `buildSentenceOffsetSpans` 切句并记录 **anchor**。
   - 注册 **`attachListenScrollGuard`**。
   - Session 保存：`plain`、`sentences[]`、`outerRange`、`cfi`、`autoFollow`。

### 3.3 TTS 与句背景同步

- 一次播放整段 `speakPlain`（不是逐句 await）。
- **`playEnglishPreferred`** 内部按 **节奏块（cadence chunk）** 回调 **`onCadenceChunk`**：
  - `phase: 'start'` → `showEpubListenPlainSpan(..., sentenceIndex)` → **`paintSentence`**
  - `phase: 'end'` 且 `isLastInSentence` → **`clearActiveListenHighlight`**
- **`paintSentence`**：`sentenceToRange(sentences[i])` → `showListenMarkHighlight`；换句先 `clearListenMarkHighlight`；若 `autoFollow` 则 `requestListenAutoFollowScroll`。

### 3.4 停止与清理

- 再次点同一 key / 播放结束 `finally`：`clearEpubListenSegmentOverlay()`（清 session、卸 scroll guard、清高亮）。
- `onListenSessionEnd` 触发 annotation sync（与用户划线 reconcile）。

---

## 4. 听书 — 实现原理

### 4.1 状态机

`ChapterListenStatus`：`idle` | `loading` | `playing` | `paused`

| 字段 | 含义 |
|------|------|
| `spineIndex` | 当前 spine 节下标 |
| `sentenceIndex` / `sentenceCount` | 节内句进度 |
| `rate` | 倍速 0.75 / 1 / 1.25 / 1.5 |

**代际取消**：`loopGenRef` 递增使进行中的 `runListenLoop` / `playSentencesFromCursor` 自行退出（pause、stop、seek 均 bump gen）。

### 4.2 可见节抽取

**`extractVisibleListenSection(rend, spineHint?)`**：

1. **`listIframeDocuments`**：`getContents` + **`getRenditionViewsList(rend)`**（勿对 `views()` 直接 `for…of`）+ 滚动容器内 iframe。
2. **`pickDocumentForListen`**：优先 `spineHint` 对应 view；多 iframe 时用视口 **垂直中心** 选有正文的 document。
3. **`innerText`** → `stripMarkdownForTts` → `plain`（与 TTS 同源）。
4. `outerRange = selectNodeContents(body)` 供句 Range 索引。
5. `plain` 超 `MAX_PLAIN_CHARS`（50000）截断。

### 4.3 起始句

首次启动 / 目录跳转后 **`resolveStartCfiRef = true`**：

- **`resolveListenStartSentence`**：用当前阅读 CFI 解析 DOM Range，在 `sentenceRanges` 中找 **最后一个 END ≤ CFI 位置** 的句索引。

### 4.4 播放循环

```text
runListenLoop(gen):
  loop:
    ctx = prepareSection(rend, gen)     // 空则 Toast emptySection
    finished = playSentencesFromCursor(ctx, gen)
    if paused → return
    if !finished → stop
    waitForNextSection(rend)            // rend.next + relocated 或超时
    if !advanced → Toast finished → stop
    sentenceCursor = 0
```

**`playSentencesFromCursor`**（核心）：

- 从 `sentenceCursorRef` 遍历 `sentences`（plain 偏移 `{start,end}`）。
- 每句：`spokenRaw = stripMarkdownForTts(plain.slice(start, end))`。
- **`playEnglishPreferred(spokenRaw, { speak: { rate } })`** — 逐句 await。
- 有 `sentenceRanges[i]` 则高亮 + 自动跟随；**无 Range 仍播 TTS**（graceful degradation）。
- 句末 `clearChapterListenSentenceHighlight`。

### 4.5 句 DOM 索引（节级一次）

**`indexChapterSentenceRanges(outerRange, plain)`**：

1. TreeWalker 收集 body 下所有文本字符位置。
2. 空白归一化为单空格流 `norm` + `map`（norm 字符 → TextPos）。
3. 对每句 `needle = normForMatch(plain.slice(start,end))`，在 `norm` 上 **顺序 indexOf**（必要时前缀模糊）。
4. 命中则 `rangeFromPosSpan` 建 DOM Range；未命中返回 `null`。

与听当前 **`buildDomSentenceIndex`** 不同：听书 plain 来自 **innerText**，不能直接用选区字符流，故用顺序匹配而非 anchor 流。

### 4.6 高亮与滚动

- **`showChapterListenSentenceHighlight`** → **`syncChapterListenScrollSession`** → **`showEpubListenDomRange`**
- 写入 session **`activeDomRange`**，供 FAB / `scrollActiveListenIntoView` 使用。
- 启动时 **`beginChapterListenAutoFollow(rend)`** 提前挂 scroll guard。

### 4.7 播放条与目录

- **`EpubListenPlayerBar`**：pause/resume、stop、prev/next sentence、倍速。
- TOC **`onSelect`**：若 `chapterListen.isActive` → **`syncToCurrentView()`**（`waitForRelocated` 后从新 CFI 重算节与起始句）。

---

## 5. 共享层详解

### 5.1 TTS（`englishTts.ts`）

| API | 用途 |
|-----|------|
| `buildSentenceOffsetSpans(plain)` | 句界：`.!?。！？；`、`…`/`......`/`...`、段末 tail |
| `stripMarkdownForTts(text)` | 去 Markdown 噪声，朗读与匹配前统一调用 |
| `playEnglishPreferred(text, opts?)` | 本机 Web Speech / 云端偏好；可选 `onCadenceChunk`、`speak.rate` |
| `stopAllEnglishPlayback()` | 停止全部实例 |
| `primeEnglishPlaybackForUserGesture()` | 听书启动前解锁浏览器音频策略 |

**句界必须与 DOM 匹配逻辑一致**：听书 `normForMatch` 内部也调 `stripMarkdownForTts` + 空白折叠。

### 5.2 播放背景（`epubListenMarkHighlight.ts`）

| 函数 | 行为 |
|------|------|
| `showListenMarkHighlight(rend, range)` | 优先 marks-pane SVG rect；无 SVG 则 iframe 绝对定位层 |
| `clearListenMarkHighlight(rend?)` |  purge 所有 listen annotation + SVG g + iframe layer |
| `listenLineRects` | 修正段首 `……` 误检行（背景垂直偏移） |

单例 `active`：换 document / rendition 时全量清除，避免跨节残留。

### 5.3 滚动（`epubScrolledNav.ts`）

**`scrollEpubRangeIntoView(rend, range, fallbackCfi?)`**：

- 已在视口（带 margin）→ 直接返回。
- 连续滚动模式 → 调容器 `scrollTop`。
- 分页模式 → `cfiFromDomRange` / `fallbackCfi` → `rend.display(cfi)`。

### 5.4 互斥（`epubListenController.ts`）

模块级 `stopQuoteListen` / `stopChapterListen` 回调注册：

- `useEbookQuoteListen` 注册 quote stop；听当前前 `invokeStopChapterListen()`。
- `useEpubChapterListen` 注册 chapter stop；听书前 `invokeStopQuoteListen()`。

### 5.5 FAB（`EpubListenFollowFab.tsx`）

- 订阅 `subscribeEpubListenAutoFollow`
- `visible = session.active && !session.autoFollow`
- 挂载在 **EPUB 阅读区** `relative` 容器内（`bottom-4 right-4`），避免与底部播放条重叠

---

## 6. 阅读页接线（`read.tsx`）

```typescript
// 听当前
const { toggleListen, listenLabel } = useEbookQuoteListen(
  t,
  () => epubNavRef.current?.getRendition() ?? null,
  () => epubNavRef.current?.syncReadingAnnotations(),
);

// 听书
const chapterListen = useEpubChapterListen(
  t,
  () => epubNavRef.current?.getRendition() ?? null,
  () => currentEpubCfiRef.current || prog?.epubCfi,
  () => epubNavRef.current?.syncReadingAnnotations(),
  () => epubSpineIndexRef.current ?? epubSpineIndex,
);
```

布局（EPUB 列）：

```text
<div relative flex-col>
  <div relative flex-1>   <!-- 阅读区 -->
    <EpubPane />
    <EpubListenFollowFab />
  </div>
  <EpubListenPlayerBar ... />
</div>
```

顶栏：`chapterListen.toggleChapterListen` + `aria-pressed={chapterListen.isActive}`。

---

## 7. 验收清单

### 听当前

- [ ] 拖选英文段 → PopBar 听当前 → 逐句淡黄底
- [ ] 句末清除；停止后全无背景
- [ ] 长选区播放时当前句滚入视口
- [ ] 手动滚动 → FAB 出现 → 点击回位并恢复跟随
- [ ] 与用户粉/紫划线共存，播完不删用户线
- [ ] 播放中点听书 → 听当前停止

### 听书

- [ ] 顶栏耳机 → 底部播放条 → 从当前 CFI 附近句开始播
- [ ] 连续滚动 / 分页 EPUB 均能抽到正文（不误报 emptySection）
- [ ] 有句 Range 时有背景 + 自动跟随；无 Range 仍出声
- [ ] 节末自动下一 spine；全书完 Toast
- [ ] 暂停/继续、上句/下句、倍速生效
- [ ] 目录跳转后续播新位置
- [ ] 播放中点听当前 → 听书停止

---

## 8. 关键源码（逐行注释）

以下摘录与仓库当前实现一致，供对照实现。**每行源码上方一行中文注释**。

### 8.1 `useEbookQuoteListen` — `toggleListen`

**来源**：`apps/frontend/src/views/ebook/hooks/useEbookQuoteListen.ts` · **改动后** · 约 L45–L118

```typescript
// 用 useCallback 固定 toggleListen 引用，避免 PopBar 无意义重渲染
const toggleListen = useCallback(
	// 异步：内部 await TTS 播放
	async (
		// 界面传入的选区文本（可能已 trim）
		text: string,
		// 唯一 key：同一 key 再点视为停止
		key: string,
		// 选区 CFI，供 overlay session 与分页滚动用
		cfiRange?: string,
		// PopBar 冻结的 Range，避免点击时 selection 丢失
		frozenRange?: Range | null,
	) => {
		// 去掉首尾空白后的朗读源文本
		const trimmed = text.trim();
		// 空文本直接返回，不启 TTS
		if (!trimmed) return;
		// 若正在播同一 key，则用户意图为「停止」
		if (playingKey === key) {
			// 停止所有 TTS 实例
			stopAllEnglishPlayback();
			// 清 overlay session、高亮、scroll guard
			clearEpubListenSegmentOverlay();
			// 通知外层 sync 用户划线等
			onListenSessionEnd?.();
			//  UI 状态回到未播放
			setPlayingKey(null);
			return;
		}
		// 听当前启动前必须先停听书（互斥）
		invokeStopChapterListen();
		// 浏览器不支持 TTS 则 Toast 并返回
		if (!isEnglishPlaybackAvailable()) {
			Toast({
				type: 'warning',
				title: t('englishLearning.tts.unsupported'),
			});
			return;
		}
		// 停止其它 TTS，清旧 overlay
		stopAllEnglishPlayback();
		clearEpubListenSegmentOverlay();
		// 标记当前播放 key
		setPlayingKey(key);

		// 取 epub.js Rendition，无则 null
		const rend = getRendition?.() ?? null;
		// CFI 字符串 trim
		const cfi = cfiRange?.trim() ?? '';
		// 解析 plain、selectionRange（DOM 选区）
		const { plain, selectionRange } = resolveEpubListenPlain(
			rend,
			trimmed,
			frozenRange,
		);

		// 有 rendition 且 plain 非空才建 overlay session（句表 + autoFollow）
		if (rend && plain) {
			beginEpubListenOverlaySession(rend, plain, {
				cfi,
				selectionRange,
			});
		}

		// session 内 plain 优先（DOM 句表可能修正 plain）
		const speakPlain = getEpubListenSessionPlain() ?? plain;

		try {
			// 一次播完整段；句背景靠 onCadenceChunk 驱动
			await playEnglishPreferred(speakPlain, {
				onCadenceChunk: (event) => {
					// 无 rendition 无法画 EPUB 背景
					if (!rend) return;
					// 句内 chunk 结束
					if (event.phase === 'end') {
						// 仅在该句最后一个 chunk 结束时清背景
						if (event.isLastInSentence) {
							clearActiveListenHighlight(rend);
						}
						return;
					}
					// chunk 开始：按 sentenceIndex 画对应句
					showEpubListenPlainSpan(
						event.sentencePlainStart,
						event.sentencePlainEnd,
						event.sentenceIndex,
					);
				},
			});
		} catch {
			// TTS 失败 Toast
			Toast({
				type: 'warning',
				title: t('englishLearning.tts.unsupported'),
			});
		} finally {
			// 无论成功失败都 teardown session
			clearEpubListenSegmentOverlay();
			onListenSessionEnd?.();
			// 仅当仍是本 key 时清 playingKey（防竞态）
			setPlayingKey((k) => (k === key ? null : k));
		}
	},
	[getRendition, onListenSessionEnd, playingKey, t],
);
```

---

### 8.2 `buildSentenceOffsetSpans` — 句界算法

**来源**：`apps/frontend/src/utils/englishTts.ts` · **改动后** · 约 L478–L517

```typescript
// 导出：plain 内每句的 [start,end) 偏移，听当前/听书/TTS 共用
export function buildSentenceOffsetSpans(
	// 原始 plain（可含首尾空白）
	plain: string,
): Array<{ start: number; end: number }> {
	// 句界计算在 trim 后的字符串上进行
	const trimmed = plain.trim();
	// 空串无句
	if (!trimmed) return [];

	// 累积输出的句 span 列表
	const spans: Array<{ start: number; end: number }> = [];
	// 当前句在 trimmed 上的起始下标
	let rawStart = 0;

	// 逐字符扫描边界
	for (let i = 0; i < trimmed.length; i += 1) {
		// 当前位置是否为句末标点/省略号
		const boundary = sentenceBoundaryEnd(trimmed, i);
		// 非边界继续
		if (boundary < 0) continue;

		// rawStart 到 boundary 为候选句切片
		const slice = trimmed.slice(rawStart, boundary);
		// 去掉首尾空白后的有效内容
		const content = slice.trim();
		// 有内容才记一句
		if (content) {
			//  leading 空白长度
			const lead = slice.length - slice.trimStart().length;
			// trailing 空白长度
			const trail = slice.length - slice.trimEnd().length;
			// 记录内容区精确偏移
			spans.push({ start: rawStart + lead, end: boundary - trail });
		}

		// 下一句从 boundary 后开始
		rawStart = boundary;
		// 跳过 boundary 后连续空白
		while (rawStart < trimmed.length && /\s/u.test(trimmed[rawStart]!)) {
			rawStart += 1;
		}
		// for 循环会 i++，这里回退到 boundary-1
		i = boundary - 1;
	}

	// 文件末尾无句号时的尾段
	if (rawStart < trimmed.length) {
		const tail = trimmed.slice(rawStart).trim();
		if (tail) {
			const lead =
				trimmed.slice(rawStart).length -
				trimmed.slice(rawStart).trimStart().length;
			spans.push({ start: rawStart + lead, end: trimmed.length });
		}
	}

	// 至少返回整段一句，避免空 spans
	return spans.length > 0 ? spans : [{ start: 0, end: trimmed.length }];
}
```

---

### 8.3 `paintSentence` — 听当前句背景 + 自动滚

**来源**：`apps/frontend/src/views/ebook/utils/epubListenSegmentOverlay.ts` · **改动后** · 约 L314–L326

```typescript
// 听当前：按句索引绘制背景并可选滚入视口
function paintSentence(sentenceIndex: number): void {
	// 无 session 或非法索引则跳过
	if (!session || sentenceIndex < 0) return;

	// 由 DOM 锚点还原该句 Range
	const range = resolveSentenceRange(session, sentenceIndex);
	// 无法还原（锚点失效）则不画
	if (!range) return;

	// 是否换句（与上一句 index 不同）
	const isNew = session.lastSentenceIndex !== sentenceIndex;
	// 更新 session 当前句索引
	session.lastSentenceIndex = sentenceIndex;
	// 换句先清再画，避免 …… 句与中间句叠层
	if (isNew) clearListenMarkHighlight(session.rend);
	// 在 marks-pane/iframe 画淡黄底
	showListenMarkHighlight(session.rend, range);
	// 新句且用户未打断 autoFollow 时滚入视口
	if (isNew && session.autoFollow) requestListenAutoFollowScroll();
}
```

---

### 8.4 `playSentencesFromCursor` — 听书逐句播放

**来源**：`apps/frontend/src/views/ebook/hooks/useEpubChapterListen.ts` · **改动后** · 约 L187–L235

```typescript
// 从 sentenceCursorRef 起播完本节剩余句；返回是否完整播完（未被 cancel/pause）
const playSentencesFromCursor = useCallback(
	async (ctx: SectionCtx, gen: number): Promise<boolean> => {
		// 解构节上下文：plain、句偏移表、预建 DOM Range 数组
		const { plain, sentences, sentenceRanges } = ctx;
		// 当前 rendition，用于高亮与滚动
		const rend = getRenditionRef.current();

		// 从游标遍历到节末
		for (let si = sentenceCursorRef.current; si < sentences.length; si += 1) {
			// 代际已过期或用户暂停则中断
			if (!isGenActive(gen) || pausedRef.current) return false;

			// 当前句在 plain 内的偏移
			const sent = sentences[si]!;
			// 与 TTS 完全一致的朗读文本
			const spokenRaw = stripMarkdownForTts(
				plain.slice(sent.start, sent.end),
			);
			// 空句跳过不播
			if (!spokenRaw.trim()) continue;

			// 更新游标到当前句
			sentenceCursorRef.current = si;
			// 同步 React 状态供播放条显示
			syncState({
				status: 'playing',
				sentenceIndex: si,
				sentenceCount: sentences.length,
			});

			// 预建的 DOM Range，可能为 null
			const domRange = sentenceRanges[si];
			// 仅当有 rend 且 Range 命中时才画背景+跟随
			const hasHighlight = !!(rend && domRange);
			if (hasHighlight) {
				showChapterListenSentenceHighlight(rend, domRange);
			}

			try {
				// 逐句 await TTS（听书不用 onCadenceChunk）
				await playEnglishPreferred(spokenRaw, {
					speak: { rate: rateRef.current },
				});
			} catch {
				// 播放失败且 session 仍有效则 Toast
				if (isGenActive(gen)) {
					Toast({
						type: 'warning',
						title: tRef.current('englishLearning.tts.unsupported'),
					});
				}
				return false;
			}

			// 播完再次检查 cancel/pause
			if (!isGenActive(gen) || pausedRef.current) return false;
			// 句末清除视觉背景（session.activeDomRange 仍保留供 FAB）
			if (hasHighlight) clearChapterListenSentenceHighlight(rend);
		}

		// 本节所有句播完且 gen 仍有效
		return isGenActive(gen);
	},
	[syncState],
);
```

---

### 8.5 `extractVisibleListenSection` — 听书正文抽取

**来源**：`apps/frontend/src/views/ebook/utils/epubListenVisibleSection.ts` · **改动后** · 约 L99–L126

```typescript
// 同步读取当前可见 spine 节：plain + outerRange + spineIndex
export function extractVisibleListenSection(
	// epub.js Rendition
	rend: Rendition,
	// 可选：当前 spine 下标 hint（来自 read.tsx relocated）
	spineHint?: number,
): VisibleListenSection | null {
	// 在多个 iframe 中选取有正文且最贴近视口中心的 document
	const doc = pickDocumentForListen(rend, spineHint);
	// 无 body 无法抽正文
	if (!doc?.body) return null;

	// innerText 路径 + stripMarkdown，与 TTS 同源
	let plain = stripMarkdownForTts(
		doc.body.innerText ?? doc.body.textContent ?? '',
	).trim();
	// 空章直接失败
	if (!plain) return null;
	// ponytail: 单节 plain 上限，防极端长章拖垮内存
	if (plain.length > MAX_PLAIN_CHARS) {
		plain = plain.slice(0, MAX_PLAIN_CHARS);
	}

	// 节级 outerRange：供 indexChapterSentenceRanges TreeWalker 作用域
	const outerRange = doc.createRange();
	try {
		outerRange.selectNodeContents(doc.body);
	} catch {
		return null;
	}

	return {
		plain,
		outerRange,
		spineIndex: spineIndexFromRendition(rend, spineHint),
	};
}
```

---

### 8.6 `showEpubListenDomRange` — 听书句背景 + activeDomRange

**来源**：`apps/frontend/src/views/ebook/utils/epubListenSegmentOverlay.ts` · **改动后** · 约 L438–L469

```typescript
// 听书：高亮指定 Range，并写入 activeDomRange 供自动滚/FAB 回位
export function showEpubListenDomRange(rend: Rendition, range: Range): void {
	// 区段已从 DOM 移除则跳过
	if (!isRangeConnected(range)) return;

	// 规范化选区（跨节点、svg 等 EPUB 特例）
	const snapped =
		normalizeSelectionRangeForEpub(range.cloneRange()) ?? range.cloneRange();

	// 获取或创建「无 plain 句表」的听书 scroll session
	const active = ensureChapterDomListenSession(rend);

	// 上一次高亮的 Range，用于判断是否换句
	const prev = active.activeDomRange;
	// 首次或 Range 变化视为新句
	const isNew = !prev || !rangesEqual(prev, snapped);

	// 听书模式不用 lastSentenceIndex 句表
	active.lastSentenceIndex = -1;
	// 存副本，resolveActiveListenDomRange 用于 scroll
	active.activeDomRange = snapped.cloneRange();

	// 换句清除旧 SVG/iframe 层
	if (isNew) clearListenMarkHighlight(rend);
	// 绘制当前句淡黄底
	showListenMarkHighlight(rend, snapped);
	// 新句且 autoFollow 开启则滚入视口
	if (isNew && active.autoFollow) requestListenAutoFollowScroll();
}
```

---

### 8.7 `attachListenScrollGuard` — 用户滚动打断

**来源**：`apps/frontend/src/views/ebook/utils/epubListenSegmentOverlay.ts` · **改动后** · 约 L256–L289

```typescript
// 绑定 scroll/wheel 监听；返回 teardown 函数
function attachListenScrollGuard(rend: Rendition): () => void {
	// 收集各 target 的 removeListener
	const cleanups: (() => void)[] = [];
	// 用户滚动意图 handler
	const onUserScrollIntent = () => {
		// 程序触发的 scroll 不计为用户打断
		if (programmaticScroll > 0) return;
		// 标记用户正在滚
		userScrolling = true;
		// 关闭 autoFollow 并通知 FAB
		pauseListenAutoFollow();
		// 150ms 稳定后处理 pendingFollowScroll
		scheduleScrollSettle();
	};
	// 给 EventTarget 绑 scroll
	const bind = (target: EventTarget | null | undefined) => {
		if (!target) return;
		target.addEventListener('scroll', onUserScrollIntent, { passive: true });
		cleanups.push(() =>
			target.removeEventListener('scroll', onUserScrollIntent),
		);
	};
	// 连续滚动外层容器
	const container = getEpubScrollContainer(rend);
	if (container) {
		bind(container);
		container.addEventListener('wheel', onUserScrollIntent, { passive: true });
		cleanups.push(() =>
			container.removeEventListener('wheel', onUserScrollIntent),
		);
	}
	// 每个 iframe content document 的 scrollingElement
	const bindContents = (contents: { document: Document }) => {
		bind(
			contents.document.scrollingElement ?? contents.document.documentElement,
		);
	};
	rend.hooks.content.register(bindContents);
	for (const item of getContents(rend)) bindContents(item);
	return () => {
		for (const fn of cleanups) fn();
	};
}
```

---

### 8.8 `EpubListenFollowFab` — 回位按钮

**来源**：`apps/frontend/src/views/ebook/components/EpubListenFollowFab.tsx` · **改动后** · 约 L11–L35

```typescript
/** 听当前/听书共用：用户手动滚动后，恢复播放内容自动滚入视口 */
export function EpubListenFollowFab() {
	// i18n
	const { t } = useI18n();
	// 是否显示 FAB
	const [visible, setVisible] = useState(false);

	// 订阅 overlay 模块 session 状态
	useEffect(
		() =>
			subscribeEpubListenAutoFollow(({ active, autoFollow }) => {
				// 有播放 session 且用户已关闭 autoFollow 时显示
				setVisible(active && !autoFollow);
			}),
		[],
	);

	// 不可见时不渲染
	if (!visible) return null;

	// 右下角圆形按钮
	return (
		<Button
			type="button"
			className="p-0! absolute bottom-4 right-4 z-20 flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border border-theme/5 bg-theme/5 text-textcolor/55 shadow-sm backdrop-blur-[2px] hover:text-textcolor/65 hover:bg-theme/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-theme/40"
			aria-label={t('ebook.read.listen.followResumeAria')}
			title={t('ebook.read.listen.followResume')}
			onClick={() => resumeEpubListenAutoFollow()}
		>
			<LocateFixed className="size-4.5" aria-hidden />
		</Button>
	);
}
```

---

### 8.9 `epubListenController` — 互斥

**来源**：`apps/frontend/src/views/ebook/utils/epubListenController.ts` · **全文**

```typescript
/** 听当前 vs 听书互斥：一方启动时停止另一方 */
// stop 回调类型
type StopFn = () => void;

// 听当前 registered stop
let stopQuoteListen: StopFn | null = null;
// 听书 registered stop
let stopChapterListen: StopFn | null = null;

// 注册/注销听当前 stop（hook mount/unmount）
export function registerQuoteListenStop(fn: StopFn | null): void {
	stopQuoteListen = fn;
}

// 注册/注销听书 stop
export function registerChapterListenStop(fn: StopFn | null): void {
	stopChapterListen = fn;
}

// 听书启动前调用 → 停止听当前
export function invokeStopQuoteListen(): void {
	stopQuoteListen?.();
}

// 听当前启动前调用 → 停止听书
export function invokeStopChapterListen(): void {
	stopChapterListen?.();
}
```

---

## 9. 源码路径速查

| 说明 | 路径 |
|------|------|
| 听当前 Hook | `apps/frontend/src/views/ebook/hooks/useEbookQuoteListen.ts` |
| 听书 Hook | `apps/frontend/src/views/ebook/hooks/useEpubChapterListen.ts` |
| Overlay / autoFollow | `apps/frontend/src/views/ebook/utils/epubListenSegmentOverlay.ts` |
| 听书可见节 | `apps/frontend/src/views/ebook/utils/epubListenVisibleSection.ts` |
| 听书句 Range | `apps/frontend/src/views/ebook/utils/epubListenChapterHighlight.ts` |
| 听当前 DOM 句表 | `apps/frontend/src/views/ebook/utils/epubListenSentenceIndex.ts` |
| 播放背景绘制 | `apps/frontend/src/views/ebook/utils/epubListenMarkHighlight.ts` |
| 互斥 | `apps/frontend/src/views/ebook/utils/epubListenController.ts` |
| 滚入视口 | `apps/frontend/src/views/ebook/utils/epubScrolledNav.ts` |
| TTS | `apps/frontend/src/utils/englishTts.ts` |
| FAB | `apps/frontend/src/views/ebook/components/EpubListenFollowFab.tsx` |
| 播放条 | `apps/frontend/src/views/ebook/components/EpubListenPlayerBar.tsx` |
| 阅读页接线 | `apps/frontend/src/views/ebook/read.tsx` |

---

## 10. 常见问题与排错

| 问题 | 原因 | 处理 |
|------|------|------|
| 听书 emptySection | `views()` 迭代抛错或 iframe 未发现 | 必须用 `getRenditionViewsList` |
| 有声音无背景 | `indexChapterSentenceRanges` 未命中 | 检查 innerText 与 DOM 归一化是否一致；无 Range 仍属预期降级 |
| FAB 不出现 | 无 active session | 听书需 `beginChapterListenAutoFollow`；高亮需 `showEpubListenDomRange` |
| 点击 FAB 不滚 | `activeDomRange` 为 null | 确认 `resolveActiveListenDomRange` 分支 |
| 背景偏上一行 | 段首 `……` 误检行 | `listenLineRects` 对齐 caret |
| 换句叠两层黄 | 未先 clear | 换句必须 `clearListenMarkHighlight` |

---

（若与仓库最新源码不一致，以源码为准）
