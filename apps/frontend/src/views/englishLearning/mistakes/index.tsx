/**
 * 英语学习：单词错题集页
 */
import { useCallback, useState } from 'react';
import { useI18n } from '@/hooks';
import { EnglishPracticeEntry } from '../shared/practiceEntry';
import { VocabularyMistakesPanel } from './VocabularyMistakesPanel';

export default function EnglishLearningMistakesPage() {
	const { t } = useI18n();
	const [practiceState, setPracticeState] = useState({
		poolTotal: 0,
		practiceDisabled: true,
	});
	const onPracticeState = useCallback(
		(state: { poolTotal: number; practiceDisabled: boolean }) => {
			setPracticeState(state);
		},
		[],
	);

	return (
		<div className="flex min-h-0 h-full w-full flex-col">
			<div className="box-border flex h-full min-h-0 w-full min-w-0 flex-col p-5.5 pt-0">
				<div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-md bg-theme-background">
					<header className="h-12 flex shrink-0 items-center justify-between gap-4 px-4.5 py-2">
						<h2 className="text-textcolor min-w-0 text-base font-semibold">
							{t('englishLearning.mistakes.pageTitle')}
						</h2>
						<EnglishPracticeEntry
							variant="link"
							disabled={practiceState.practiceDisabled}
							practice={{
								source: 'mistakes',
								sourceTitle: t('englishLearning.practice.sourceMistakes'),
								poolTotal:
									practiceState.poolTotal > 0
										? practiceState.poolTotal
										: undefined,
							}}
						/>
					</header>
					<section className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
						<VocabularyMistakesPanel onPracticeState={onPracticeState} />
					</section>
				</div>
			</div>
		</div>
	);
}
