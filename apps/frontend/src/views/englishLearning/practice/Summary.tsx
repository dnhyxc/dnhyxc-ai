/**
 * 练习结算页
 */
import { ScrollArea, Toast } from '@ui/index';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useI18n } from '@/hooks';
import { cn } from '@/lib/utils';
import {
	isEnglishTtsSupported,
	playEnglishPreferred,
	stopAllEnglishPlayback,
} from '@/utils/englishTts';
import { PRACTICE_PAGE_CONTENT_CLASS, PracticeCard } from './components/shell';
import {
	SummaryActions,
	SummaryStatsPanel,
	WrongListItem,
} from './components/summary';
import type { SummaryProps } from './types';
import { shufflePracticeItems } from './utils/grading';

export function Summary({
	results,
	practicedTotal,
	config,
	continueLoading = false,
	onRetryWrong,
	onContinuePractice,
	onBackToSetup,
}: SummaryProps) {
	const { t } = useI18n();
	const correctCount = results.filter((r) => r.correct).length;
	const wrongCount = results.length - correctCount;
	const wrongItems = useMemo(
		() => results.filter((r) => !r.correct).map((r) => r.item),
		[results],
	);
	const correctItems = useMemo(
		() => results.filter((r) => r.correct).map((r) => r.item),
		[results],
	);
	const accuracyPct =
		results.length > 0 ? Math.round((correctCount / results.length) * 100) : 0;
	const hasWrongList = wrongItems.length > 0;
	const hasWordList = wrongItems.length > 0 || correctItems.length > 0;

	const [playingKey, setPlayingKey] = useState<string | null>(null);

	const toggleWordPlay = useCallback(
		async (word: string, key: string) => {
			if (playingKey === key) {
				stopAllEnglishPlayback();
				setPlayingKey(null);
				return;
			}
			if (!isEnglishTtsSupported()) {
				Toast({
					type: 'warning',
					title: t('englishLearning.tts.unsupported'),
				});
				return;
			}
			stopAllEnglishPlayback();
			setPlayingKey(key);
			try {
				await playEnglishPreferred(word, { preferLocal: true });
			} catch {
				Toast({
					type: 'warning',
					title: t('englishLearning.tts.unsupported'),
				});
			} finally {
				setPlayingKey((k) => (k === key ? null : k));
			}
		},
		[playingKey, t],
	);

	useEffect(() => {
		return () => stopAllEnglishPlayback();
	}, []);

	const statLabels = {
		accuracy: t('englishLearning.practice.summaryAccuracy'),
		correct: t('englishLearning.practice.summaryStatCorrect'),
		wrong: t('englishLearning.practice.summaryStatWrong'),
		roundTotal: t('englishLearning.practice.summaryStatTotal'),
		practiced: t('englishLearning.practice.summaryStatPracticed'),
	};

	return (
		<div
			className={cn(
				PRACTICE_PAGE_CONTENT_CLASS,
				'flex w-full flex-col',
				hasWordList ? 'min-h-0 flex-1' : undefined,
			)}
		>
			<PracticeCard
				className={cn(
					'border-theme/10 flex flex-col overflow-hidden p-0 shadow-sm',
					hasWordList && 'min-h-0 flex-1',
				)}
			>
				<SummaryStatsPanel
					compact={hasWordList}
					accuracyPct={accuracyPct}
					correctCount={correctCount}
					wrongCount={wrongCount}
					roundTotal={results.length}
					practicedTotal={practicedTotal}
					labels={statLabels}
				/>

				{hasWordList ? (
					<div className="flex min-h-0 flex-1 flex-col">
						<div className="border-theme/10 bg-theme/5 flex shrink-0 items-center justify-between gap-2 border-b px-3 py-1.5">
							<p className="text-textcolor text-xs font-semibold sm:text-sm">
								{t('englishLearning.practice.roundWordListTitle')}
							</p>
							<div className="flex shrink-0 items-center gap-1.5">
								{wrongCount > 0 ? (
									<span className="bg-rose-600/15 text-rose-500/80 rounded-md px-2 pt-0.5 pb-1 mt-0.5 text-xs font-semibold tabular-nums">
										{t('englishLearning.practice.roundWordListWrongCount', {
											count: wrongCount,
										})}
									</span>
								) : null}
								{correctCount > 0 ? (
									<span className="bg-teal-500/15 text-teal-500/85 rounded-sm px-2 pt-0.5 pb-1 text-xs font-semibold tabular-nums dark:text-teal-400">
										{t('englishLearning.practice.roundWordListCorrectCount', {
											count: correctCount,
										})}
									</span>
								) : null}
							</div>
						</div>
						<ScrollArea
							className="min-h-0 flex-1"
							viewportClassName="max-h-full"
						>
							<div className="grid gap-2.5 p-2 sm:grid-cols-2">
								{wrongItems.map((item) => (
									<WrongListItem
										key={item.key}
										item={item}
										variant="wrong"
										playing={playingKey === item.key}
										onTogglePlay={() =>
											void toggleWordPlay(item.word, item.key)
										}
										playLabel={t('englishLearning.vocab.playWord')}
										stopLabel={t('englishLearning.tts.stop')}
									/>
								))}
								{correctItems.map((item) => (
									<WrongListItem
										key={item.key}
										item={item}
										variant="correct"
										playing={playingKey === item.key}
										onTogglePlay={() =>
											void toggleWordPlay(item.word, item.key)
										}
										playLabel={t('englishLearning.vocab.playWord')}
										stopLabel={t('englishLearning.tts.stop')}
									/>
								))}
							</div>
						</ScrollArea>
					</div>
				) : null}

				<div
					className={cn(
						'flex w-full items-center justify-between border-theme/10 h-16.5 shrink-0 border-t bg-theme/5 p-2.5',
						hasWordList && 'mt-auto',
					)}
				>
					<SummaryActions
						hasWrongItems={hasWrongList}
						continueLoading={continueLoading}
						labels={{
							retryWrong: t('englishLearning.practice.retryWrong'),
							practiceAgain: t('englishLearning.practice.practiceAgain'),
							continuePractice: t('englishLearning.practice.continuePractice'),
						}}
						onRetryWrong={() =>
							onRetryWrong(
								config.order === 'random'
									? shufflePracticeItems(wrongItems)
									: wrongItems,
							)
						}
						onBackToSetup={onBackToSetup}
						onContinuePractice={onContinuePractice}
					/>
				</div>
			</PracticeCard>
		</div>
	);
}
