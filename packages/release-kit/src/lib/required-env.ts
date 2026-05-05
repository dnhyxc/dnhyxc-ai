import fs from 'node:fs';
import type { ResolvedReleaseKit } from '../config/types.js';

function hintPath(ctx: ResolvedReleaseKit): string {
	const p = ctx.dotenvPath?.trim();
	return p && p.length > 0
		? p
		: '<root>/.env（或通过全局参数 --dotenv 指定路径）';
}

/**
 * 在缺少任一变量时打印说明并退出进程（stderr）。
 * @param title 首行标题（不含 ❌ 前缀时可自行带标点）
 */
export function exitIfMissingEnv(
	ctx: ResolvedReleaseKit,
	keys: string[],
	title = '缺少以下环境变量（用于当前子命令）：',
): void {
	const missing = keys.filter((k) => {
		const v = process.env[k];
		return v === undefined || String(v).trim() === '';
	});
	if (missing.length === 0) return;

	console.error(`❌ ${title}`);
	for (const k of missing) {
		console.error(`   - ${k}`);
	}
	console.error('');
	console.error(
		'请在下列文件中配置上述变量（或通过当前 shell / CI 注入环境变量），然后重试：',
	);
	console.error(`   ${hintPath(ctx)}`);
	const p = ctx.dotenvPath;
	if (p && !fs.existsSync(p)) {
		console.error('');
		console.error(
			'（提示：上述 .env 文件目前不存在，可在项目根目录新建该文件。）',
		);
	}
	process.exit(1);
}

/** 非致命：在已有错误信息后追加 .env 路径提示（用于 Wiki 等返回码场景） */
export function logDotenvConfigurationHint(ctx: ResolvedReleaseKit): void {
	console.error('');
	console.error('若使用文件配置，可将变量写入：');
	console.error(`   ${hintPath(ctx)}`);
	const p = ctx.dotenvPath;
	if (p && !fs.existsSync(p)) {
		console.error('（当前该路径下文件不存在。）');
	}
}
