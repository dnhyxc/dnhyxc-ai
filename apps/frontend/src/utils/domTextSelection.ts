/**
 * 流式 Markdown 重绘前保存 / 恢复选区（按 root 内纯文本偏移）。
 * 无选区或选区不在 root 内时 snapshot 返回 null，调用方可直接改 DOM。
 */

/** root 内纯文本起止偏移；与 DOM 节点解耦，便于 Markdown 重绘后按文本位置还原选区 */
export type TextOffsetSelection = { start: number; end: number };

/**
 * 将当前浏览器选区快照为 root 内纯文本偏移。
 * 无选区、折叠选区、或不在 root 内时返回 null，调用方可直接改 DOM。
 */
export function snapshotTextOffsetsInRoot(
	root: Node,
): TextOffsetSelection | null {
	const sel = window.getSelection();
	// 无 Selection、无 Range、或仅光标（折叠）时无需保存
	if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return null;
	const range = sel.getRangeAt(0);
	// 选区公共祖先不在 root 内，说明选中的不是本容器内容
	if (!root.contains(range.commonAncestorContainer)) return null;

	/** 把 (container, offset) 映射为「从 root 起点到该点」的纯文本字符数 */
	const toOffset = (container: Node, offset: number) => {
		const pre = document.createRange();
		// 先覆盖整个 root，再把终点收到目标点，toString 即此前全部可见文本
		pre.selectNodeContents(root);
		pre.setEnd(container, offset);
		return pre.toString().length;
	};

	try {
		return {
			start: toOffset(range.startContainer, range.startOffset),
			end: toOffset(range.endContainer, range.endOffset),
		};
	} catch {
		// Range 边界非法或 DOM 中间态时放弃快照
		return null;
	}
}

/**
 * 按纯文本偏移在 root 内重建选区。
 * 文本节点增删后仍尽量落到对应字符；结构剧变无法定位时静默放弃。
 */
export function restoreTextOffsetsInRoot(
	root: Node,
	snap: TextOffsetSelection,
): void {
	const sel = window.getSelection();
	if (!sel) return;

	/** 在 root 文本节点序列上，找到累计长度覆盖 target 的 (Text, 节点内 offset) */
	const pointAt = (target: number): { node: Text; offset: number } | null => {
		const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
		let acc = 0;
		let node = walker.nextNode();
		let last: Text | null = null;
		while (node) {
			const text = node as Text;
			const len = text.data.length;
			last = text;
			// 目标落在本节点内（含边界）：offset = target - 此前累计长度
			if (acc + len >= target) {
				return { node: text, offset: Math.max(0, target - acc) };
			}
			acc += len;
			node = walker.nextNode();
		}
		// 无文本节点则无法还原；偏移超出全文则钳到最后一个文本节点末尾
		if (!last) return null;
		return { node: last, offset: last.data.length };
	};

	const a = pointAt(Math.max(0, snap.start));
	const b = pointAt(Math.max(0, snap.end));
	if (!a || !b) return;
	try {
		const range = document.createRange();
		// offset 再钳一次，避免节点变短后 setStart/setEnd 越界
		range.setStart(a.node, Math.min(a.offset, a.node.data.length));
		range.setEnd(b.node, Math.min(b.offset, b.node.data.length));
		sel.removeAllRanges();
		sel.addRange(range);
	} catch {
		// 结构剧变时放弃恢复，不抛
	}
}
