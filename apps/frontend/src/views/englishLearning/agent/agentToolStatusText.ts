/**
 * 将 Agent 工具事件格式化为单行状态文案（单词 / 经典语句拉取共用）。
 */
export function formatEnglishLearningAgentToolLine(
	t: (key: string, vars?: Record<string, string | number>) => string,
	e: { phase: 'start' | 'end' | 'organic'; name: string; query?: string },
): string {
	if (e.phase === 'organic') {
		return '';
	}
	const action =
		e.name === 'internet_search'
			? t('englishLearning.agentTool.internet')
			: e.name === 'knowledge_base_retrieval'
				? t('englishLearning.agentTool.knowledge')
				: e.name === 'get_current_date' || e.name === 'get_current_datetime'
					? t('englishLearning.agentTool.date')
					: t('englishLearning.agentTool.other', {
							name: e.name || 'tool',
						});
	const detail =
		e.phase === 'start' && e.query?.trim()
			? t('englishLearning.agentTool.querySuffix', { q: e.query.trim() })
			: '';
	return e.phase === 'end'
		? t('englishLearning.agentTool.statusDone', { action })
		: t('englishLearning.agentTool.statusDoing', { action, detail });
}
