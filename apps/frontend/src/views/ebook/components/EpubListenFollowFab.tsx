import { LocateFixed } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useI18n } from '@/hooks';
import {
	resumeEpubListenAutoFollow,
	subscribeEpubListenAutoFollow,
} from '../utils/epubListenSegmentOverlay';

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
		<button
			type="button"
			className="absolute bottom-4 right-4 z-20 flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border border-theme/5 bg-theme/5 text-textcolor/70 shadow-sm backdrop-blur-[2px] hover:bg-theme/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-theme/40"
			aria-label={t('ebook.read.listen.followResumeAria')}
			title={t('ebook.read.listen.followResume')}
			onClick={() => resumeEpubListenAutoFollow()}
		>
			<LocateFixed className="h-4 w-4" aria-hidden />
		</button>
	);
}
