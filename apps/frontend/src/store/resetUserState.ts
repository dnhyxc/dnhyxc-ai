import { clearPluginEnabledPrefsCache } from '@/federation';
import { clearMinimaxTtsUserPrefsCache } from '@/utils/minimaxTtsPrefs';
import assistantStore from './assistant';
import ebookStore from './ebook';
import ebookAssistantStore from './ebookAssistant';
import englishAgentStore from './englishAgent';
import { clearEnglishLibraryItemsResumeCache } from './englishLibraryItemsResume';
import EnglishPackStore from './englishPack';
import { clearEnglishPracticePoolCache } from './englishPracticePool';
import knowledgeStore from './knowledge';
import knowledgeRagQaStore from './knowledgeRagQa';

let resetting = false;

/**
 * 切换账号 / 登出 / 401 时清空与用户绑定的前端缓存（知识库草稿、助手对话、英语学习 Agent、电子书书架列表 等）。
 * 可重入：并发调用只会执行一次。
 * 插件壳重挂由 setUserInfo / clearUserInfo 在 userId 落盘后再 sync（避免读到旧账号）。
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
		ebookStore.resetOnUserSwitch();
		ebookAssistantStore.resetForBook();
		clearEnglishPracticePoolCache();
		clearEnglishLibraryItemsResumeCache();
		clearMinimaxTtsUserPrefsCache();
		clearPluginEnabledPrefsCache();
	} finally {
		resetting = false;
	}
}
