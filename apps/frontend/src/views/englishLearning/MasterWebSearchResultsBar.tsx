/**
 * 单词包 / 经典句主检索阶段：展示本次拉取中 `internet_search` 返回的网页列表（抽屉）。
 */
import { useState } from 'react';
import SearchOrganics from '@/components/design/ChatAssistantMessage/SearchOrganics';
import { Button } from '@/components/ui';
import type { ChatI18nT, SearchOrganicItem } from '@/types/chat';

export function MasterWebSearchResultsBar({
	items,
	t,
}: {
	items: SearchOrganicItem[];
	t: ChatI18nT;
}) {
	const [drawerOpen, setDrawerOpen] = useState(false);
	if (!items.length) return null;
	return (
		<div className="">
			<Button
				type="button"
				variant="link"
				size="sm"
				className="text-teal-600/90 dark:text-teal-400/90 h-auto min-h-0 px-0 py-0 text-xs font-normal"
				onClick={() => setDrawerOpen(true)}
			>
				{t('englishLearning.masterSearch.viewPages', { n: items.length })}
			</Button>
			<SearchOrganics
				open={drawerOpen}
				onOpenChange={setDrawerOpen}
				organics={items}
				t={t}
			/>
		</div>
	);
}
