import fs from 'node:fs';
import https from 'node:https';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const _dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(_dirname, '../../.env') });

const TOKEN = process.env.GITHUB_TOKEN;
const OWNER = 'dnhyxc';
const REPO = 'dnhyxc-ai';
const TAG = 'v0.0.1';
const FILE_PATHS = [
	path.resolve(
		_dirname,
		'../../apps/frontend/src-tauri/target/release/bundle/macos/dnhyxc-ai.app.tar.gz',
	),
	path.resolve(_dirname, '../../apps/frontend/latest.json'),
];

function getContentType(filePath: string) {
	const ext = path.extname(filePath);
	if (ext === '.json') return 'application/json';
	if (ext === '.gz') return 'application/gzip';
	return 'application/octet-stream';
}

async function getReleaseId(tag: string) {
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

async function getExistingAssetId(
	releaseId: number,
	fileName: string,
): Promise<number | null> {
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
						const existing = assets.find(
							(a: { name: string }) => a.name === fileName,
						);
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

async function deleteAsset(assetId: number) {
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

async function uploadToRelease(filePath: string, releaseId: number) {
	if (!fs.existsSync(filePath)) {
		console.error(`❌ 文件不存在: ${filePath}`);
		process.exit(1);
	}

	const fileName = path.basename(filePath);
	const fileContent = fs.readFileSync(filePath);
	const contentType = getContentType(filePath);

	const existingId = await getExistingAssetId(releaseId, fileName);
	if (existingId) {
		console.log(`🗑️ 删除已有资源: ${fileName}`);
		await deleteAsset(existingId as number);
	}

	return new Promise((resolve, reject) => {
		const req = https.request(
			{
				hostname: 'uploads.github.com',
				path: `/repos/${OWNER}/${REPO}/releases/${releaseId}/assets?name=${fileName}`,
				method: 'POST',
				headers: {
					Authorization: `token ${TOKEN}`,
					'Content-Type': contentType,
					'Content-Length': fileContent.length,
					'User-Agent': 'dnhyxc-ai-release-script',
				},
			},
			(res) => {
				const statusCode = res.statusCode ?? 0;
				if (statusCode >= 200 && statusCode < 300) {
					console.log(`✅ 上传成功: ${fileName}`);
					resolve(true);
				} else {
					let data = '';
					res.on('data', (chunk) => {
						data += chunk;
					});
					res.on('end', () => {
						console.error(`❌ 上传失败: ${statusCode}`);
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

	console.log('');
	console.log(`🚀 开始上传到 Release: ${TAG}`);
	console.log('');

	console.log(`🔍 获取 Release ID...`);
	const releaseId = await getReleaseId(TAG);
	console.log(`   Release ID: ${releaseId}`);
	console.log('');
	console.log(`📁 文件数量: ${FILE_PATHS.length}`);
	console.log('');

	for (const filePath of FILE_PATHS) {
		await uploadToRelease(filePath, releaseId as number);
		console.log('');
	}
	process.exit(0);
}

main();
