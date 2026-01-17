import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const TAURI_CONFIG_PATH = path.resolve(
	__dirname,
	'../../apps/frontend/src-tauri/tauri.conf.json',
);

function bumpVersion() {
	const tauriConfig = JSON.parse(fs.readFileSync(TAURI_CONFIG_PATH, 'utf-8'));
	const [major, minor, patch] = tauriConfig.version.split('.').map(Number);
	const newPatch = patch + 1;
	const newVersion = `${major}.${minor}.${newPatch}`;

	tauriConfig.version = newVersion;
	fs.writeFileSync(
		TAURI_CONFIG_PATH,
		`${JSON.stringify(tauriConfig, null, '\t')}\n`,
	);

	console.log(`🚀 版本号更新: ${tauriConfig.version} -> ${newVersion}`);
	console.log('');
	console.log(`📦 tauri.conf.json 版本已更新`);
	console.log('');
}

bumpVersion();
