import fs from 'node:fs';
import { TAURI_CONFIG_PATH } from '../lib/paths.ts';

type SemverBump = 'patch' | 'minor' | 'major';

/**
 * 按 SemVer 递增版本号。
 * - major：主版本 +1，minor/patch 归零
 * - minor：次版本 +1，patch 归零
 * - patch：修订号 +1（仅修 bug、小迭代时常用）
 */
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

function parseBumpArg(): SemverBump {
	const fromEnv = process.env.RELEASE_TYPE?.toLowerCase().trim();
	const fromArgv = process.argv[2]?.toLowerCase().trim();
	const raw = fromArgv || fromEnv || 'patch';
	if (raw === 'patch' || raw === 'minor' || raw === 'major') {
		return raw;
	}
	console.error(
		`未知的递增类型: "${raw}"。请使用: patch | minor | major\n` +
			'  示例: pnpm -C packages/scripts tsx src/version/bump-version.ts minor\n' +
			'  或: RELEASE_TYPE=major pnpm -C packages/scripts tsx src/version/bump-version.ts',
	);
	process.exit(1);
}

function bumpVersion() {
	const kind = parseBumpArg();
	const tauriConfig = JSON.parse(fs.readFileSync(TAURI_CONFIG_PATH, 'utf-8'));
	const oldVersion = String(tauriConfig.version ?? '');
	const newVersion = bumpSemver(oldVersion, kind);

	tauriConfig.version = newVersion;
	fs.writeFileSync(
		TAURI_CONFIG_PATH,
		`${JSON.stringify(tauriConfig, null, '\t')}\n`,
	);

	console.log(`🚀 版本号更新 (${kind}): ${oldVersion} -> ${newVersion}`);
	console.log('');
	console.log('📦 tauri.conf.json 版本已更新');
	console.log('');
}

bumpVersion();
