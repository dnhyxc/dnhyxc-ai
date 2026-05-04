import { spawnSync } from 'node:child_process';

export function runGit(
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

export function wikiCloneUrl(
	token: string,
	owner: string,
	repo: string,
): string {
	const t = encodeURIComponent(token);
	return `https://x-access-token:${t}@github.com/${owner}/${repo}.wiki.git`;
}
