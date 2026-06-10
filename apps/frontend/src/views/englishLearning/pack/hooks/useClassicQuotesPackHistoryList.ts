/**
 * 经典句包历史会话明细分页
 */
import { useCallback } from 'react';
import { PACK_ITEMS_PAGE_SIZE } from '@/constants';
import {
	type EnglishClassicQuoteItem,
	listEnglishClassicQuotesPackItems,
} from '@/service';
import {
	type PackStreamHistoryPageResult,
	usePackStreamHistoryList,
} from './usePackStreamHistoryList';

export function useClassicQuotesPackHistoryList(
	streamId: string | null | undefined,
) {
	const fetchPage = useCallback(
		async (
			sid: string,
			limit: number,
			offset: number,
		): Promise<PackStreamHistoryPageResult<EnglishClassicQuoteItem>> => {
			const res = await listEnglishClassicQuotesPackItems(sid, {
				limit,
				offset,
			});
			const list = Array.isArray(res.data?.items) ? res.data.items : [];
			return {
				items: list,
				itemCount: res.data?.itemCount ?? list.length,
			};
		},
		[],
	);

	return usePackStreamHistoryList({
		streamId,
		pageSize: PACK_ITEMS_PAGE_SIZE,
		fetchPage,
	});
}
