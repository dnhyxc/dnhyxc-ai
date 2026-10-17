import { useRef } from 'react';
import { useI18n } from '@/hooks';
import { useEnglishSidebarMasonry } from '../hooks/useEnglishSidebarMasonry';
import { ClassicQuotesSection } from '../sections/classic';
import { VocabularyPackSection } from '../sections/vocabulary';
import { DailyReadingSession } from './components/DailyReadingSession';
import { DailySession } from './components/DailySession';
import { EnglishSource } from './components/EnglishSource';
import { FavoriteSession } from './components/FavoriteSession';
import {
	EnglishLearningToolbar,
	type QuickIntentInputSyncPayload,
} from './components/LearningToolbar';
import { MistakeBookSession } from './components/MistakeBookSession';
import { NotesSession } from './components/NotesSession';
import { PracticeReportSession } from './components/PracticeReportSession';
import { ReviewSession } from './components/ReviewSession';
import { SIDEBAR_SECTION_STACK } from './tokens';

type EnglishSidebarProps = {
	onQuickIntentInputSync?: (payload: QuickIntentInputSyncPayload) => void;
};

/** 英语学习首页 — 左侧 ScrollArea 全部内容 */
export function EnglishSidebar({
	onQuickIntentInputSync,
}: EnglishSidebarProps) {
	const { t } = useI18n();
	const masonryRef = useRef<HTMLDivElement>(null);
	useEnglishSidebarMasonry(masonryRef);

	return (
		<div ref={masonryRef} className={SIDEBAR_SECTION_STACK}>
			<DailySession />
			<EnglishSource
				type="vocab"
				title={t('englishLearning.library.vocab.title')}
				description={t('englishLearning.library.vocab.descShort')}
			/>
			<EnglishSource
				type="classic"
				title={t('englishLearning.library.classic.title')}
				description={t('englishLearning.library.classic.descShort')}
			/>
			<DailyReadingSession />
			<FavoriteSession />
			<MistakeBookSession />
			<ReviewSession />
			<PracticeReportSession />
			<EnglishLearningToolbar onQuickIntentInputSync={onQuickIntentInputSync} />
			<VocabularyPackSection />
			<ClassicQuotesSection />
			<NotesSession />
		</div>
	);
}
