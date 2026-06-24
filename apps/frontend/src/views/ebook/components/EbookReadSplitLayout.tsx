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

const CLOSED_LAYOUT: Layout = { reader: 100, assistant: 0 };

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
	const sidePanelOpenRef = useRef(sidePanelOpen);
	sidePanelOpenRef.current = sidePanelOpen;

	const finishSplitPointerDrag = useCallback(() => {
		if (!splitPointerActiveRef.current) return;
		splitPointerActiveRef.current = false;
		endEbookSplitPanelPointerDrag();
	}, []);

	/** 收起右侧分栏并让左侧占满（同步调用，对齐 Monaco edit 模式） */
	const applyClosedLayout = useCallback(() => {
		assistantPanelRef.current?.collapse();
		panelGroupRef.current?.setLayout(CLOSED_LAYOUT);
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
			applyClosedLayout();
			// ponytail: 仅一帧补刀 + 通知 EPUB resize；勿用 hidden 藏 panel（会打断 collapse）
			const raf = requestAnimationFrame(() => {
				applyClosedLayout();
				notifyEbookSplitPanelResizeEnd();
			});
			return () => cancelAnimationFrame(raf);
		}
		if (assistantPanelRef.current?.isCollapsed()) {
			assistantPanelRef.current.expand();
		}
		panelGroupRef.current?.setLayout(lastSplitLayoutRef.current);
		const raf = requestAnimationFrame(() => {
			notifyEbookSplitPanelResizeEnd();
		});
		return () => cancelAnimationFrame(raf);
	}, [sidePanelOpen, applyClosedLayout]);

	return (
		<ResizablePanelGroup
			id="ebook-read-split"
			orientation="horizontal"
			className="h-full min-h-0 min-w-0"
			groupRef={panelGroupRef}
			onLayoutChanged={(layout) => {
				if (sidePanelOpenRef.current) {
					lastSplitLayoutRef.current = layout;
				} else if ((layout.assistant ?? 0) > 0) {
					applyClosedLayout();
				}
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
				className={cn(
					'min-h-0 min-w-0 overflow-hidden',
					!sidePanelOpen && 'pointer-events-none opacity-0',
				)}
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
