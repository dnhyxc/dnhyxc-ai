import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const PACKAGE_JSON_PATH = path.resolve(__dirname, '../package.json');
const LATEST_JSON_PATH = path.resolve(
	__dirname,
	'../apps/frontend/latest.json',
);
const SIG_FILE_PATH = path.resolve(
	__dirname,
	'../apps/frontend/src-tauri/target/release/bundle/macos/dnhyxc-ai.app.tar.gz.sig',
);

function updateLatestJson() {
	const packageJson = JSON.parse(fs.readFileSync(PACKAGE_JSON_PATH, 'utf-8'));
	const version = packageJson.version;

	const latestJson = JSON.parse(fs.readFileSync(LATEST_JSON_PATH, 'utf-8'));
	latestJson.version = version;
	latestJson.pub_date = new Date().toISOString();

	if (fs.existsSync(SIG_FILE_PATH)) {
		const signature = fs.readFileSync(SIG_FILE_PATH, 'utf-8').trim();
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
