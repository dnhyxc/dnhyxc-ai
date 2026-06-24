import type { ReactNode } from 'react';
import { useCallback, useEffect, useLayoutEffect, useRef } from 'react';
import type {
	GroupImperativeHandle,
	Layout,
	PanelImperativeHandle,
} from 'react-resizable-panels';
import {
	ResizableHandle,
	ResizablePanel,
	ResizablePanelGroup,
} from '@/components/ui/resizable';
import { cn } from '@/lib/utils';
import {
	beginEbookSplitPanelPointerDrag,
	endEbookSplitPanelPointerDrag,
	notifyEbookSplitPanelResizeEnd,
} from '../utils/ebookSplitResize';

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
	const assistantPanelRef = useRef<PanelImperativeHandle | null>(null);
	const lastSplitLayoutRef = useRef<Layout>({ reader: 58, assistant: 42 });
	const splitPointerActiveRef = useRef(false);

	const finishSplitPointerDrag = useCallback(() => {
		if (!splitPointerActiveRef.current) return;
		splitPointerActiveRef.current = false;
		endEbookSplitPanelPointerDrag();
	}, []);

	useEffect(() => {
		const onPointerUp = () => finishSplitPointerDrag();
		window.addEventListener('pointerup', onPointerUp);
		window.addEventListener('pointercancel', onPointerUp);
		return () => {
			window.removeEventListener('pointerup', onPointerUp);
			window.removeEventListener('pointercancel', onPointerUp);
		};
	}, [finishSplitPointerDrag]);

	useLayoutEffect(() => {
		if (!sidePanelOpen) {
			const collapse = () => {
				assistantPanelRef.current?.collapse();
				panelGroupRef.current?.setLayout({ reader: 100, assistant: 0 });
			};
			collapse();
			let raf2 = 0;
			const raf1 = requestAnimationFrame(() => {
				collapse();
				raf2 = requestAnimationFrame(() => {
					collapse();
					notifyEbookSplitPanelResizeEnd();
				});
			});
			return () => {
				cancelAnimationFrame(raf1);
				cancelAnimationFrame(raf2);
			};
		}
		if (assistantPanelRef.current?.isCollapsed()) {
			assistantPanelRef.current.expand();
		}
		panelGroupRef.current?.setLayout(lastSplitLayoutRef.current);
		const raf = requestAnimationFrame(() => {
			notifyEbookSplitPanelResizeEnd();
		});
		return () => cancelAnimationFrame(raf);
	}, [sidePanelOpen]);

	return (
		<ResizablePanelGroup
			id="ebook-read-split"
			orientation="horizontal"
			className="h-full min-h-0 min-w-0"
			groupRef={panelGroupRef}
			onLayoutChanged={(layout) => {
				if (sidePanelOpen) lastSplitLayoutRef.current = layout;
				finishSplitPointerDrag();
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
				onPointerDown={() => {
					splitPointerActiveRef.current = true;
					beginEbookSplitPanelPointerDrag();
				}}
			/>
			<ResizablePanel
				id="assistant"
				panelRef={assistantPanelRef}
				collapsible
				collapsedSize={0}
				defaultSize={42}
				minSize={0}
				className={cn('min-h-0 min-w-0', !sidePanelOpen && 'hidden')}
			>
				{sidePanelOpen ? (
					<div className="border-theme/10 flex h-full min-h-0 min-w-0 flex-col overflow-hidden border-l contain-[inline-size]">
						<div className="min-h-0 flex-1 overflow-hidden">{sidePanel}</div>
					</div>
				) : null}
			</ResizablePanel>
		</ResizablePanelGroup>
	);
}
