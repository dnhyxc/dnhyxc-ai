import fs from 'node:fs';
import https from 'node:https';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const TOKEN = process.env.GITHUB_TOKEN;
const OWNER = 'dnhyxc';
const REPO = 'dnhyxc-ai';
const TAG = 'v0.0.1';

const LATEST_JSON_PATH = path.resolve(__dirname, '../latest.json');
const APP_TAR_GZ_PATH = path.resolve(
	__dirname,
	'../client/src-tauri/target/release/bundle/macos/dnhyxc-ai.app.tar.gz',
);

async function uploadFile(filePath, name) {
	if (!fs.existsSync(filePath)) {
		console.error(`文件不存在: ${filePath}`);
		return false;
	}

	const fileContent = fs.readFileSync(filePath);
	const fileName = path.basename(filePath);

	const url = new URL(
		`https://uploads.github.com/repos/${OWNER}/${REPO}/releases/assets`,
	);
	url.searchParams.append('name', name || fileName);
	url.searchParams.append('label', name || fileName);

	return new Promise((resolve, reject) => {
		const req = https.request(
			{
				hostname: url.hostname,
				path: url.pathname + url.search,
				method: 'POST',
				headers: {
					Authorization: `token ${TOKEN}`,
					'Content-Type': 'application/octet-stream',
					'Content-Length': fileContent.length,
				},
			},
			(res) => {
				if (res.statusCode >= 200 && res.statusCode < 300) {
					console.log(`✅ 上传成功: ${name || fileName}`);
					resolve(true);
				} else {
					let data = '';
					res.on('data', (chunk) => {
						data += chunk;
					});
					res.on('end', () => {
						console.error(
							`❌ 上传失败: ${name || fileName}, 状态码: ${res.statusCode}, ${data}`,
						);
						resolve(false);
					});
				}
			},
		);

		req.on('error', (e) => {
			console.error(`❌ 请求错误: ${e.message}`);
			reject(e);
		});

		req.write(fileContent);
		req.end();
	});
}

async function main() {
	if (!TOKEN) {
		console.error('❌ 请设置 GITHUB_TOKEN 环境变量');
		console.error('   export GITHUB_TOKEN=your_github_token');
		process.exit(1);
	}

	console.log(`🚀 开始上传文件到 ${OWNER}/${REPO} @ ${TAG}`);
	console.log(`📁 latest.json: ${LATEST_JSON_PATH}`);
	console.log(`📁 app.tar.gz: ${APP_TAR_GZ_PATH}`);
	console.log('');

	const results = [];

	if (fs.existsSync(LATEST_JSON_PATH)) {
		results.push(await uploadFile(LATEST_JSON_PATH, `latest.json`));
	} else {
		console.error(`❌ latest.json 不存在`);
		results.push(false);
	}

	if (fs.existsSync(APP_TAR_GZ_PATH)) {
		results.push(await uploadFile(APP_TAR_GZ_PATH, 'dnhyxc-ai.app.tar.gz'));
	} else {
		console.error(`❌ dnhyxc-ai.app.tar.gz 不存在`);
		results.push(false);
	}

	console.log('');
	if (results.every(Boolean)) {
		console.log('✅ 所有文件上传成功!');
	} else {
		console.log('⚠️ 部分文件上传失败');
		process.exit(1);
	}
}

main();
