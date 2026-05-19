/**
 * 单词包 / 经典句主检索阶段：展示本次拉取中 `internet_search` 返回的网页列表（抽屉）。
 */

import { Globe } from 'lucide-react';
import { useState } from 'react';
import SearchOrganics from '@/components/design/ChatAssistantMessage/SearchOrganics';
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
		<>
			<div
				className="cursor-pointer text-teal-500 hover:text-teal-400 flex items-center shrink-0 gap-1.5 whitespace-nowrap text-sm font-medium"
				onClick={() => setDrawerOpen(true)}
			>
				<Globe className="size-4 shrink-0 opacity-90" aria-hidden />
				<span>
					{t('englishLearning.webSearch.viewPages', { n: items.length })}
				</span>
			</div>
			<SearchOrganics
				open={drawerOpen}
				onOpenChange={setDrawerOpen}
				organics={items}
				title={t('englishLearning.webSearch.viewPagesTitle', {
					n: items.length,
				})}
				t={t}
			/>
		</>
	);
}
