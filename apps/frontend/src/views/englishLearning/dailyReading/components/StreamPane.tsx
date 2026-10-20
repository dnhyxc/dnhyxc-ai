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
		'text' | 'elapsed' | 'tokens' | 'level' | 'length'
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
	return (
		<>
			<StreamMeta
				startedAt={startedAt}
				elapsed={elapsed}
				tokens={tokens}
				level={level}
				length={length}
			/>
			<div className="flex h-65">
				<StreamPreview text={text} generating={generating} />
			</div>
		</>
	);
});
