import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import {
	getReleaseId,
	type ReleaseUploadConfig,
	uploadToRelease,
} from './github-release-upload.ts';

const _dirname = path.dirname(fileURLToPath(import.meta.url));

/** Tauri 打 dmg 后的默认目录（与仓库结构一致） */
const DEFAULT_DMG_DIR = path.resolve(
	_dirname,
	'../../apps/frontend/src-tauri/target/release/bundle/dmg',
);

dotenv.config();

const TOKEN = process.env.GITHUB_TOKEN;
const OWNER = process.env.OWNER;
const REPO = process.env.APP_REPO;
const TAG = process.env.APP_TAG || 'latest';

/**
 * 解析待上传的 dmg 路径：
 * 1. 命令行第一个参数
 * 2. 环境变量 DMG_PATH
 * 3. DEFAULT_DMG_DIR 下按修改时间最新的 *.dmg
 */
function resolveDmgPath(cliArg?: string): string {
	if (cliArg?.trim()) {
		return path.resolve(process.cwd(), cliArg.trim());
	}

	const fromEnv = process.env.DMG_PATH?.trim();
	if (fromEnv) {
		return path.resolve(process.cwd(), fromEnv);
	}

	if (!fs.existsSync(DEFAULT_DMG_DIR)) {
		console.error(`❌ 默认 dmg 目录不存在: ${DEFAULT_DMG_DIR}`);
		console.error(
			'   请先执行 Tauri release 构建，或通过参数 / DMG_PATH 指定 dmg 文件路径',
		);
		process.exit(1);
	}

	const entries = fs.readdirSync(DEFAULT_DMG_DIR);
	const dmgs = entries
		.filter((name) => name.toLowerCase().endsWith('.dmg'))
		.map((name) => path.join(DEFAULT_DMG_DIR, name));

	if (dmgs.length === 0) {
		console.error(`❌ 目录内未找到 .dmg 文件: ${DEFAULT_DMG_DIR}`);
		process.exit(1);
	}

	dmgs.sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);
	return dmgs[0];
}

async function main() {
	if (!TOKEN) {
		console.error('❌ 请设置 GITHUB_TOKEN 环境变量');
		console.error('   export GITHUB_TOKEN=your_github_token');
		process.exit(1);
	}

	if (!OWNER || !REPO) {
		console.error(
			'❌ 请设置 OWNER 与 APP_REPO 环境变量（与 upload-to-release 相同，指向 dnhyxc-ai-app）',
		);
		process.exit(1);
	}

	const dmgPath = resolveDmgPath(process.argv[2]);
	const cfg: ReleaseUploadConfig = { token: TOKEN, owner: OWNER, repo: REPO };

	console.log('');
	console.log(`🚀 上传 dmg 到 Release 标签: ${TAG}`);
	console.log(`📦 文件: ${dmgPath}`);
	console.log('');

	const releaseId = await getReleaseId(cfg, TAG);
	console.log(`   Release ID: ${releaseId}`);
	console.log('');

	await uploadToRelease(cfg, dmgPath, releaseId);
	console.log('');
	process.exit(0);
}

main();
