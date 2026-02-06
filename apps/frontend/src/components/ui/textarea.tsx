import * as React from 'react';

import { cn } from '@/lib/utils';

function Textarea({ className, ...props }: React.ComponentProps<'textarea'>) {
	return (
		<textarea
			data-slot="textarea"
			className={cn(
				'border-theme placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:bg-input/30 flex field-sizing-content min-h-16 w-full rounded-md border bg-transparent px-3 py-2 text-base shadow-xs transition-[color,box-shadow] outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50 md:text-sm',
				// 滚动条样式：宽 6px、高 6px
				'[&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar]:h-1.5',
				// 滚动条滑块：红色、圆角 6px
				'[&::-webkit-scrollbar-thumb]:bg-theme/5 [&::-webkit-scrollbar-thumb]:rounded-md',
				// 滚动条轨道：透明背景
				'[&::-webkit-scrollbar-track]:bg-transparent',
				className,
			)}
			{...props}
		/>
	);
}

export { Textarea };
