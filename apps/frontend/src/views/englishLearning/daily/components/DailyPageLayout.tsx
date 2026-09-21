import type { ReactNode } from 'react';
import { PracticePageShell } from '../../practice/components/shell';

type DailyPageLayoutProps = {
	title: string;
	onBack: () => void;
	backLabel: string;
	children: ReactNode;
	contentLayout?: 'center' | 'fill';
	/** 记词作答：隐藏壳顶栏，内容铺满白色区域 */
	flush?: boolean;
};

/** 与练习页同构：PracticePageShell（p-5.5 外框 + 内容区） */
export function DailyPageLayout({
	title,
	onBack,
	backLabel,
	children,
	contentLayout = 'center',
	flush = false,
}: DailyPageLayoutProps) {
	return (
		<PracticePageShell
			title={title}
			onBack={flush ? undefined : onBack}
			backLabel={backLabel}
			contentLayout={contentLayout}
			flush={flush}
		>
			{children}
		</PracticePageShell>
	);
}
