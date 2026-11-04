import { UnauthorizedException } from '@nestjs/common';
import type { Cache } from 'cache-manager';

/** Web/桌面 与 小程序 分槽，互不覆盖 */
export type AuthClient = 'web' | 'mini';

/** 与 JWT 全局 expiresIn=7d 对齐 */
export const AUTH_SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export const AUTH_SESSION_KICKED_MESSAGE = '账号已在别处登录';

export const authSessionCacheKey = (userId: number, cli: AuthClient) =>
	`auth:session:${userId}:${cli}`;

export function isAuthClient(value: unknown): value is AuthClient {
	return value === 'web' || value === 'mini';
}

/** 只比对本票通道；缺 sid/cli 一律拒绝；本槽无 key 则 fail-open */
export async function assertSessionActive(
	cache: Cache,
	payload: { sub: number; sid?: string; cli?: string },
): Promise<void> {
	if (!payload.sid || !isAuthClient(payload.cli)) {
		throw new UnauthorizedException(AUTH_SESSION_KICKED_MESSAGE);
	}
	const current = await cache.get<string>(
		authSessionCacheKey(payload.sub, payload.cli),
	);
	if (current == null || current === '') return;
	if (current !== payload.sid) {
		throw new UnauthorizedException(AUTH_SESSION_KICKED_MESSAGE);
	}
}
