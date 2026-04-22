# 分享会话顺序一致性 & 用户代码块布局修复记录

本文记录两类在「分享」链路中暴露的问题与本次修复方式：

- **分享会话消息顺序**：分享页的对话顺序偶发与 ChatBot 中的展示顺序不一致（尤其是分支/重生成场景）。
- **用户消息代码块布局**：用户消息中包含代码块时，气泡宽度/对齐与 assistant 不一致，且长行会撑破最大宽度。

---

## 一、分享会话：消息顺序与 ChatBot 保持一致

### 1. 问题现象

在 ChatBot 中创建分享链接后，打开分享页看到的消息顺序偶发与 ChatBot 当前展示顺序不同。

该问题在以下场景更容易出现：

- **分支（branch）/重生成（regenerate）**：ChatBot 的“展示消息列表”并不等同于数据库按 `createdAt` 排序的全量列表。
- **同一毫秒写入**：仅用 `createdAt` 作为排序键，在边界情况下顺序可能漂移（不同环境/不同查询路径）。

### 2. 根因分析

分享创建时，前端会把当前 ChatBot 的“展示消息列表”对应的 `messageIds` 传给后端（这些 `messageIds` 的顺序就是用户当下看到的顺序）。

但后端查询分享会话消息时，虽然使用了 `IN (:...messageIds)` 过滤，却仍然：

- 使用 `.orderBy('message.createdAt', 'ASC')` 来决定最终返回顺序

因此：**返回顺序被数据库的排序规则覆盖**，与前端传入的展示顺序可能不一致。

### 3. 修复策略（稳定排序键：以 messageIds 为准）

在 `messageIds` 存在的“分享查询”场景下：

- 数据库负责**过滤出需要的消息集合**
- 服务端在返回前按 `messageIds` 的索引做一次**稳定重排**（stable reorder）

这样可以保证：

- 分享页顺序 **100% 对齐** ChatBot 当时的展示顺序（包括分支/重生成选择后的顺序）
- 不依赖数据库对 `IN` 的返回顺序或 `createdAt` 的边界情况

### 4. 关键实现代码（后端）

文件：`apps/backend/src/services/chat/message.service.ts`

```ts
// 分享场景：前端传入的 messageIds 顺序即「ChatBot 当前展示顺序」（包含分支/重生成筛选后的顺序）。
// 数据库 IN 查询 + createdAt 排序无法保证与展示顺序一致，因此这里按 messageIds 做稳定重排。
if (dto.messageIds?.length && Array.isArray(chatSession.messages)) {
  const orderIndex = new Map(dto.messageIds.map((id, i) => [id, i]));
  chatSession.messages.sort((a, b) => {
    const ai = orderIndex.get(a.chatId);
    const bi = orderIndex.get(b.chatId);
    // 正常情况下都能命中；未命中时回退到 createdAt，保证排序稳定
    if (ai == null && bi == null) {
      return a.createdAt.getTime() - b.createdAt.getTime();
    }
    if (ai == null) return 1;
    if (bi == null) return -1;
    return ai - bi;
  });
}
```

### 5. 验证方式

- 在 ChatBot 中切换分支/重生成，确保当前展示顺序发生变化
- 重新创建分享链接并打开分享页
- 对比 ChatBot 与分享页消息顺序，应保持一致

---

## 二、分享页：用户消息代码块不撑破宽度且对齐正确

### 1. 问题现象

在分享页（`apps/frontend/src/views/share/index.tsx`）中：

- 用户消息如果包含代码块，长行可能把气泡撑破最大宽度
- 用户消息整体可能受 `text-end` 影响出现“代码块也右对齐”的观感差异
- 手动设置 `w-full` 可以对齐，但会破坏“用户气泡随内容宽度变化”的需求

### 2. 根因分析

分享页里用户消息外层容器原先使用了 `flex-1` / `w-full` 等“拉伸”类布局，导致：

- 气泡宽度逻辑与 ChatBot 主视图不一致
- 代码块（`pre`）若未限制 `max-width` 或未开启内部滚动，会推动父容器溢出

### 3. 修复策略

目标：**用户气泡随内容宽度变化（w-fit），但不超过列宽（max-w-full），且靠右对齐（ml-auto）**；代码块内部出现横向滚动而不是撑破气泡。

具体做法：

- 分享页 `message-md-wrap`：
  - user：`ml-auto w-fit max-w-full min-w-0`
  - assistant：保持 `w-full`
- 用户消息渲染（复用 `ChatAssistantMessage` 的 Markdown 渲染）：
  - 对 `.markdown-body pre` 强制 `max-w-full + overflow-x-auto + text-left`
  - 对 `.markdown-body code` 设置 `wrap-break-word`，避免超长 token 破坏布局

### 4. 关键实现代码（前端）

#### 4.1 分享页气泡宽度规则

文件：`apps/frontend/src/views/share/index.tsx`

```tsx
<div
  id="message-md-wrap"
  className={cn(
    'relative rounded-md p-3 select-auto text-textcolor mb-5 min-w-0',
    message.role === 'user'
      ? 'bg-teal-600/5 border border-teal-500/15 text-end pt-2 pb-2.5 px-3 ml-auto w-fit max-w-full'
      : 'bg-theme/5 border border-theme/10 w-full',
  )}
>
  {/* ... */}
</div>
```

#### 4.2 用户消息的代码块布局约束

文件：`apps/frontend/src/components/design/ChatUserMessage/index.tsx`

```tsx
<ChatAssistantMessage
  message={message}
  className={cn(
    [
      'text-left min-w-0 max-w-full',
      // markdown 容器：不允许横向把父级撑破；需要时出现滚动条
      '[&_.markdown-body]:min-w-0',
      '[&_.markdown-body]:max-w-full',
      '[&_.markdown-body]:overflow-x-auto',
      '[&_.markdown-body]:text-textcolor/90!',
      // 代码块：强制在气泡内滚动，且保持左对齐（避免受 text-end 影响）
      '[&_.markdown-body_pre]:min-w-0',
      '[&_.markdown-body_pre]:max-w-full',
      '[&_.markdown-body_pre]:overflow-x-auto',
      '[&_.markdown-body_pre]:text-left',
      // 行内 code/代码 token：允许断行，避免超长字符串撑破布局
      '[&_.markdown-body_code]:wrap-break-word',
    ].join(' '),
    className,
  )}
/>
```

### 5. 验证方式

- 在分享页打开包含长代码块/长单词（如长 URL、长 base64、长标识符）的用户消息
- 预期：
  - 气泡宽度随内容变化，但不超过列宽
  - 代码块在气泡内出现横向滚动，不再撑破最大宽度
  - 代码块内容保持左对齐，整体观感与 assistant 一致

