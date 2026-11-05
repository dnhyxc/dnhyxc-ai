import { createContext, type ReactNode, useContext, useMemo } from 'react';
import { defaultRichTextKitSlots } from './defaults';
import type { RichTextKitSlots } from './types';

const RichTextKitSlotsContext = createContext<RichTextKitSlots | null>(null);

export function RichTextKitProvider({
	slots,
	children,
}: {
	slots?: Partial<RichTextKitSlots>;
	children: ReactNode;
}) {
	const value = useMemo(
		() => ({ ...defaultRichTextKitSlots, ...slots }),
		[slots],
	);
	return (
		<RichTextKitSlotsContext.Provider value={value}>
			{children}
		</RichTextKitSlotsContext.Provider>
	);
}

export function useRichTextKitSlots(): RichTextKitSlots {
	return useContext(RichTextKitSlotsContext) ?? defaultRichTextKitSlots;
}

export function mergeRichTextKitSlots(
	partial?: Partial<RichTextKitSlots>,
): RichTextKitSlots {
	return { ...defaultRichTextKitSlots, ...partial };
}
