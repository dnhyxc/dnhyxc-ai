/**
 * 导入单词解析在主站侧的会话。词库卡片负责打开，导入抽屉和导入插件负责读。
 *
 * 只记当前词库的 id 和标题。它和解析抽屉的会话分开存，点已导入词打开解析时导入抽屉仍开着，只是被盖住。
 */
export type VocabImportTarget = {
	libraryId: string;
	title: string;
};

type Session = {
	open: boolean;
	target: VocabImportTarget | null;
};

let session: Session = { open: false, target: null };
const listeners = new Set<() => void>();

function emit(): void {
	for (const listener of [...listeners]) listener();
}

export function readVocabImportSession(): Session {
	return {
		open: session.open,
		target: session.target ? { ...session.target } : null,
	};
}

export function openVocabImport(target: VocabImportTarget): void {
	if (!target.libraryId.trim()) return;
	session = {
		open: true,
		target: { libraryId: target.libraryId, title: target.title },
	};
	emit();
}

export function closeVocabImport(): void {
	if (!session.open && !session.target) return;
	session = { open: false, target: null };
	emit();
}

export function getTarget(): VocabImportTarget | null {
	return session.target ? { ...session.target } : null;
}

export function subscribeVocabImport(listener: () => void): () => void {
	listeners.add(listener);
	return () => listeners.delete(listener);
}
