export type AssistantChatTurn = {
	role: 'user' | 'assistant' | 'system';
	content: string;
};

/**
 * 粗略估算 token 数（中英文混合偏保守，避免上下文超出模型限制）
 */
export function estimateTokenCount(text: string): number {
	if (!text) return 0;
	let units = 0;
	for (let i = 0; i < text.length; i++) {
		const code = text.charCodeAt(i);
		// 宽字符按约 0.6 token/字；ASCII 按约 0.25 token/字
		units += code > 255 ? 0.6 : 0.25;
	}
	return Math.ceil(units) + 2; // 每条消息预留少量结构开销
}

/**
 * 从时间正序的消息列表中，从末尾向前截取，使总估算 token 不超过 budget。
 * 保证返回的消息仍为正序，且尽量保留最近若干轮对话。
 */
export function takeRecentMessagesWithinTokenBudget(
	messages: AssistantChatTurn[],
	maxTokens: number,
): AssistantChatTurn[] {
	if (messages.length === 0 || maxTokens <= 0) return [];

	const reversed = [...messages].reverse();
	const picked: AssistantChatTurn[] = [];
	let used = 0;

	for (const m of reversed) {
		const cost = estimateTokenCount(m.content);
		if (used + cost > maxTokens) break;
		picked.push(m);
		used += cost;
	}

	return picked.reverse();
}

/**
 * 将单条文本截断到不超过 maxTokens（从末尾保留，避免丢掉用户最新输入的尾部）
 */
export function truncateContentToMaxTokens(
	content: string,
	maxTokens: number,
): string {
	if (!content || maxTokens <= 0) return '';
	if (estimateTokenCount(content) <= maxTokens) return content;
	let low = 0;
	let high = content.length;
	while (low < high) {
		const mid = Math.ceil((low + high) / 2);
		const slice = content.slice(-mid);
		if (estimateTokenCount(slice) <= maxTokens) low = mid;
		else high = mid - 1;
	}
	return content.slice(-low);
}
