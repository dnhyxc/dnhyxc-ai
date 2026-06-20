import type { ReactNode } from 'react';
import { useEffect, useRef } from 'react';
import type { GroupImperativeHandle, Layout } from 'react-resizable-panels';
import {
	ResizableHandle,
	ResizablePanel,
	ResizablePanelGroup,
} from '@/components/ui/resizable';
import { cn } from '@/lib/utils';

export type EbookReadSplitLayoutProps = {
	/** 右侧分栏是否展开（MOKE 助手或读书想法） */
	sidePanelOpen: boolean;
	sidePanel: ReactNode;
	children: ReactNode;
};

/**
 * 电子书阅读页分栏：左阅读、右 MOKE 助手 / 读书想法（互斥，同栏位）。
 */
export function EbookReadSplitLayout({
	sidePanelOpen,
	sidePanel,
	children,
}: EbookReadSplitLayoutProps) {
	const panelGroupRef = useRef<GroupImperativeHandle | null>(null);
	const lastSplitLayoutRef = useRef<Layout>({ reader: 58, assistant: 42 });

	useEffect(() => {
		if (!sidePanelOpen) {
			panelGroupRef.current?.setLayout({ reader: 100, assistant: 0 });
			return;
		}
		panelGroupRef.current?.setLayout(lastSplitLayoutRef.current);
	}, [sidePanelOpen]);

	return (
		<ResizablePanelGroup
			id="ebook-read-split"
			orientation="horizontal"
			className="h-full min-h-0 min-w-0"
			groupRef={panelGroupRef}
			onLayoutChanged={(layout) => {
				if (sidePanelOpen) lastSplitLayoutRef.current = layout;
			}}
		>
			<ResizablePanel
				id="reader"
				defaultSize={58}
				minSize={30}
				className="min-h-0 min-w-0"
			>
				{children}
			</ResizablePanel>
			<ResizableHandle
				withHandle
				className={cn('w-0', !sidePanelOpen && 'pointer-events-none opacity-0')}
			/>
			<ResizablePanel
				id="assistant"
				defaultSize={42}
				minSize={0}
				className={cn(
					'min-h-0 min-w-0',
					!sidePanelOpen && 'pointer-events-none opacity-0',
				)}
			>
				<div className="border-theme/10 flex h-full min-h-0 min-w-0 flex-col overflow-hidden border-l contain-[inline-size]">
					<div className="min-h-0 flex-1 overflow-hidden">
						{sidePanelOpen ? sidePanel : null}
					</div>
				</div>
			</ResizablePanel>
		</ResizablePanelGroup>
	);
}
