import { useCallback, useMemo, useRef } from 'react';
import { useI18n } from '@/hooks';
import { createSelectionSpeakMenu } from './createSelectionSpeakMenu';
import {
	SelectionSpeakBar,
	type SelectionSpeakBarSizeProps,
} from './SelectionSpeakBar';
import { useSelectionSpeak } from './useSelectionSpeak';

export type AssistantSelectionSpeakOptions = SelectionSpeakBarSizeProps & {
	/** 开播前钩子（如听书页先停章节听书） */
	onBeforeStart?: () => void;
};

/**
 * 助手选区朗读会话：菜单项工厂 + Footer 悬浮条 + stop。
 * 挂到 AssistantMessageRow.getSelectionContextMenuItems / AssistantFooter.floatAbove。
 *
 * 参数兼容：`() => void`（仅 onBeforeStart）或 options 对象。
 * 悬浮条拖动边界固定为 Layout `[data-app-layout]`，无需再传面板 ref。
 */
export function useAssistantSelectionSpeak(
	opts?: (() => void) | AssistantSelectionSpeakOptions,
) {
	const { t } = useI18n();
	const speak = useSelectionSpeak();
	const normalized =
		typeof opts === 'function' ? { onBeforeStart: opts } : (opts ?? {});
	const onBeforeStartRef = useRef(normalized.onBeforeStart);
	onBeforeStartRef.current = normalized.onBeforeStart;
	const initialWidth = normalized.initialWidth;
	const initialHeight = normalized.initialHeight;
	const resizeHandles = normalized.resizeHandles;

	const start = useCallback(
		(text: string) => {
			onBeforeStartRef.current?.();
			return speak.start(text);
		},
		[speak.start],
	);

	const getSelectionContextMenuItems = useMemo(
		() => createSelectionSpeakMenu(t, start),
		[t, start],
	);

	const floatAbove = useMemo(
		() =>
			speak.visible ? (
				<SelectionSpeakBar
					status={speak.status}
					rate={speak.rate}
					preview={speak.preview}
					onTogglePlay={speak.togglePlay}
					onStop={speak.stop}
					onRateChange={speak.setRate}
					initialWidth={initialWidth}
					initialHeight={initialHeight}
					resizeHandles={resizeHandles}
				/>
			) : null,
		[
			speak.visible,
			speak.status,
			speak.rate,
			speak.preview,
			speak.togglePlay,
			speak.stop,
			speak.setRate,
			initialWidth,
			initialHeight,
			resizeHandles,
		],
	);

	return {
		/** 朗读任意文本（选区菜单 / 消息操作条整条朗读共用） */
		start,
		getSelectionContextMenuItems,
		floatAbove,
		stop: speak.stop,
		visible: speak.visible,
	};
}
