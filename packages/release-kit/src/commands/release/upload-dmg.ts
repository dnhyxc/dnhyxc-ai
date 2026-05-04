import fs from 'node:fs';
import path from 'node:path';
import { requirePath } from '../../config/resolve.js';
import type { ResolvedReleaseKit } from '../../config/types.js';
import {
	getReleaseId,
	type ReleaseUploadConfig,
	uploadToRelease,
} from '../../github/release-client.js';
import { githubUserAgent } from '../../pkg/meta.js';

function resolveDmgPath(
	cwd: string,
	ctx: ResolvedReleaseKit,
	cliArg?: string,
): string {
	if (cliArg?.trim()) {
		return path.resolve(cwd, cliArg.trim());
	}

	const fromEnv = process.env.DMG_PATH?.trim();
	if (fromEnv) {
		return path.resolve(cwd, fromEnv);
	}

	const dmgDir = requirePath(
		'dmgBundleDir',
		ctx.paths.dmgBundleDir,
		'请配置 paths.dmgBundleDir、传入 dmg 文件路径参数，或设置 DMG_PATH',
	);

	if (!fs.existsSync(dmgDir)) {
		console.error(`❌ dmg 目录不存在: ${dmgDir}`);
		process.exit(1);
	}

	const entries = fs.readdirSync(dmgDir);
	const dmgs = entries
		.filter((name) => name.toLowerCase().endsWith('.dmg'))
		.map((name) => path.join(dmgDir, name));

	if (dmgs.length === 0) {
		console.error(`❌ 目录内未找到 .dmg 文件: ${dmgDir}`);
		process.exit(1);
	}

	dmgs.sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);
	return dmgs[0];
}

export async function runUploadDmg(
	cwd: string,
	ctx: ResolvedReleaseKit,
	args: string[],
): Promise<void> {
	const TOKEN = process.env.GITHUB_TOKEN;
	const OWNER = process.env.OWNER;
	const REPO = process.env.APP_REPO;
	const TAG = process.env.APP_TAG || 'latest';

	if (!TOKEN) {
		console.error('❌ 请设置 GITHUB_TOKEN 环境变量');
		process.exit(1);
	}
	if (!OWNER || !REPO) {
		console.error('❌ 请设置 OWNER 与 APP_REPO 环境变量');
		process.exit(1);
	}

	const dmgPath = resolveDmgPath(cwd, ctx, args[0]);
	const ua = githubUserAgent();
	const cfg: ReleaseUploadConfig = {
		token: TOKEN,
		owner: OWNER,
		repo: REPO,
		userAgent: ua,
	};

	console.log('');
	console.log(`🚀 上传 dmg 到 Release 标签: ${TAG}`);
	console.log(`📦 文件: ${dmgPath}`);
	console.log('');

	const releaseId = await getReleaseId(cfg, TAG);
	console.log(`   Release ID: ${releaseId}`);
	console.log('');

	await uploadToRelease(cfg, dmgPath, releaseId);
	console.log('');
}
