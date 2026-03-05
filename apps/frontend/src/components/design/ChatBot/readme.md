## 切换会话

首次在第一条 user 消息编辑重新发送时，无法切换分支

### 点击新对话首次更新第一条 user 消息无法切换分支问题解决方案

此次更改主要修复了在流式输出后点击"新对话"，发送第一条消息并重新编辑后无法切换分支的问题。以下是具体修改的意义：

1. 修复第一条消息的分支跟踪 (ChatBot/index.tsx:496-518)

- 问题：发送第一条消息时，selectedChildMap 中没有设置 'root' 键，导致后续分支切换逻辑混乱
- 修复：在 handleNewMessage 中，当发送第一条消息（无 parentId）时，主动更新 selectedChildMap 设置 'root': 用户消息 ID

```ts
const handleNewMessage = async (content: string) => {
	// ...

	// 如果是第一条消息（没有parentId），需要先更新selectedChildMap
	if (!userMessageToUse.parentId) {
		const newSelectedChildMap = new Map(selectedChildMap);
		newSelectedChildMap.set("root", userMsgId);
		setSelectedChildMap(newSelectedChildMap);
	}

	// ...
};
```

- 意义：确保第一条消息被正确标记为根节点，为后续分支切换建立正确的基础

2. 修复消息创建时间问题 (ChatBot/tools.ts:10,27)

- 问题：新创建的消息缺少 createdAt 字段，而 findSiblings 和 buildMessageList 依赖此字段进行排序
- 修复：在 createUserMessage 和 createAssistantMessage 中添加 createdAt: new Date()
- 意义：确保所有消息都有完整的创建时间信息，避免排序时出现无效日期错误

```ts
export const createUserMessage = (
	params: CreateUserMessageParams
): Message => ({
	// ...
	createdAt: new Date(), // 新增 createdAt 字段
	// ...
});
```

3. 修复兄弟节点查找逻辑 (ChatBot/tools.ts:78-105)

- 问题：findSiblings 函数在查找根消息时逻辑不严谨，可能包含有父节点的消息
- 修复：加强根消息过滤条件，要求消息既不是任何消息的子节点，也没有父节点
- 修复：改进日期排序逻辑，优先使用 createdAt，回退到 timestamp
- 意义：确保分支切换时能正确找到所有兄弟节点，特别是编辑后创建的平行分支

```ts
export const findSiblings = (
	allMessages: Message[],
	messageId: string
): Message[] => {
	const currentMsg = allMessages.find((m) => m.chatId === messageId);
	if (!currentMsg) return [];

	const parentId = currentMsg.parentId;
	let siblings: Message[] = [];

	if (parentId) {
		siblings = allMessages.filter((m) => m.parentId === parentId);
	} else {
		const allChildren = new Set<string>();
		allMessages.forEach((m) => {
			m.childrenIds?.forEach((c) => {
				allChildren.add(c);
			});
		});
		// 过滤出所有不是任何消息子节点的消息（即根消息）
		// 同时确保消息的 parentId 为 undefined 或空
		siblings = allMessages.filter((m) => {
			// 不是任何消息的子节点
			const isNotChild = !allChildren.has(m.chatId);
			// 并且没有父节点（parentId 为 undefined 或空）
			const hasNoParent = !m.parentId;
			return isNotChild && hasNoParent;
		});
	}

	return siblings.sort(
		(a, b) =>
			(a.createdAt
				? new Date(a.createdAt).getTime()
				: new Date(a.timestamp).getTime()) -
			(b.createdAt
				? new Date(b.createdAt).getTime()
				: new Date(b.timestamp).getTime())
	);
};
```

4. 修复消息列表构建逻辑 (views/chat/tools.ts:21-31,53-56)

- 问题：buildMessageList 中根消息检测和兄弟节点排序存在同样问题
- 修复：应用与 findSiblings 相同的根消息过滤逻辑
- 修复：改进日期排序处理，避免 createdAt 为 undefined 时的错误
- 意义：确保 UI 正确显示分支切换箭头（当 siblingCount > 1 时）

5. 修复执行顺序问题 (ChatBot/index.tsx:496-518)

- 问题：selectedChildMap 更新可能在消息更新之后，导致短暂的状态不一致
- 修复：在 handleNewMessage 中先更新 selectedChildMap，再更新消息存储
- 意义：减少竞态条件，确保状态更新顺序正确

问题根本原因：当用户编辑第一条消息时，系统创建了一个新的平行分支。但由于：

1. 第一条消息没有正确标记为根节点
2. 新创建的消息缺少 createdAt 字段
3. 兄弟节点查找逻辑不严谨

导致分支切换功能无法正常工作。这些修复确保了消息树的正确构建和分支切换的逻辑一致性。

## 从历史会话重新 切换回最新输出的 assistant 消息时自动选择最新分支

1. 扩展 Store 以保存分支选择状态 (store/chat.ts)

- 添加了 sessionBranchSelections: Map<string, Map<string, string>> 来存储每个会话的分支选择状态
- 添加了三个新方法：
  - saveSessionBranchSelection() - 保存会话的分支选择
  - getSessionBranchSelection() - 获取会话的分支选择
  - clearSessionBranchSelection() - 清除会话的分支选择

2. 添加自动选择最新分支的逻辑 (components/design/ChatBot/tools.ts)

- 添加了 findLatestBranchSelection() 函数，该函数：
  - 分析消息树，找到所有根消息
  - 选择最新的（最后创建的）根消息
  - 递归选择每个层级的最新子节点
  - 返回完整的 selectedChildMap

3. 修改会话切换逻辑 (components/design/ChatBot/index.tsx)

- 在 useEffect 依赖 activeSessionId 的部分：
  - 首先尝试从 store 恢复之前保存的分支选择状态
  - 如果没有保存的状态，使用 findLatestBranchSelection() 自动选择最新分支
  - 保存自动选择的状态到 store 中

4. 在所有分支操作中保存状态 (components/design/ChatBot/index.tsx)

- 在以下函数中添加了保存分支选择状态的逻辑：
  - handleBranchChange() - 用户手动切换分支时
  - handleEditMessage() - 用户编辑消息创建新分支时
  - handleRegenerateMessage() - 用户重新生成 assistant 消息时
  - handleNewMessage() - 用户发送新消息时（包括第一条和非第一条消息）

5. 清理状态 (components/design/ChatBot/index.tsx)

- 在 clearChat() 中添加了清除当前会话分支选择状态的逻辑

### 工作原理

1. 当用户在一个会话中进行操作时（发送消息、编辑消息、重新生成、切换分支），系统会保存当前的分支选择状态到 store 中。
2. 当用户切换到其他会话时，当前会话的分支选择状态被保存。
3. 当用户切换回原来的会话时：
   - 系统首先尝试恢复之前保存的分支选择状态
   - 如果没有保存的状态（例如第一次进入会话），系统会自动选择最新分支
   - 对于有重新生成操作的会话，最新分支就是最后创建的 assistant 消息所在的分支
4. 自动选择最新分支的逻辑：
   - 从所有根消息中选择最新（最后创建）的根消息
   - 从该根消息开始，在每个层级选择最新（最后创建）的子消息
   - 构建完整的 selectedChildMap 路径

这样，当用户点击"重新生成"创建新分支后，切换到其他历史消息，再切换回来时，系统会自动显示最新生成的分支，而不是重置到默认分支。

## 详细代码修改说明

### 1. 扩展 Store 以保存分支选择状态 (`store/chat.ts`)

**问题**：切换会话时，当前会话的分支选择状态丢失，导致切换回来后无法保持用户之前选择的分支。

**解决方案**：在 ChatStore 中添加 `sessionBranchSelections` Map 来存储每个会话的分支选择状态。

```typescript
// 存储每个会话的分支选择状态：sessionId -> selectedChildMap
sessionBranchSelections: Map<string, Map<string, string>> = new Map();

// 保存会话的分支选择状态
saveSessionBranchSelection(sessionId: string, selectedChildMap: Map<string, string>) {
	if (sessionId) {
		this.sessionBranchSelections.set(sessionId, new Map(selectedChildMap));
	}
}

// 获取会话的分支选择状态
getSessionBranchSelection(sessionId: string): Map<string, string> | undefined {
	if (!sessionId) return undefined;
	const selection = this.sessionBranchSelections.get(sessionId);
	return selection ? new Map(selection) : undefined;
}

// 清除会话的分支选择状态
clearSessionBranchSelection(sessionId: string) {
	if (sessionId) {
		this.sessionBranchSelections.delete(sessionId);
	}
}
```

### 2. 添加自动选择最新分支的逻辑 (`components/design/ChatBot/tools.ts`)

**问题**：当会话没有保存的分支选择状态时（例如第一次进入），需要自动选择最新分支。

**解决方案**：添加 `findLatestBranchSelection()` 函数，自动分析消息树并选择最新分支。

```typescript
// 查找最新的分支选择：自动选择每个层级的最新（最后创建）子节点
export const findLatestBranchSelection = (
	allMessages: Message[]
): Map<string, string> => {
	const selectionMap = new Map<string, string>();

	// 找出所有根消息
	const allChildren = new Set<string>();
	allMessages.forEach((m) => {
		m.childrenIds?.forEach((c) => {
			allChildren.add(c);
		});
	});
	const rootMessages = allMessages.filter((m) => {
		const isNotChild = !allChildren.has(m.chatId);
		const hasNoParent = !m.parentId;
		return isNotChild && hasNoParent;
	});

	// 如果没有根消息，返回空Map
	if (rootMessages.length === 0) {
		return selectionMap;
	}

	// 按创建时间排序，选择最新的根消息
	const sortedRootMessages = rootMessages.sort(
		(a, b) =>
			(a.createdAt
				? new Date(a.createdAt).getTime()
				: new Date(a.timestamp).getTime()) -
			(b.createdAt
				? new Date(b.createdAt).getTime()
				: new Date(b.timestamp).getTime())
	);
	const latestRoot = sortedRootMessages[sortedRootMessages.length - 1];
	selectionMap.set("root", latestRoot.chatId);

	// 递归选择每个层级的最新子节点
	let currentMessage = latestRoot;
	while (currentMessage?.childrenIds?.length > 0) {
		// 获取当前消息的所有子节点
		const children = allMessages.filter(
			(m) => m.parentId === currentMessage.chatId
		);
		if (children.length === 0) break;

		// 按创建时间排序，选择最新的子节点
		const sortedChildren = children.sort(
			(a, b) =>
				(a.createdAt
					? new Date(a.createdAt).getTime()
					: new Date(a.timestamp).getTime()) -
				(b.createdAt
					? new Date(b.createdAt).getTime()
					: new Date(b.timestamp).getTime())
		);
		const latestChild = sortedChildren[sortedChildren.length - 1];
		selectionMap.set(currentMessage.chatId, latestChild.chatId);

		// 继续下一层级
		currentMessage = latestChild;
	}

	return selectionMap;
};
```

### 3. 修改会话切换逻辑 (`components/design/ChatBot/index.tsx`)

**问题**：切换会话时总是重置 `selectedChildMap` 为空，丢失用户的分支选择。

**解决方案**：在 `useEffect` 依赖 `activeSessionId` 时，优先恢复保存的分支选择状态。

```typescript
useEffect(() => {
	// ... 其他代码

	// 尝试从store恢复之前保存的分支选择状态
	const savedSelection = chatStore.getSessionBranchSelection(activeSessionId);

	if (chatStore.messages.length > 0) {
		if (savedSelection) {
			// 恢复之前保存的分支选择
			setSelectedChildMap(savedSelection);
		} else {
			// 没有保存的状态，检查是否需要自动选择最新分支
			const latestBranchMap = findLatestBranchSelection(chatStore.messages);
			if (latestBranchMap) {
				setSelectedChildMap(latestBranchMap);
				// 保存这个自动选择的状态
				chatStore.saveSessionBranchSelection(activeSessionId, latestBranchMap);
			} else {
				setSelectedChildMap(new Map());
			}
		}

		// ... 其他代码
	}
}, [activeSessionId]);
```

### 4. 在所有分支操作中保存状态

**问题**：用户的分支选择操作没有持久化，切换会话后丢失。

**解决方案**：在每个分支操作函数中添加保存状态的逻辑。

#### 4.1 `handleBranchChange()` - 用户手动切换分支时

```typescript
const handleBranchChange = (msgId: string, direction: "prev" | "next") => {
	// ... 分支切换逻辑

	const newSelectedChildMap = new Map(selectedChildMap);
	// ... 更新 newSelectedChildMap
	setSelectedChildMap(newSelectedChildMap);

	// 保存分支选择状态
	if (activeSessionId) {
		chatStore.saveSessionBranchSelection(activeSessionId, newSelectedChildMap);
	}
};
```

#### 4.2 `handleEditMessage()` - 用户编辑消息创建新分支时

```typescript
const handleEditMessage = async (
	content?: string,
	attachments?: UploadedFile[] | null
) => {
	// ... 编辑消息逻辑

	setSelectedChildMap(newSelectedChildMap);
	// 保存分支选择状态
	if (activeSessionId) {
		chatStore.saveSessionBranchSelection(activeSessionId, newSelectedChildMap);
	}

	// ... 发送消息
};
```

#### 4.3 `handleRegenerateMessage()` - 用户重新生成 assistant 消息时

```typescript
const handleRegenerateMessage = async (_content: string, index: number) => {
	// ... 重新生成逻辑

	setSelectedChildMap(childMap);
	// 保存分支选择状态
	if (activeSessionId) {
		chatStore.saveSessionBranchSelection(activeSessionId, childMap);
	}

	// ... 发送请求
};
```

#### 4.4 `handleNewMessage()` - 用户发送新消息时

```typescript
const handleNewMessage = async (content: string) => {
	// ... 创建新消息逻辑

	// 更新selectedChildMap：将新消息设置为选中状态
	const newSelectedChildMap = new Map(selectedChildMap);
	if (!userMessageToUse.parentId) {
		// 第一条消息（根消息）
		newSelectedChildMap.set("root", userMsgId);
	} else {
		// 非第一条消息：将新消息设置为父消息的选中子节点
		newSelectedChildMap.set(userMessageToUse.parentId, userMsgId);
	}
	setSelectedChildMap(newSelectedChildMap);

	// 保存分支选择状态
	if (activeSessionId) {
		chatStore.saveSessionBranchSelection(activeSessionId, newSelectedChildMap);
	}

	// ... 更新消息存储和发送请求
};
```

### 5. 清理状态 (`components/design/ChatBot/index.tsx`)

**问题**：清除聊天时，分支选择状态没有清理。

**解决方案**：在 `clearChat()` 中添加清理逻辑。

```typescript
const clearChat = () => {
	setInput("");
	chatStore.setAllMessages([], "", true); // isNewSession: true

	// 清除当前会话的分支选择状态
	if (activeSessionId) {
		chatStore.clearSessionBranchSelection(activeSessionId);
	}

	// ... 其他清理逻辑
};
```

## 使用场景示例

### 场景：用户重新生成消息后切换会话再返回

1. **用户在当前会话中点击"重新生成"assistant 消息**

   - 系统创建新的 assistant 分支
   - 更新 `selectedChildMap` 指向新分支
   - 保存分支选择状态到 `sessionBranchSelections`

2. **用户切换到其他历史会话**

   - 当前会话的分支选择状态被保存
   - 新会话加载，可能恢复其之前保存的分支状态

3. **用户切换回原来的会话**

   - 系统从 `sessionBranchSelections` 恢复之前保存的分支选择状态
   - 自动显示用户之前选择的分支（最新生成的 assistant 消息）

4. **如果会话没有保存的状态（第一次进入）**
   - 系统使用 `findLatestBranchSelection()` 自动选择最新分支
   - 保存这个自动选择的状态供下次使用

## 关键设计决策

1. **状态存储位置**：选择在 `ChatStore` 中存储分支选择状态，而不是组件本地状态，因为：

   - 需要跨组件生命周期持久化
   - 需要在会话切换时保持状态
   - 与消息数据一起管理更合理

2. **自动选择算法**：选择"最新创建"的消息作为默认分支，因为：

   - 用户通常关注最新的回复
   - 对于重新生成场景，最新分支通常是用户最想看到的
   - 符合大多数聊天应用的交互模式

3. **状态保存时机**：在所有分支操作中立即保存状态，确保：
   - 状态实时同步
   - 即使应用崩溃或异常退出，状态也不会丢失
   - 提供一致的用户体验

## 测试要点

1. **基本功能测试**：

   - 在当前会话中点击"重新生成"，验证新分支创建
   - 切换其他会话再返回，验证是否自动显示最新分支
   - 手动切换分支，验证状态是否保存

2. **边界条件测试**：

   - 空会话（无消息）切换
   - 单分支会话切换
   - 多层级分支结构测试

3. **异常情况测试**：
   - 网络中断后恢复
   - 应用重启后状态恢复
   - 并发操作处理

## TODO

1. 解决正在输出时的提示，同时解决跳转到最新输出的分支问题 ❌

2. 给 session 列表正在输出的 session 增加正在输出标识 ❌

3. 发送会话，立即停止时，后端无法停止大模型调用 ✅

4. 接口错误时，需要清理会话状态，防止会话状态异常 ✅

5. 前端会话接口立即停止时，需要清理会话状态，将最新添加的 user 消息和 assistant 消息从数据库中删除防止会话状态异常 ✅

6. 后端会话接口立即停止时，需要清理会话状态，将最新添加的 user 消息和 assistant 消息从数据库中删除防止会话状态异常 ✅

7. 如果发起送消息，但是立即停止了，存在建立会话接口已经完成了，但是大模型调用未曾建立，此时 session 就是空的，历史会话列表上会显示“空数据”，这种情况下，可以清除也可以不清楚这个空的 session 会话。⚠️

8. 会话的操作，比如复制、重新生成、编辑、切换分支等操作，以及发送消息操作，在 loading 状态下需要根据 sessionId 进行控制，不能在切到历史时，没有显示这些消息的操作。目前切换到历史会话时，没有显示这些消息的操作。

9. 后端给会话增加 “会话标题字段”，用于前端在会话列表中展示。
