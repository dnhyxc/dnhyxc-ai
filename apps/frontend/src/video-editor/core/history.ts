import { applyOperation } from './doc';
import type { Operation, ProjectDoc } from './types';

export type HistoryState = {
	doc: ProjectDoc;
	undo: Operation[];
	redo: Operation[];
};

export function createHistoryState(doc: ProjectDoc): HistoryState {
	return { doc, undo: [], redo: [] };
}

export function pushOperation(
	state: HistoryState,
	op: Operation,
): { state: HistoryState; warnings: string[] } {
	const { doc, warnings } = applyOperation(state.doc, op);
	return {
		state: {
			doc,
			undo: [...state.undo, op],
			redo: [],
		},
		warnings,
	};
}

/**
 * undo 的实现策略：
 * - 一期采用“回放重建”：把初始 doc（不含 oplog）+ undo 栈重新 apply。
 * - 优点：不需要为每个操作维护 inverse。
 * - 缺点：大工程 O(n)。二期可改为 inverse 或 checkpoint。
 */
export function undo(
	state: HistoryState,
	seed: ProjectDoc,
): { state: HistoryState; warnings: string[] } {
	if (state.undo.length === 0) return { state, warnings: [] };
	const undoOps = state.undo.slice(0, -1);
	const last = state.undo[state.undo.length - 1]!;
	let doc = { ...seed, oplog: [] as Operation[] };
	const warnings: string[] = [];
	for (const op of undoOps) {
		const res = applyOperation(doc, op);
		doc = res.doc;
		warnings.push(...res.warnings);
	}
	return {
		state: {
			doc,
			undo: undoOps,
			redo: [last, ...state.redo],
		},
		warnings,
	};
}

export function redo(state: HistoryState): {
	state: HistoryState;
	warnings: string[];
} {
	if (state.redo.length === 0) return { state, warnings: [] };
	const nextOp = state.redo[0]!;
	const res = applyOperation(state.doc, nextOp);
	return {
		state: {
			doc: res.doc,
			undo: [...state.undo, nextOp],
			redo: state.redo.slice(1),
		},
		warnings: res.warnings,
	};
}
