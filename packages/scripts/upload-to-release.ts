import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import {
	getReleaseId,
	type ReleaseUploadConfig,
	uploadToRelease,
} from './github-release-upload.ts';

const _dirname = path.dirname(fileURLToPath(import.meta.url));

dotenv.config();

const TOKEN = process.env.GITHUB_TOKEN;
const OWNER = process.env.OWNER;
const REPO = process.env.APP_REPO;
const TAG = process.env.APP_TAG || 'latest';
const FILE_PATHS = [
	path.resolve(
		_dirname,
		'../../apps/frontend/src-tauri/target/release/bundle/macos/dnhyxc-ai.app.tar.gz',
	),
	path.resolve(_dirname, '../../apps/frontend/latest.json'),
];

async function main() {
	if (!TOKEN) {
		console.error('❌ 请设置 GITHUB_TOKEN 环境变量');
		console.error('   export GITHUB_TOKEN=your_github_token');
		process.exit(1);
	}

	if (!OWNER || !REPO) {
		console.error(
			'❌ 请设置 OWNER 与 APP_REPO 环境变量（可与 upload-to-release 一致）',
		);
		process.exit(1);
	}

	const cfg: ReleaseUploadConfig = { token: TOKEN, owner: OWNER, repo: REPO };

	console.log('');
	console.log(`🚀 开始上传到 Release: ${TAG}`);
	console.log('');

	console.log(`🔍 获取 Release ID...`);
	const releaseId = await getReleaseId(cfg, TAG);
	console.log(`   Release ID: ${releaseId}`);
	console.log('');
	console.log(`📁 文件数量: ${FILE_PATHS.length}`);
	console.log('');

	for (const filePath of FILE_PATHS) {
		await uploadToRelease(cfg, filePath, releaseId);
		console.log('');
	}
	process.exit(0);
}

main();
