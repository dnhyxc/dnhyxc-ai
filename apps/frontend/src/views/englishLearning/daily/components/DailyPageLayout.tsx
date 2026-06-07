import type { ReactNode } from 'react';
import { PracticePageShell } from '../../practice/components/shell';

type DailyPageLayoutProps = {
	title: string;
	onBack: () => void;
	backLabel: string;
	children: ReactNode;
	contentLayout?: 'center' | 'fill';
};

/** 与练习页同构：PracticePageShell（p-5.5 外框 + px-4.5 内容区内边距） */
export function DailyPageLayout({
	title,
	onBack,
	backLabel,
	children,
	contentLayout = 'center',
}: DailyPageLayoutProps) {
	return (
		<PracticePageShell
			title={title}
			onBack={onBack}
			backLabel={backLabel}
			contentLayout={contentLayout}
		>
			{children}
		</PracticePageShell>
	);
}
