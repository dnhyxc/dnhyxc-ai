import type { SelectionContextMenuItemsFn } from '@design/ContextMenu';
import { Toast } from '@ui/index';
import { copyToClipboard } from '@/utils/clipboard';
import { isPlaybackAvailable } from '@/utils/speech';

type TFn = (key: string, params?: Record<string, unknown>) => string;

/**
 * 英语 Agent 消息选区右键：朗读（由外部会话启动）+ 复制。
 */
export function createEnglishAgentSelectionMenu(
	t: TFn,
	onSpeak: (text: string) => boolean,
): SelectionContextMenuItemsFn {
	return (selectedText, _ctx) => {
		const text = selectedText.trim();
		if (!text) return null;

		return [
			{
				type: 'item',
				id: 'speak',
				label: t('englishLearning.selection.speak'),
				onSelect: () => {
					if (!isPlaybackAvailable()) {
						Toast({
							type: 'warning',
							title: t('englishLearning.tts.unsupported'),
						});
						return;
					}
					onSpeak(text);
				},
			},
			{
				type: 'item',
				id: 'copy',
				label: t('englishLearning.selection.copy'),
				onSelect: () => {
					void copyToClipboard(text);
				},
			},
		];
	};
}
