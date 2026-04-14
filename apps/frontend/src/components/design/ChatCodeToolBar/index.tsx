import { useCallback, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import {
	downloadChatCodeBlock,
	getChatCodeBlockPlainText,
	getChatCodeFloatingToolbarSnapshot,
	getPinnedChatCodeBlock,
	MERMAID_TOOLBAR_COPY_EVENT,
	MERMAID_TOOLBAR_PREVIEW_EVENT,
	MERMAID_TOOLBAR_TOGGLE_EVENT,
	subscribeChatCodeFloatingToolbar,
} from '@/utils/chatCodeToolbar';

/**
 * 将当前「吸顶」代码块工具栏渲染到 body，避免 ScrollArea 子树内 fixed 参照错误。
 */
export default function ChatCodeToolbarFloating() {
	const state = useSyncExternalStore(
		subscribeChatCodeFloatingToolbar,
		getChatCodeFloatingToolbarSnapshot,
		() => ({
			visible: false,
			top: 0,
			left: 0,
			width: 0,
			kind: 'code' as const,
			lang: '',
			pinId: -1,
			mermaidBlockId: undefined as string | undefined,
		}),
	);

	const [copied, setCopied] = useState(false);

	const onCopy = useCallback(() => {
		const block = getPinnedChatCodeBlock(state.pinId);
		if (!block) return;
		if (state.kind === 'mermaid') {
			const id = state.mermaidBlockId;
			if (!id) return;
			window.dispatchEvent(
				new CustomEvent(MERMAID_TOOLBAR_COPY_EVENT, {
					detail: { blockId: id },
				}),
			);
			setCopied(true);
			window.setTimeout(() => setCopied(false), 1500);
			return;
		}
		void navigator.clipboard.writeText(getChatCodeBlockPlainText(block));
		setCopied(true);
		window.setTimeout(() => setCopied(false), 1500);
	}, [state.kind, state.mermaidBlockId, state.pinId]);

	const onDownload = useCallback(async () => {
		const block = getPinnedChatCodeBlock(state.pinId);
		if (!block) return;
		await downloadChatCodeBlock(block, state.lang);
	}, [state.pinId, state.lang]);

	const onMermaidToggle = useCallback(() => {
		const id = state.mermaidBlockId;
		if (!id) return;
		window.dispatchEvent(
			new CustomEvent(MERMAID_TOOLBAR_TOGGLE_EVENT, {
				detail: { blockId: id },
			}),
		);
	}, [state.mermaidBlockId]);

	const onMermaidPreview = useCallback(() => {
		const id = state.mermaidBlockId;
		if (!id) return;
		window.dispatchEvent(
			new CustomEvent(MERMAID_TOOLBAR_PREVIEW_EVENT, {
				detail: { blockId: id },
			}),
		);
	}, [state.mermaidBlockId]);

	if (typeof document === 'undefined' || !state.visible || state.width < 8) {
		return null;
	}

	const node =
		state.kind === 'mermaid' ? (
			<div
				className="rounded-md bg-theme-background/50 shadow-[0_4px_10px_-4px_color-mix(in_oklch,var(--theme-background)_40%,black)] backdrop-blur-[2px]"
				style={{
					position: 'fixed',
					top: state.top,
					left: state.left,
					width: state.width,
					zIndex: 50,
					boxSizing: 'border-box',
				}}
				role="toolbar"
				aria-label="Mermaid 工具栏"
			>
				<div className="flex items-center justify-between gap-2 pl-3.5 pr-1">
					<span className="text-sm text-textcolor/80">mermaid</span>
					<div className="flex items-center h-8">
						<button
							type="button"
							className="p-0 text-sm rounded-[5px] h-6 px-2 hover:bg-theme/10 cursor-pointer text-textcolor/80 hover:text-textcolor"
							onClick={onMermaidToggle}
						>
							图/码
						</button>
						<button
							type="button"
							className="p-0 text-sm rounded-[5px] h-6 w-12.5 hover:bg-theme/10 cursor-pointer text-textcolor/80 hover:text-textcolor"
							onClick={onCopy}
						>
							{copied ? '已复制' : '复制'}
						</button>
						<button
							type="button"
							className="p-0 text-sm rounded-[5px] h-6 w-12.5 hover:bg-theme/10 cursor-pointer text-textcolor/80 hover:text-textcolor"
							onClick={onMermaidPreview}
						>
							预览
						</button>
					</div>
				</div>
			</div>
		) : (
			<div
				className="flex items-center justify-between gap-2 pl-3.5 pr-1 rounded-md bg-theme-background/50 shadow-[0_4px_10px_-4px_color-mix(in_oklch,var(--theme-background)_40%,black)] backdrop-blur-[2px]"
				style={{
					position: 'fixed',
					top: state.top,
					left: state.left,
					width: state.width,
					zIndex: 50,
					boxSizing: 'border-box',
				}}
				role="toolbar"
				aria-label="代码块工具栏"
			>
				<span className="text-sm text-textcolor/80">{state.lang}</span>
				<div className="flex items-center h-8">
					<button
						type="button"
						className="p-0 text-sm rounded-[5px] h-6 w-11 hover:bg-theme/10 cursor-pointer text-textcolor/80 hover:text-textcolor"
						onClick={onCopy}
					>
						{copied ? '已复制' : '复制'}
					</button>
					<button
						type="button"
						className="p-0 text-sm rounded-[5px] h-6 w-11 hover:bg-theme/10 cursor-pointer text-textcolor/80 hover:text-textcolor"
						onClick={onDownload}
					>
						下载
					</button>
				</div>
			</div>
		);

	return createPortal(node, document.body);
}
