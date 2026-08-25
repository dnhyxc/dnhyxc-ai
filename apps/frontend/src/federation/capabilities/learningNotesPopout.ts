export function isLearningNotesPopoutPath(): boolean {
	if (typeof window === 'undefined') return false;
	return window.location.pathname === '/english-learning/notes/popout';
}
