import type { ReactNode } from 'react';

type ReferencePageShellProps = {
	children: ReactNode;
};

export function ReferencePageShell({ children }: ReferencePageShellProps) {
	return (
		<div className="flex min-h-0 h-full w-full flex-col">
			<div className="box-border flex h-full min-h-0 w-full min-w-0 flex-col p-5.5 pt-0">
				<div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-md bg-theme-background">
					<div className="min-h-0 min-w-0 flex-1 overflow-hidden">
						{children}
					</div>
				</div>
			</div>
		</div>
	);
}
