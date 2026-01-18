import type * as React from 'react';

import { cn } from '@/lib/utils';

function Input({ className, type, ...props }: React.ComponentProps<'input'>) {
	return (
		<input
			type={type}
			data-slot="input"
			className={cn(
				'file:text-textcolor placeholder:text-textcolor/60 selection:bg-theme selection:text-default dark:bg-input/30 border border-theme h-9 w-full min-w-0 rounded-md bg-transparent px-3 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm',
				'focus-visible:border-theme/50 focus-visible:ring-theme/30 focus-visible:ring-[3px]',
				'aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive',
				className,
			)}
			// 禁用自动大写、自动纠正和拼写检查，避免干扰用户输入
			autoCapitalize="off"
			autoCorrect="off"
			spellCheck="false"
			{...props}
		/>
	);
}

export { Input };
