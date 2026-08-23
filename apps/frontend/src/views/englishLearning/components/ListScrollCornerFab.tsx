import { ScrollFab, type ScrollFabMode } from '@design/Assistant';
import { useI18n } from '@/hooks';

export type ListScrollCornerFabProps = {
	mode: ScrollFabMode;
	onClick: () => void;
};

/** 英语学习列表右下角：置顶 / 置底（与 useListScrollCornerFab 联用） */
export function ListScrollCornerFab({
	mode,
	onClick,
}: ListScrollCornerFabProps) {
	const { t } = useI18n();
	if (mode === 'hidden') return null;
	return (
		<ScrollFab
			mode={mode}
			onClick={onClick}
			variant="corner"
			toBottomLabel={t('englishLearning.list.scrollToBottom')}
			toTopLabel={t('englishLearning.list.scrollToTop')}
		/>
	);
}
