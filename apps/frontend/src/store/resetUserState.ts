import assistantStore from './assistant';
import englishAgentStore from './englishAgent';
import EnglishPackStore from './englishPack';
import { clearEnglishPracticePoolCache } from './englishPracticePool';
import knowledgeStore from './knowledge';
import knowledgeRagQaStore from './knowledgeRagQa';

let resetting = false;

/**
 * 切换账号 / 登出 / 401 时清空与用户绑定的前端缓存（知识库草稿、助手对话、英语学习 Agent 等）。
 * 可重入：并发调用只会执行一次。
 */
export function resetUserState(): void {
	if (resetting) return;
	resetting = true;
	try {
		assistantStore.resetOnUserSwitch();
		knowledgeRagQaStore.resetConversation();
		englishAgentStore.resetConversation();
		EnglishPackStore.resetOnUserSwitch();
		knowledgeStore.resetOnUserSwitch();
		clearEnglishPracticePoolCache();
	} finally {
		resetting = false;
	}
}
