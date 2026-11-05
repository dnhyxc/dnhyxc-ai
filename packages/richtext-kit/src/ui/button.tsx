import { useRichTextKitSlots } from '../slots/context';
import type { RichTextButtonProps } from '../slots/types';

/** 走 slots.Button，宿主可换成 shadcn Button */
export function Button(props: RichTextButtonProps) {
	const { Button: SlotButton } = useRichTextKitSlots();
	return <SlotButton {...props} />;
}
