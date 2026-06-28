import { LocateFixed } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui';
import { useI18n } from '@/hooks';
import {
	resumeEpubListenAutoFollow,
	subscribeEpubListenAutoFollow,
} from '../../utils/epub/listen/epubListenSegmentOverlay';

/** 听当前：用户手动滚动后，右下角恢复「播放内容自动滚入视口」 */
export function EpubListenFollowFab() {
	const { t } = useI18n();
	const [visible, setVisible] = useState(false);

	useEffect(
		() =>
			subscribeEpubListenAutoFollow(({ active, autoFollow }) => {
				setVisible(active && !autoFollow);
			}),
		[],
	);

	if (!visible) return null;

	return (
		<Button
			type="button"
			className="p-0! absolute bottom-4 right-4 z-20 flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border border-theme/5 bg-theme/5 text-textcolor/55 shadow-sm backdrop-blur-[2px] hover:text-textcolor/65 hover:bg-theme/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-theme/40"
			aria-label={t('ebook.read.listen.followResumeAria')}
			title={t('ebook.read.listen.followResume')}
			onClick={() => resumeEpubListenAutoFollow()}
		>
			<LocateFixed className="size-4.5" aria-hidden />
		</Button>
	);
}
