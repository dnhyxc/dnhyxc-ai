import { observer } from 'mobx-react';
import type { DailyReadingGen } from '@/service';
import englishDailyReadingStore from '@/store/englishDailyReading';
import { StreamMeta } from './StreamMeta';
import { StreamPreview } from './StreamPreview';

/** 预览自己读正文。父组件传历史记录时不订进行中的 text。 */
export const StreamPane = observer(function StreamPane({
	history,
}: {
	history: Pick<
		DailyReadingGen,
		| 'id'
		| 'status'
		| 'text'
		| 'elapsed'
		| 'tokens'
		| 'level'
		| 'length'
		| 'focus'
		| 'questionCount'
	> | null;
}) {
	const live = history == null;
	const generating = live && englishDailyReadingStore.generating;
	const text = live ? englishDailyReadingStore.text : history.text;
	const startedAt = live ? englishDailyReadingStore.startedAt : null;
	const elapsed = live ? englishDailyReadingStore.elapsed : history.elapsed;
	const tokens = live ? englishDailyReadingStore.tokens : history.tokens;
	const level = live ? englishDailyReadingStore.level : history.level;
	const length = live ? englishDailyReadingStore.length : history.length;
	const focus = live ? englishDailyReadingStore.focus : history.focus;
	const questions = live
		? englishDailyReadingStore.questions
		: history.questionCount;
	return (
		<>
			<StreamMeta
				startedAt={startedAt}
				elapsed={elapsed}
				tokens={tokens}
				level={level}
				length={length}
				focus={focus}
				questions={questions}
				readingId={history?.status === 'done' ? history.id : null}
			/>
			<div className="flex h-65">
				<StreamPreview text={text} generating={generating} />
			</div>
		</>
	);
});
