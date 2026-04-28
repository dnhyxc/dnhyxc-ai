import { useCallback, useState } from 'react';
import { useShareSelection } from './useShareSelection';

/**
 * 分享流程（share flow）通用 hook：
 * - 进入/退出分享模式
 * - 勾选状态（复用 useShareSelection）
 * - 分享弹窗 open/close（复用现有 ShareChat 组件）
 *
 * 该 hook 只管理状态与回调，不绑定具体 UI 样式。
 */
export function useShareFlow<TMessage extends { chatId: string }>({
	enabled,
	pairResolver,
	getAllMessages,
}: {
	enabled: boolean;
	pairResolver: (
		msg: TMessage,
		allMessages?: TMessage[],
	) => [string, string] | null;
	getAllMessages?: () => TMessage[];
}) {
	const [shareModelVisible, setShareModelVisible] = useState(false);

	const shareSelection = useShareSelection<TMessage>({
		enabled,
		pairResolver,
		getAllMessages,
	});

	const onShowShareModel = useCallback(() => {
		if (!enabled) return;
		setShareModelVisible(true);
	}, [enabled]);

	const onCloseShareModel = useCallback(() => {
		setShareModelVisible(false);
		shareSelection.setIsSharing(false);
		shareSelection.clearAllCheckedMessages();
	}, [shareSelection]);

	const onCancelShare = useCallback(() => {
		shareSelection.setIsSharing(false);
		shareSelection.clearAllCheckedMessages();
	}, [shareSelection]);

	const onStartShare = useCallback(
		(messagesToSelect?: TMessage[]) => {
			if (!enabled) return;
			shareSelection.setIsSharing(true);
			shareSelection.setAllCheckedMessages(messagesToSelect);
		},
		[enabled, shareSelection],
	);

	return {
		shareSelection,
		shareModelVisible,
		onShowShareModel,
		onCloseShareModel,
		onCancelShare,
		onStartShare,
	};
}
