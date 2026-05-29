import type { ReactNode } from 'react';

type ReferencePageShellProps = {
	title: string;
	children: ReactNode;
};

export function ReferencePageShell({
	title,
	children,
}: ReferencePageShellProps) {
	return (
		<div className="flex min-h-0 h-full w-full flex-col">
			<div className="box-border flex h-full min-h-0 w-full min-w-0 flex-col p-5.5 pt-0">
				<div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-md bg-theme-background">
					<header className="flex h-12 shrink-0 items-center border-b border-theme/10 px-4.5">
						<h2 className="text-textcolor min-w-0 truncate text-base font-semibold">
							{title}
						</h2>
					</header>
					<div className="min-h-0 min-w-0 flex-1 overflow-hidden">
						{children}
					</div>
				</div>
			</div>
		</div>
	);
}
