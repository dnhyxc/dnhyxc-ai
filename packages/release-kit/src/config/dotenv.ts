import path from 'node:path';
import dotenv from 'dotenv';

/**
 * 解析 release-kit 使用的 .env 绝对路径（与 CLI 入口逻辑一致）。
 * @param cwd 进程当前工作目录（通常为业务包根目录）
 * @param ctxRoot release-kit.config.json 中的 root（已解析为绝对路径）
 * @param flagsDotenvPath 全局参数 --dotenv，未传则使用 `<ctxRoot>/.env`
 */
export function resolveDotenvPath(
	cwd: string,
	ctxRoot: string,
	flagsDotenvPath?: string,
): string {
	const raw = flagsDotenvPath ?? path.join(ctxRoot, '.env');
	const abs = path.isAbsolute(raw) ? raw : path.resolve(cwd, raw);
	return path.normalize(abs);
}

/** 加载 .env：先指定文件，再允许进程环境覆盖（quiet 避免污染 stdout，便于 eval 捕获 print-tauri-signing-env） */
export function loadKitDotenv(dotenvPath: string): void {
	dotenv.config({ path: dotenvPath, quiet: true });
	dotenv.config({ quiet: true });
}
