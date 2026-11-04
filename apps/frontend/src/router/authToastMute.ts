/**
 * 鉴权清退（401 / 踢下线）期间抑制业务 error/warning Toast，
 * 避免与「别处登录 / 请先登录」叠弹。无业务 import，供 Toast 与 authSession 共用。
 */
let muteUntil = 0;

/** 开启静默窗口（可被更晚的清退再次延长） */
export function beginAuthClearToastMute(ms = 3000): void {
	const until = Date.now() + ms;
	if (until > muteUntil) muteUntil = until;
}

/** Toast 层：是否应丢弃本次 error/warning（force 除外） */
export function shouldMuteAuthClearToast(): boolean {
	return Date.now() < muteUntil;
}
