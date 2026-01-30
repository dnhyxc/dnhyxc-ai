import * as SwitchPrimitive from '@radix-ui/react-switch';
import { Label } from '@ui/label';
import * as React from 'react';

import { cn } from '@/lib/utils';

function Switch({
	className,
	size = 'default',
	children,
	...props
}: React.ComponentProps<typeof SwitchPrimitive.Root> & {
	size?: 'sm' | 'default';
	children?: React.ReactNode;
}) {
	return (
		<div className="flex items-center">
			<SwitchPrimitive.Root
				data-slot="switch"
				data-size={size}
				id="airplane-mode"
				className={cn(
					'peer cursor-pointer data-[state=checked]:bg-theme/50 data-[state=unchecked]:bg-theme/20 focus-visible:border-theme/10 focus-visible:ring-theme/50 dark:data-[state=unchecked]:bg-theme/80 group/switch inline-flex shrink-0 items-center rounded-full border border-transparent shadow-xs transition-all outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50 data-[size=default]:h-[1.15rem] data-[size=default]:w-8 data-[size=sm]:h-3.5 data-[size=sm]:w-6',
					className,
				)}
				{...props}
			>
				<SwitchPrimitive.Thumb
					data-slot="switch-thumb"
					className={cn(
						'bg-theme data-[state=checked]:bg-theme/80 dark:data-[state=unchecked]:bg-theme dark:data-[state=checked]:bg-theme-background pointer-events-none block rounded-full ring-0 transition-transform group-data-[size=default]/switch:size-4 group-data-[size=sm]/switch:size-3 data-[state=checked]:translate-x-[calc(100%-2px)] data-[state=unchecked]:translate-x-0',
					)}
				/>
			</SwitchPrimitive.Root>
			{children ? (
				<Label htmlFor="airplane-mode" className="ml-2">
					{children}
				</Label>
			) : null}
		</div>
	);
}

export { Switch };
