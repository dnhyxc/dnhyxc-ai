import {
	type ForwardRefExoticComponent,
	forwardRef,
	type RefAttributes,
} from 'react';
import { useRichTextKitSlots } from '../slots';
import type { RichTextInputProps } from '../slots/types';

export const Input = forwardRef<HTMLInputElement, RichTextInputProps>(
	function Input(props, ref) {
		const { Input: SlotInput } = useRichTextKitSlots();
		const Comp = SlotInput as ForwardRefExoticComponent<
			RichTextInputProps & RefAttributes<HTMLInputElement>
		>;
		return <Comp ref={ref} {...props} />;
	},
);
