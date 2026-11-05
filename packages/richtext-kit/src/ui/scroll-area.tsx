import { useRichTextKitSlots } from '../slots';
import type { RichTextScrollAreaProps } from '../slots/types';

/** 走 slots.ScrollArea；默认即 Radix/shadcn 滚动条 */
export function ScrollArea(props: RichTextScrollAreaProps) {
	const { ScrollArea: SlotScroll } = useRichTextKitSlots();
	return <SlotScroll {...props} />;
}
