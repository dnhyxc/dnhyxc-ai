import type { ResolvedReleaseKit } from '../../config/types.js';
import { exitIfMissingEnv } from '../../lib/required-env.js';

/** 与 bash 中 `sed 's/"/\\"/g'` 一致，供 `eval $(release-kit print-tauri-signing-env)` 使用 */
function escapeForEvalDoubleQuoted(value: string): string {
	return value.replace(/"/g, '\\"');
}

/**
 * 从已加载的 process.env（含 .env）读取 Tauri 签名变量，向 stdout 输出可 eval 的 export 行。
 * 等价于原 packages/release-run/export.sh --print。
 */
export function runPrintTauriSigningEnv(ctx: ResolvedReleaseKit): void {
	exitIfMissingEnv(
		ctx,
		['TAURI_SIGNING_PRIVATE_KEY', 'TAURI_SIGNING_PRIVATE_KEY_PASSWORD'],
		'缺少 Tauri 增量签名所需环境变量，请在项目根目录中的 .env 中配置相应的变量',
	);

	const key = String(process.env.TAURI_SIGNING_PRIVATE_KEY).trim();
	const pass = String(process.env.TAURI_SIGNING_PRIVATE_KEY_PASSWORD).trim();

	process.stdout.write(
		`export TAURI_SIGNING_PRIVATE_KEY="${escapeForEvalDoubleQuoted(key)}"\n` +
			`export TAURI_SIGNING_PRIVATE_KEY_PASSWORD="${escapeForEvalDoubleQuoted(pass)}"\n`,
	);
}
