import { Button } from '@ui/index';
import { useState } from 'react';
import { useI18n } from '@/hooks';
import { cn } from '@/lib/utils';
import type { EnglishDailyReadingExtras } from '@/service';
import { QUIZ_OPTION_CLASS } from '../../daily/constants';
import { PRACTICE_PRIMARY_ACTION_BTN_CLASS } from '../../practice/constants';

const SECTION = 'text-textcolor text-sm font-semibold';

export function Quiz({
	items,
}: {
	items: NonNullable<EnglishDailyReadingExtras['questions']>;
}) {
	const { t } = useI18n();
	const [picked, setPicked] = useState<Record<number, number>>({});
	const [submitted, setSubmitted] = useState(false);
	const ready = items.every((_, index) => picked[index] != null);
	return (
		<section className="flex flex-col gap-3">
			<h2 className={SECTION}>{t('englishLearning.dailyReading.quiz')}</h2>
			{items.map((item, index) => {
				const chosen = picked[index];
				const correct = chosen === item.answer;
				return (
					<div key={index} className="flex flex-col gap-2">
						<p className="text-textcolor text-base leading-7">
							{submitted ? (
								<span
									className={cn(
										'mr-2',
										correct ? 'text-teal-500' : 'text-rose-500',
									)}
								>
									{correct
										? t('englishLearning.dailyReading.quizRight')
										: t('englishLearning.dailyReading.quizWrong')}
								</span>
							) : null}
							{item.q}
						</p>
						{item.options.map((opt, optIndex) => {
							const on = chosen === optIndex;
							const right = optIndex === item.answer;
							return (
								<Button
									key={optIndex}
									type="button"
									variant="ghost"
									aria-pressed={on}
									className={cn(
										QUIZ_OPTION_CLASS,
										submitted && 'pointer-events-none',
										!submitted &&
											on &&
											'border-teal-500/40 bg-teal-500/15 hover:bg-teal-500/15',
										submitted &&
											right &&
											'border-teal-500/40 bg-teal-500/15 hover:bg-teal-500/15',
										submitted &&
											on &&
											!right &&
											'border-rose-500/35 bg-rose-500/10 text-rose-500 hover:bg-rose-500/10',
									)}
									onClick={() =>
										setPicked((prev) => {
											if (prev[index] === optIndex) {
												const next = { ...prev };
												delete next[index];
												return next;
											}
											return { ...prev, [index]: optIndex };
										})
									}
								>
									{opt}
								</Button>
							);
						})}
					</div>
				);
			})}
			{submitted ? null : (
				<Button
					type="button"
					disabled={!ready}
					className={cn('h-10 w-full', PRACTICE_PRIMARY_ACTION_BTN_CLASS)}
					onClick={() => setSubmitted(true)}
				>
					{t('englishLearning.dailyReading.quizSubmit')}
				</Button>
			)}
		</section>
	);
}
