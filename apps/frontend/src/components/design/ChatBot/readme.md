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
