import type { ReactNode } from 'react';
import { useEffect, useRef } from 'react';
import type { GroupImperativeHandle, Layout } from 'react-resizable-panels';
import {
	ResizableHandle,
	ResizablePanel,
	ResizablePanelGroup,
} from '@/components/ui/resizable';
import { cn } from '@/lib/utils';
import { EbookAssistant } from './EbookAssistant';

export type EbookReadSplitLayoutProps = {
	assistantOpen: boolean;
	bookId: string;
	bookTitle: string;
	assistantInput: string;
	onAssistantInputChange: (value: string) => void;
	children: ReactNode;
};

/**
 * 电子书阅读页分栏：左阅读、右智能助手（布局对齐知识库 MarkdownEditor + KnowledgeAssistant）。
 */
export function EbookReadSplitLayout({
	assistantOpen,
	bookId,
	bookTitle,
	assistantInput,
	onAssistantInputChange,
	children,
}: EbookReadSplitLayoutProps) {
	const panelGroupRef = useRef<GroupImperativeHandle | null>(null);
	const lastSplitLayoutRef = useRef<Layout>({ reader: 58, assistant: 42 });

	useEffect(() => {
		if (!assistantOpen) {
			panelGroupRef.current?.setLayout({ reader: 100, assistant: 0 });
			return;
		}
		panelGroupRef.current?.setLayout(lastSplitLayoutRef.current);
	}, [assistantOpen]);

	return (
		<ResizablePanelGroup
			id="ebook-read-split"
			orientation="horizontal"
			className="h-full min-h-0 min-w-0"
			groupRef={panelGroupRef}
			onLayoutChanged={(layout) => {
				if (assistantOpen) lastSplitLayoutRef.current = layout;
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
				className={cn('w-0', !assistantOpen && 'pointer-events-none opacity-0')}
			/>
			<ResizablePanel
				id="assistant"
				defaultSize={42}
				minSize={0}
				className={cn(
					'min-h-0 min-w-0',
					!assistantOpen && 'pointer-events-none opacity-0',
				)}
			>
				<div className="border-theme/10 flex h-full min-h-0 min-w-0 flex-col overflow-hidden border-l contain-[inline-size]">
					<div className="min-h-0 flex-1 overflow-hidden">
						<EbookAssistant
							bookId={bookId}
							bookTitle={bookTitle}
							active={assistantOpen}
							input={assistantInput}
							onInputChange={onAssistantInputChange}
						/>
					</div>
				</div>
			</ResizablePanel>
		</ResizablePanelGroup>
	);
}
