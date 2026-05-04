import fs from 'node:fs';
import { requirePath } from '../../config/resolve.js';
import type { ResolvedReleaseKit } from '../../config/types.js';

type SemverBump = 'patch' | 'minor' | 'major';

function bumpSemver(version: string, kind: SemverBump): string {
	const parts = version.split('.');
	if (parts.length !== 3) {
		throw new Error(
			`版本号须为 major.minor.patch 三段数字，当前为: ${version}`,
		);
	}
	const nums = parts.map((p) => {
		const n = Number(p);
		if (!Number.isInteger(n) || n < 0) {
			throw new Error(`非法版本段 "${p}"（须为非负整数）`);
		}
		return n;
	});
	let [major, minor, patch] = nums;
	if (kind === 'major') {
		major += 1;
		minor = 0;
		patch = 0;
	} else if (kind === 'minor') {
		minor += 1;
		patch = 0;
	} else {
		patch += 1;
	}
	return `${major}.${minor}.${patch}`;
}

function parseKind(args: string[]): SemverBump {
	const fromEnv = process.env.RELEASE_TYPE?.toLowerCase().trim();
	const fromArgv = args[0]?.toLowerCase().trim();
	const raw = fromArgv || fromEnv || 'patch';
	if (raw === 'patch' || raw === 'minor' || raw === 'major') {
		return raw;
	}
	console.error(
		`未知的递增类型: "${raw}"。请使用: patch | minor | major\n` +
			'  示例: release-kit bump-version minor\n' +
			'  或: RELEASE_TYPE=major release-kit bump-version',
	);
	process.exit(1);
}

export function runBumpVersion(ctx: ResolvedReleaseKit, args: string[]): void {
	const tauriPath = requirePath(
		'tauriConfig',
		ctx.paths.tauriConfig,
		'请在 release-kit.config.json 中配置 paths.tauriConfig，或传入 --tauri-config',
	);
	const kind = parseKind(args);
	const tauriConfig = JSON.parse(fs.readFileSync(tauriPath, 'utf-8'));
	const oldVersion = String(tauriConfig.version ?? '');
	const newVersion = bumpSemver(oldVersion, kind);

	tauriConfig.version = newVersion;
	fs.writeFileSync(tauriPath, `${JSON.stringify(tauriConfig, null, '\t')}\n`);

	console.log(`🚀 版本号更新 (${kind}): ${oldVersion} -> ${newVersion}`);
	console.log('');
	console.log(`📦 已写入: ${tauriPath}`);
	console.log('');
}
