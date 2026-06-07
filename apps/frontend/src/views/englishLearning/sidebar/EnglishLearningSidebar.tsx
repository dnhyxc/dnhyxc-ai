import { useI18n } from '@/hooks';
import { ClassicQuotesSection } from '../sections/classic';
import { VocabularyPackSection } from '../sections/vocabulary';
import { DailySession } from './components/DailySession';
import { EnglishSource } from './components/EnglishSource';
import { FavoriteSession } from './components/FavoriteSession';
import {
	EnglishLearningToolbar,
	type QuickIntentInputSyncPayload,
} from './components/LearningToolbar';
import { MistakeBookSession } from './components/MistakeBookSession';
import { ReviewSession } from './components/ReviewSession';

type EnglishLearningSidebarProps = {
	onQuickIntentInputSync?: (payload: QuickIntentInputSyncPayload) => void;
};

/** 英语学习首页 — 左侧 ScrollArea 全部内容 */
export function EnglishLearningSidebar({
	onQuickIntentInputSync,
}: EnglishLearningSidebarProps) {
	const { t } = useI18n();

	return (
		<>
			<DailySession />
			<EnglishLearningToolbar onQuickIntentInputSync={onQuickIntentInputSync} />
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
			<VocabularyPackSection />
			<ClassicQuotesSection />
			<FavoriteSession />
			<ReviewSession />
			<MistakeBookSession />
		</>
	);
}
