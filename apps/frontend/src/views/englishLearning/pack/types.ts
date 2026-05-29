import type { UIEventHandler } from 'react';
import type { SearchOrganicItem } from '@/types/chat';
import type { BuildEnglishPracticeSearchParamsInput } from '../practice/types';

export type PackStreamKind = 'vocab' | 'classic';

export type PackStreamCounts = {
	loaded: number;
	total: number;
};

export type PackStreamHeaderExtras = {
	topic: string;
	masterSearchOrganic: SearchOrganicItem[];
	practiceParams: BuildEnglishPracticeSearchParamsInput | null;
};

export type PackStreamSectionSnapshot = PackStreamCounts &
	PackStreamHeaderExtras & {
		showPageLoading: boolean;
		historyLoadingText: string;
		showEmpty: boolean;
		emptyHint: string;
		onHistoryViewportScroll?: UIEventHandler<HTMLDivElement>;
	};
