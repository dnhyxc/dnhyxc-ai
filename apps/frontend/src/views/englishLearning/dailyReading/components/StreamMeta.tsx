import { useEffect, useState } from 'react';
import { useI18n } from '@/hooks';
import { formatElapsed, lengthLabel } from '../utils/format';

export function StreamMeta({
	startedAt,
	elapsed,
	tokens,
	level,
	length,
}: {
	startedAt: number | null;
	elapsed: number;
	tokens: number;
	level: string | null;
	length: 'short' | 'medium' | 'long' | null;
}) {
	const { t } = useI18n();
	const [now, setNow] = useState(() => Date.now());
	useEffect(() => {
		if (!startedAt) return;
		const id = window.setInterval(() => setNow(Date.now()), 1000);
		return () => window.clearInterval(id);
	}, [startedAt]);
	const ms = startedAt ? Math.max(0, now - startedAt) : elapsed;
	const passage = lengthLabel(length, t);
	return (
		<div className="flex justify-between gap-4 px-3 pt-2 pb-3 border-b border-theme/10 text-textcolor">
			<div className="flex min-w-0 items-center gap-4">
				<div className="shrink-0 text-base">
					{t('englishLearning.dailyReading.titleGenerationInfo')}
				</div>
			</div>
			<div className="flex gap-4 text-textcolor/65">
				{level ? (
					<div className="flex items-center text-sm text-textcolor/65">
						<span>{t('englishLearning.dailyReading.level')}：</span>
						<span>{level}</span>
					</div>
				) : null}
				{passage ? (
					<div className="flex items-center text-sm text-textcolor/65">
						<span>{t('englishLearning.dailyReading.length')}：</span>
						<span>{passage}</span>
					</div>
				) : null}
				<div className="flex items-center">
					<div className="text-sm">
						{t('englishLearning.dailyReading.elapsed')}：
					</div>
					<div className="mt-0.5 text-sm tabular-nums">{formatElapsed(ms)}</div>
				</div>
				<div className="flex items-center">
					<div className="text-sm">
						{t('englishLearning.dailyReading.tokens')}：
					</div>
					<div className="mt-0.5 text-sm tabular-nums">
						{tokens.toLocaleString()}
					</div>
				</div>
			</div>
		</div>
	);
}
