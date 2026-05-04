import fs from 'node:fs';
import {
	LATEST_JSON_PATH,
	MACOS_SIG_PATH,
	TAURI_CONFIG_PATH,
} from '../lib/paths.ts';

function updateLatestJson() {
	const tauriConfig = JSON.parse(fs.readFileSync(TAURI_CONFIG_PATH, 'utf-8'));
	const version = tauriConfig.version;

	const latestJson = JSON.parse(fs.readFileSync(LATEST_JSON_PATH, 'utf-8'));
	latestJson.version = version;
	latestJson.pub_date = new Date().toISOString();

	if (fs.existsSync(MACOS_SIG_PATH)) {
		const signature = fs.readFileSync(MACOS_SIG_PATH, 'utf-8').trim();
		if (!latestJson.platforms) {
			latestJson.platforms = {};
		}
		latestJson.platforms['darwin-aarch64'] = {
			...latestJson.platforms['darwin-aarch64'],
			signature,
		};
		console.log(`🔐 签名已更新`);
		console.log('');
	}

	fs.writeFileSync(
		LATEST_JSON_PATH,
		`${JSON.stringify(latestJson, null, '\t')}\n`,
	);

	console.log(`📄 latest.json 已更新: version=${version}`);
	console.log('');
}

updateLatestJson();
