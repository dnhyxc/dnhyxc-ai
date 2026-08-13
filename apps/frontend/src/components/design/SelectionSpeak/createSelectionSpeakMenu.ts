import type { SelectionContextMenuItemsFn } from '@design/ContextMenu';
import { Toast } from '@ui/index';
import { copyToClipboard } from '@/utils/clipboard';
import { isPlaybackAvailable } from '@/utils/speech';

type TFn = (key: string, params?: Record<string, unknown>) => string;

/**
 * 助手消息选区右键：朗读内容 + 复制内容。
 */
export function createSelectionSpeakMenu(
	t: TFn,
	onSpeak: (text: string) => boolean,
): SelectionContextMenuItemsFn {
	return (selectedText) => {
		const text = selectedText.trim();
		if (!text) return null;

		return [
			{
				type: 'item',
				id: 'speak',
				label: t('assistant.selection.speak'),
				onSelect: () => {
					if (!isPlaybackAvailable()) {
						Toast({
							type: 'warning',
							title: t('assistant.tts.unsupported'),
						});
						return;
					}
					onSpeak(text);
				},
			},
			{
				type: 'item',
				id: 'copy',
				label: t('assistant.selection.copy'),
				onSelect: () => {
					void copyToClipboard(text);
				},
			},
		];
	};
}
