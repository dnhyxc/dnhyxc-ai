import path from 'node:path';
import { requirePath } from '../../config/resolve.js';
import type { ResolvedReleaseKit } from '../../config/types.js';
import {
	getReleaseId,
	type ReleaseUploadConfig,
	uploadToRelease,
} from '../../github/release-client.js';
import { exitIfMissingEnv } from '../../lib/required-env.js';
import { githubUserAgent } from '../../pkg/meta.js';

function parseExtraFiles(cwd: string, args: string[]): string[] {
	const out: string[] = [];
	for (let i = 0; i < args.length; i++) {
		if (args[i] === '--file' && args[i + 1]) {
			const raw = args[++i].trim();
			out.push(path.isAbsolute(raw) ? raw : path.resolve(cwd, raw));
		}
	}
	return out;
}

export async function runUploadRelease(
	cwd: string,
	ctx: ResolvedReleaseKit,
	args: string[],
): Promise<void> {
	exitIfMissingEnv(ctx, ['GITHUB_TOKEN', 'OWNER', 'APP_REPO']);

	const TOKEN = process.env.GITHUB_TOKEN!;
	const OWNER = process.env.OWNER!;
	const REPO = process.env.APP_REPO!;
	const TAG = process.env.APP_TAG || 'latest';

	const tarGz = requirePath(
		'macosTarGz',
		ctx.paths.macosTarGz,
		'请配置 paths.macosTarGz 或使用 --macos-tar-gz',
	);
	const latestJson = requirePath(
		'latestJson',
		ctx.paths.latestJson,
		'请配置 paths.latestJson 或使用 --latest-json',
	);

	const fromCli = parseExtraFiles(cwd, args);
	const extras = [...ctx.uploadExtraFiles, ...fromCli];

	const filePaths = [tarGz, latestJson, ...extras];

	const ua = githubUserAgent();
	const cfg: ReleaseUploadConfig = {
		token: TOKEN,
		owner: OWNER,
		repo: REPO,
		userAgent: ua,
	};

	console.log('');
	console.log(`🚀 开始上传到 Release: ${TAG}`);
	console.log('');
	const releaseId = await getReleaseId(cfg, TAG);
	console.log(`   Release ID: ${releaseId}`);
	console.log('');
	console.log(`📁 文件数量: ${filePaths.length}`);
	console.log('');

	for (const filePath of filePaths) {
		await uploadToRelease(cfg, filePath, releaseId);
		console.log('');
	}
}
