/** 听当前 vs 听书互斥：一方启动时停止另一方 */
type StopFn = () => void;

let stopQuoteListen: StopFn | null = null;
let stopChapterListen: StopFn | null = null;

export function registerQuoteListenStop(fn: StopFn | null): void {
	stopQuoteListen = fn;
}

export function registerChapterListenStop(fn: StopFn | null): void {
	stopChapterListen = fn;
}

export function invokeStopQuoteListen(): void {
	stopQuoteListen?.();
}

export function invokeStopChapterListen(): void {
	stopChapterListen?.();
}
