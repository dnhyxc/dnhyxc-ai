import fs from 'node:fs';
import { requirePath } from '../../config/resolve.js';
import type { ResolvedReleaseKit } from '../../config/types.js';

export function runUpdateLatest(ctx: ResolvedReleaseKit): void {
	const tauriPath = requirePath(
		'tauriConfig',
		ctx.paths.tauriConfig,
		'请配置 paths.tauriConfig 或使用 --tauri-config',
	);
	const latestPath = requirePath(
		'latestJson',
		ctx.paths.latestJson,
		'请配置 paths.latestJson 或使用 --latest-json',
	);
	const sigPath = ctx.paths.macosSig;

	const tauriConfig = JSON.parse(fs.readFileSync(tauriPath, 'utf-8'));
	const version = tauriConfig.version;

	const latestJson = JSON.parse(fs.readFileSync(latestPath, 'utf-8'));
	latestJson.version = version;
	latestJson.pub_date = new Date().toISOString();

	const platformKey = ctx.latestJsonPlatformKey;

	if (sigPath && fs.existsSync(sigPath)) {
		const signature = fs.readFileSync(sigPath, 'utf-8').trim();
		if (!latestJson.platforms) {
			latestJson.platforms = {};
		}
		latestJson.platforms[platformKey] = {
			...latestJson.platforms[platformKey],
			signature,
		};
		console.log(`🔐 签名已更新 (${platformKey})`);
		console.log('');
	}

	fs.writeFileSync(latestPath, `${JSON.stringify(latestJson, null, '\t')}\n`);

	console.log(`📄 latest.json 已更新: version=${version}`);
	console.log('');
}
