import { BookOpen } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { useI18n } from '@/hooks';
import {
	focusLabel,
	formatElapsed,
	lengthLabel,
	questionsLabel,
} from '../utils/format';

export function StreamMeta({
	startedAt,
	elapsed,
	tokens,
	level,
	length,
	focus,
	questions,
	readingId,
}: {
	startedAt: number | null;
	elapsed: number;
	tokens: number;
	level: string | null;
	length: 'short' | 'medium' | 'long' | null;
	focus: 'reading' | 'vocab' | 'grammar' | 'both' | null;
	questions: number | null;
	readingId: string | null;
}) {
	const { t } = useI18n();
	const navigate = useNavigate();
	const [now, setNow] = useState(() => Date.now());
	useEffect(() => {
		if (!startedAt) return;
		const id = window.setInterval(() => setNow(Date.now()), 1000);
		return () => window.clearInterval(id);
	}, [startedAt]);
	const ms = startedAt ? Math.max(0, now - startedAt) : elapsed;
	const passage = lengthLabel(length, t);
	const focusText = focusLabel(focus, t);
	const questionsText = questionsLabel(questions, t);
	return (
		<div className="flex items-center justify-between gap-3 overflow-hidden border-b border-theme/10 px-3 py-2.5 text-textcolor">
			<div className="flex min-w-0 flex-1 flex-nowrap items-center gap-3">
				<div className="shrink-0 whitespace-nowrap text-sm">
					{t('englishLearning.dailyReading.titleGenerationInfo')}
				</div>
				<div className="flex min-w-0 flex-nowrap items-center gap-2 text-xs text-textcolor/65">
					{level ? (
						<div className="flex items-center whitespace-nowrap">
							<span>{t('englishLearning.dailyReading.level')}：</span>
							<span>{level}</span>
						</div>
					) : null}
					{passage ? (
						<div className="flex items-center whitespace-nowrap">
							<span>{t('englishLearning.dailyReading.length')}：</span>
							<span>{passage}</span>
						</div>
					) : null}
					{focusText ? (
						<div className="flex items-center whitespace-nowrap">
							<span>{t('englishLearning.dailyReading.focus')}：</span>
							<span>{focusText}</span>
						</div>
					) : null}
					{questionsText ? (
						<div className="flex items-center whitespace-nowrap">
							<span>{t('englishLearning.dailyReading.questions')}：</span>
							<span>{questionsText}</span>
						</div>
					) : null}
					<div className="flex items-center whitespace-nowrap">
						<span>{t('englishLearning.dailyReading.elapsed')}：</span>
						<span className="tabular-nums">{formatElapsed(ms)}</span>
					</div>
					<div className="flex items-center whitespace-nowrap">
						<span>{t('englishLearning.dailyReading.tokens')}：</span>
						<span className="tabular-nums">{tokens.toLocaleString()}</span>
					</div>
				</div>
			</div>
			{readingId ? (
				<button
					type="button"
					className="flex shrink-0 cursor-pointer items-center gap-1.5 whitespace-nowrap text-sm font-medium text-teal-500 hover:text-teal-400"
					onClick={() =>
						navigate(
							`/english-learning/daily-reading/${readingId}?origin=manual`,
						)
					}
				>
					<BookOpen className="size-4 shrink-0 -mb-1" aria-hidden />
					{t('englishLearning.dailyReading.openReading')}
				</button>
			) : null}
		</div>
	);
}
