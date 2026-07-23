import type { Editor, JSONContent } from '@tiptap/core';
import { mergeAttributes, Node } from '@tiptap/core';
import { GapCursor } from '@tiptap/pm/gapcursor';
import { Plugin, PluginKey, TextSelection } from '@tiptap/pm/state';
import { ReactNodeViewRenderer } from '@tiptap/react';
import TitleView from './Title';

/** 空笔记：必有 title + 一段正文，避免只有 atom 时光标落在 GapCursor 上无法输入 */
export const EMPTY_NOTE_DOC: JSONContent = {
	type: 'doc',
	content: [{ type: 'title', attrs: { value: '' } }, { type: 'paragraph' }],
};

/** 空 HTML / 空串 → 合法笔记文档 */
export function normalizeNoteContent(
	content: string | JSONContent | undefined | null,
): string | JSONContent {
	if (content == null || content === '' || content === '<p></p>') {
		return EMPTY_NOTE_DOC;
	}
	return content;
}

/**
 * 笔记常驻标题：atom + 原生 input（attrs.value）。
 * group 不用 block，保证文档仅首位一个 title。
 */
export const TitleNode = Node.create({
	name: 'title',

	group: 'title',

	atom: true,

	draggable: false,

	selectable: false,

	addAttributes() {
		return {
			value: {
				default: '',
				parseHTML: (el) =>
					(el as HTMLElement).getAttribute('data-value') ??
					(el as HTMLElement).textContent ??
					'',
				renderHTML: (attrs) =>
					attrs.value ? { 'data-value': attrs.value as string } : {},
			},
		};
	},

	parseHTML() {
		return [{ tag: 'div[data-type="note-title"]' }];
	},

	renderHTML({ HTMLAttributes, node }) {
		return [
			'div',
			mergeAttributes(HTMLAttributes, {
				'data-type': 'note-title',
				'data-value': node.attrs.value ?? '',
			}),
			node.attrs.value ?? '',
		];
	},

	addNodeView() {
		// stopEvent：标题内交互不交给 PM，避免和正文抢输入
		return ReactNodeViewRenderer(TitleView, {
			stopEvent: () => true,
		});
	},

	addProseMirrorPlugins() {
		return [
			new Plugin({
				key: new PluginKey('singleNoteTitle'),
				appendTransaction(transactions, _old, state) {
					if (!transactions.some((tr) => tr.docChanged || tr.selectionSet))
						return null;

					let tr = state.tr;
					let changed = false;

					// 去掉多余 title
					const extras: { pos: number; nodeSize: number }[] = [];
					let seen = 0;
					state.doc.forEach((node, offset) => {
						if (node.type.name !== 'title') return;
						seen += 1;
						if (seen > 1) extras.push({ pos: offset, nodeSize: node.nodeSize });
					});
					for (let i = extras.length - 1; i >= 0; i--) {
						const { pos, nodeSize } = extras[i];
						tr.replaceWith(
							pos,
							pos + nodeSize,
							state.schema.nodes.paragraph.create(),
						);
						changed = true;
					}

					const doc = changed ? tr.doc : state.doc;
					const title = doc.firstChild;
					// 没有正文块时补一段（atom 旁 GapCursor 看起来像有光标但输不进字）
					if (title?.type.name === 'title' && doc.childCount < 2) {
						tr = tr.insert(
							title.nodeSize,
							state.schema.nodes.paragraph.create(),
						);
						changed = true;
					}

					const nextDoc = changed ? tr.doc : state.doc;
					const sel = changed ? tr.selection : state.selection;
					// 仅纠正 GapCursor：看起来有光标但父节点不是 textblock，无法输入
					const isGap =
						sel instanceof GapCursor ||
						(sel.empty && !sel.$from.parent.isTextblock);
					if (isGap && nextDoc.firstChild?.type.name === 'title') {
						const pos = nextDoc.firstChild.nodeSize + 1;
						if (pos <= nextDoc.content.size) {
							tr = tr.setSelection(TextSelection.create(nextDoc, pos));
							changed = true;
						}
					}

					return changed ? tr : null;
				},
			}),
		];
	},
});

export default TitleNode;

/** 取文档首位 title 文本，供笔记列表展示 */
export function getDocTitleText(doc: {
	firstChild?: {
		type: { name: string };
		attrs: Record<string, unknown>;
		textContent: string;
	} | null;
}): string {
	const first = doc.firstChild;
	if (first?.type.name !== 'title') return '';
	const fromAttr = first.attrs.value;
	if (typeof fromAttr === 'string') return fromAttr.trim();
	return first.textContent.trim();
}

/** 正文 Tab 缩进：列表下沉，否则插入 \t */
export function indentEditor(editor: Editor): boolean {
	if (editor.isActive('codeBlock')) return false;
	if (editor.commands.sinkListItem('listItem')) return true;
	if (editor.commands.sinkListItem('taskItem')) return true;
	return editor.commands.insertContent('\t');
}

/** 标题 input 按 Enter / Tab：跳到正文末尾 */
export function focusAfterTitle(editor: Editor) {
	const title = editor.state.doc.firstChild;
	if (!title || title.type.name !== 'title') {
		editor.commands.focus('end');
		return;
	}
	const after = title.nodeSize;
	const next = editor.state.doc.nodeAt(after);
	if (!next) {
		editor
			.chain()
			.insertContentAt(after, { type: 'paragraph' })
			.focus('end')
			.run();
		return;
	}
	editor.commands.focus('end');
}
