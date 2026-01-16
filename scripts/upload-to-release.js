import fs from 'node:fs';
import https from 'node:https';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const TOKEN = process.env.GITHUB_TOKEN;
const OWNER = 'dnhyxc';
const REPO = 'dnhyxc-ai';
const TAG = 'v0.0.1';
const FILE_PATHS = [
	path.resolve(
		__dirname,
		'../client/src-tauri/target/release/bundle/macos/dnhyxc-ai.app.tar.gz',
	),
	path.resolve(__dirname, '../client/latest.json'),
];

const boundary = `----FormBoundary${Date.now().toString(16)}`;

async function getReleaseId(tag) {
	return new Promise((resolve, reject) => {
		const req = https.request(
			{
				hostname: 'api.github.com',
				path: `/repos/${OWNER}/${REPO}/releases/tags/${tag}`,
				method: 'GET',
				headers: {
					Authorization: `token ${TOKEN}`,
					'User-Agent': 'dnhyxc-ai-release-script',
					Accept: 'application/vnd.github.v3+json',
				},
			},
			(res) => {
				let data = '';
				res.on('data', (chunk) => {
					data += chunk;
				});
				res.on('end', () => {
					try {
						const release = JSON.parse(data);
						if (release.id) {
							resolve(release.id);
						} else {
							console.error(`❌ 未找到 Release: ${tag}`);
							reject(new Error('Release not found'));
						}
					} catch (e) {
						reject(e);
					}
				});
			},
		);
		req.on('error', (e) => reject(e));
		req.end();
	});
}

function buildFormDataBody(filePath) {
	const fileName = path.basename(filePath);
	const fileContent = fs.readFileSync(filePath);

	const CRLF = '\r\n';
	const header = Buffer.from(
		`--${boundary}${CRLF}` +
			`Content-Disposition: form-data; name="file"; filename="${fileName}"${CRLF}` +
			`Content-Type: application/octet-stream${CRLF}${CRLF}`,
	);
	const footer = Buffer.from(`${CRLF}--${boundary}--${CRLF}`);

	const body = Buffer.concat([header, fileContent, footer]);
	return body;
}

async function getExistingAssetId(releaseId, fileName) {
	return new Promise((resolve, reject) => {
		const req = https.request(
			{
				hostname: 'api.github.com',
				path: `/repos/${OWNER}/${REPO}/releases/${releaseId}/assets`,
				method: 'GET',
				headers: {
					Authorization: `token ${TOKEN}`,
					'User-Agent': 'dnhyxc-ai-release-script',
				},
			},
			(res) => {
				let data = '';
				res.on('data', (chunk) => {
					data += chunk;
				});
				res.on('end', () => {
					try {
						const assets = JSON.parse(data);
						const existing = assets.find((a) => a.name === fileName);
						resolve(existing ? existing.id : null);
					} catch (_e) {
						resolve(null);
					}
				});
			},
		);
		req.on('error', (e) => reject(e));
		req.end();
	});
}

async function deleteAsset(assetId) {
	return new Promise((resolve, reject) => {
		const req = https.request(
			{
				hostname: 'api.github.com',
				path: `/repos/${OWNER}/${REPO}/releases/assets/${assetId}`,
				method: 'DELETE',
				headers: {
					Authorization: `token ${TOKEN}`,
					'User-Agent': 'dnhyxc-ai-release-script',
				},
			},
			(res) => {
				resolve(res.statusCode === 204);
			},
		);
		req.on('error', (e) => reject(e));
		req.end();
	});
}

async function uploadToRelease(filePath, releaseId) {
	if (!fs.existsSync(filePath)) {
		console.error(`❌ 文件不存在: ${filePath}`);
		process.exit(1);
	}

	const fileName = path.basename(filePath);
	const body = buildFormDataBody(filePath);

	const existingId = await getExistingAssetId(releaseId, fileName);
	if (existingId) {
		console.log(`🗑️ 删除已有资源: ${fileName}`);
		await deleteAsset(existingId);
	}

	return new Promise((resolve, reject) => {
		const req = https.request(
			{
				hostname: 'uploads.github.com',
				path: `/repos/${OWNER}/${REPO}/releases/${releaseId}/assets?name=${fileName}`,
				method: 'POST',
				headers: {
					Authorization: `token ${TOKEN}`,
					'Content-Type': `multipart/form-data; boundary=${boundary}`,
					'Content-Length': body.length,
					'User-Agent': 'dnhyxc-ai-release-script',
				},
			},
			(res) => {
				if (res.statusCode >= 200 && res.statusCode < 300) {
					console.log(`✅ 上传成功: ${fileName}`);
					resolve(true);
				} else {
					let data = '';
					res.on('data', (chunk) => {
						data += chunk;
					});
					res.on('end', () => {
						console.error(`❌ 上传失败: ${res.statusCode}`);
						console.error(data);
						resolve(false);
					});
				}
			},
		);

		req.on('error', (e) => {
			console.error(`❌ 请求错误: ${e.message}`);
			reject(e);
		});

		req.write(body);
		req.end();
	});
}

async function main() {
	if (!TOKEN) {
		console.error('❌ 请设置 GITHUB_TOKEN 环境变量');
		console.error('   export GITHUB_TOKEN=your_github_token');
		process.exit(1);
	}

	console.log(`🚀 开始上传到 Release: ${TAG}`);

	console.log(`🔍 获取 Release ID...`);
	const releaseId = await getReleaseId(TAG);
	console.log(`   Release ID: ${releaseId}`);

	console.log(`📁 文件数量: ${FILE_PATHS.length}`);
	console.log('');

	for (const filePath of FILE_PATHS) {
		await uploadToRelease(filePath, releaseId);
		console.log('');
	}
}

main();
