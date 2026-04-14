import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const _dirname = path.dirname(fileURLToPath(import.meta.url));

dotenv.config({ path: path.join(_dirname, '.env') });
dotenv.config();

const TOKEN = process.env.GITHUB_TOKEN;
const OWNER = process.env.WIKI_OWNER ?? process.env.OWNER ?? 'dnhyxc';
const REPO = process.env.WIKI_REPO ?? process.env.APP_REPO ?? 'dnhyxc-ai';
/** Wiki 页面 slug 为 Update-Info 时对应的文件名 */
const WIKI_PAGE_FILE = process.env.WIKI_UPDATE_INFO_FILE ?? 'Update-Info.md';
const SOURCE_MD = path.resolve(_dirname, '../../docs/project-update-info.md');

function runGit(
	cwd: string,
	args: string[],
	extraEnv?: Record<string, string>,
): { ok: boolean; stderr: string } {
	const res = spawnSync('git', args, {
		cwd,
		encoding: 'utf-8',
		env: { ...process.env, ...extraEnv, GIT_TERMINAL_PROMPT: '0' },
	});
	const stderr = (res.stderr ?? '').trim();
	if (res.status !== 0) {
		return {
			ok: false,
			stderr: stderr || `git ${args.join(' ')} 退出码 ${res.status}`,
		};
	}
	return { ok: true, stderr };
}

function wikiCloneUrl(): string {
	const t = encodeURIComponent(TOKEN ?? '');
	return `https://x-access-token:${t}@github.com/${OWNER}/${REPO}.wiki.git`;
}

function main(): number {
	if (
		process.env.SKIP_WIKI_SYNC === '1' ||
		process.env.SKIP_WIKI_SYNC === 'true'
	) {
		console.log('⏭️  已设置 SKIP_WIKI_SYNC，跳过 Wiki 同步');
		return 0;
	}

	if (!TOKEN) {
		console.error('❌ 未设置 GITHUB_TOKEN，无法推送 Wiki');
		console.error(
			'   与 upload-to-release 相同：需具备仓库写权限的 PAT（Personal Access Token，个人访问令牌）',
		);
		return 1;
	}

	if (!fs.existsSync(SOURCE_MD)) {
		console.error(`❌ 源文件不存在: ${SOURCE_MD}`);
		return 1;
	}

	const body = fs.readFileSync(SOURCE_MD, 'utf-8');
	const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'dnhyxc-wiki-sync-'));
	const wikiDir = path.join(tmpRoot, 'repo');

	try {
		console.log('');
		console.log('📚 同步 Wiki：Update-Info ← docs/project-update-info.md');
		console.log(`   仓库: ${OWNER}/${REPO}.wiki`);
		console.log('');

		const clone = runGit(tmpRoot, [
			'clone',
			'--depth',
			'1',
			wikiCloneUrl(),
			wikiDir,
		]);
		if (!clone.ok) {
			console.error('❌ git clone Wiki 失败');
			console.error(clone.stderr);
			return 1;
		}

		const targetPath = path.join(wikiDir, WIKI_PAGE_FILE);
		const prev = fs.existsSync(targetPath)
			? fs.readFileSync(targetPath, 'utf-8')
			: null;
		if (prev === body) {
			console.log('✅ Wiki 内容与源文件一致，无需提交');
			return 0;
		}

		fs.writeFileSync(targetPath, body, 'utf-8');

		const authorName =
			process.env.WIKI_GIT_AUTHOR_NAME ??
			process.env.GIT_AUTHOR_NAME ??
			'dnhyxc-ai-scripts';
		const authorEmail =
			process.env.WIKI_GIT_AUTHOR_EMAIL ??
			process.env.GIT_AUTHOR_EMAIL ??
			'dnhyxc-ai-sync@users.noreply.github.com';

		const add = runGit(wikiDir, ['add', WIKI_PAGE_FILE]);
		if (!add.ok) {
			console.error('❌ git add 失败');
			console.error(add.stderr);
			return 1;
		}

		const commit = runGit(
			wikiDir,
			[
				'-c',
				`user.name=${authorName}`,
				'-c',
				`user.email=${authorEmail}`,
				'commit',
				'-m',
				'docs: 同步项目更新总览（project-update-info.md）',
			],
			{
				GIT_AUTHOR_NAME: authorName,
				GIT_AUTHOR_EMAIL: authorEmail,
				GIT_COMMITTER_NAME: authorName,
				GIT_COMMITTER_EMAIL: authorEmail,
			},
		);
		if (!commit.ok) {
			if (
				/nothing to commit|无文件要提交|没有需要提交的/i.test(commit.stderr)
			) {
				console.log('✅ 无变更需要提交');
				return 0;
			}
			console.error('❌ git commit 失败');
			console.error(commit.stderr);
			return 1;
		}

		const push = runGit(wikiDir, ['push', 'origin', 'HEAD']);
		if (!push.ok) {
			console.error('❌ git push Wiki 失败');
			console.error(push.stderr);
			return 1;
		}

		console.log('✅ Wiki 已更新: Update-Info');
		console.log('');
		return 0;
	} finally {
		try {
			fs.rmSync(tmpRoot, { recursive: true, force: true });
		} catch {
			// 临时目录清理失败不影响已成功推送的结果
		}
	}
}

process.exit(main());
