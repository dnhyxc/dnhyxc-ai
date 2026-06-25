import type { ReactNode } from 'react';
import { useCallback, useEffect, useLayoutEffect, useRef } from 'react';
import type { GroupImperativeHandle, Layout } from 'react-resizable-panels';
import {
	ResizableHandle,
	ResizablePanel,
	ResizablePanelGroup,
} from '@/components/ui/resizable';
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
 * ponytail: 关闭时不挂右栏 panel，避免 collapse/setLayout 偶发失效留空白列。
 */
export function EbookReadSplitLayout({
	sidePanelOpen,
	sidePanel,
	children,
}: EbookReadSplitLayoutProps) {
	const panelGroupRef = useRef<GroupImperativeHandle | null>(null);
	const lastSplitLayoutRef = useRef<Layout>({ reader: 58, assistant: 42 });
	const splitPointerActiveRef = useRef(false);
	const sidePanelOpenRef = useRef(sidePanelOpen);
	sidePanelOpenRef.current = sidePanelOpen;

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
		const done = () => notifyEbookSplitPanelResizeEnd();
		if (!sidePanelOpen) {
			// 右栏卸载后须显式把 reader 扩到 100%，否则 flex 仍可能保留上次 58/42
			const raf = requestAnimationFrame(() => {
				try {
					panelGroupRef.current?.setLayout({ reader: 100 });
				} catch {
					// ponytail: 分组 panel 数变化时 setLayout 可能短暂失败，下一帧 layout effect 会再试
				}
				done();
			});
			return () => cancelAnimationFrame(raf);
		}
		const raf = requestAnimationFrame(() => {
			if (!sidePanelOpenRef.current) return;
			panelGroupRef.current?.setLayout(lastSplitLayoutRef.current);
			done();
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
				if (sidePanelOpenRef.current) {
					lastSplitLayoutRef.current = layout;
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
			{sidePanelOpen ? (
				<>
					<ResizableHandle
						withHandle
						className="w-0"
						onPointerDown={() => {
							splitPointerActiveRef.current = true;
							beginEbookSplitPanelPointerDrag();
						}}
					/>
					<ResizablePanel
						id="assistant"
						defaultSize={42}
						minSize={0}
						className="min-h-0 min-w-0 overflow-hidden"
					>
						<div className="border-theme/10 flex h-full min-h-0 min-w-0 flex-col overflow-hidden border-l contain-[inline-size]">
							<div className="min-h-0 flex-1 overflow-hidden">{sidePanel}</div>
						</div>
					</ResizablePanel>
				</>
			) : null}
		</ResizablePanelGroup>
	);
}
