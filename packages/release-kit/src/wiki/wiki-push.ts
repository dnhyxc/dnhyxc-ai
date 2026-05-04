import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { runGit, wikiCloneUrl } from './wiki-git.js';

export type WikiPushParams = {
	token: string;
	owner: string;
	repo: string;
	pageFile: string;
	sourceMdPath: string;
	commitMessage: string;
	logTitle: string;
};

/**
 * 将本地 Markdown 推送到 GitHub Wiki 仓库中的指定页面文件。
 */
export function pushMarkdownToWiki(p: WikiPushParams): number {
	if (!fs.existsSync(p.sourceMdPath)) {
		console.error(`❌ 源文件不存在: ${p.sourceMdPath}`);
		return 1;
	}

	const body = fs.readFileSync(p.sourceMdPath, 'utf-8');
	const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'release-kit-wiki-'));
	const wikiDir = path.join(tmpRoot, 'repo');

	try {
		console.log('');
		console.log(`📚 ${p.logTitle}`);
		console.log(`   仓库: ${p.owner}/${p.repo}.wiki`);
		console.log('');

		const clone = runGit(tmpRoot, [
			'clone',
			'--depth',
			'1',
			wikiCloneUrl(p.token, p.owner, p.repo),
			wikiDir,
		]);
		if (!clone.ok) {
			console.error('❌ git clone Wiki 失败');
			console.error(clone.stderr);
			return 1;
		}

		const targetPath = path.join(wikiDir, p.pageFile);
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
			'release-kit';
		const authorEmail =
			process.env.WIKI_GIT_AUTHOR_EMAIL ??
			process.env.GIT_AUTHOR_EMAIL ??
			'release-kit@users.noreply.github.com';

		const add = runGit(wikiDir, ['add', p.pageFile]);
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
				p.commitMessage,
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

		console.log('✅ Wiki 已更新');
		console.log('');
		return 0;
	} finally {
		try {
			fs.rmSync(tmpRoot, { recursive: true, force: true });
		} catch {
			// 临时目录清理失败可忽略
		}
	}
}
