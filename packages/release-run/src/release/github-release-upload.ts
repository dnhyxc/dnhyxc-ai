import fs from 'node:fs';
import https from 'node:https';
import path from 'node:path';

export type ReleaseUploadConfig = {
	token: string;
	owner: string;
	repo: string;
};

export function getContentType(filePath: string) {
	const ext = path.extname(filePath).toLowerCase();
	if (ext === '.json') return 'application/json';
	if (ext === '.gz') return 'application/gzip';
	if (ext === '.dmg') return 'application/x-apple-diskimage';
	return 'application/octet-stream';
}

async function parseJsonResponse<T>(
	res: import('node:http').IncomingMessage,
): Promise<T> {
	return new Promise((resolve, reject) => {
		let data = '';
		res.on('data', (chunk) => {
			data += chunk;
		});
		res.on('end', () => {
			try {
				resolve(JSON.parse(data) as T);
			} catch (e) {
				reject(e);
			}
		});
	});
}

export async function getReleaseId(
	cfg: ReleaseUploadConfig,
	tag: string,
): Promise<number> {
	return new Promise((resolve, reject) => {
		const req = https.request(
			{
				hostname: 'api.github.com',
				path: `/repos/${cfg.owner}/${cfg.repo}/releases/tags/${encodeURIComponent(tag)}`,
				method: 'GET',
				headers: {
					Authorization: `token ${cfg.token}`,
					'User-Agent': 'dnhyxc-ai-release-script',
					Accept: 'application/vnd.github.v3+json',
				},
			},
			async (res) => {
				try {
					const release = await parseJsonResponse<{ id?: number }>(res);
					if (release.id) {
						resolve(release.id);
					} else {
						console.error(`❌ 未找到 Release: ${tag}`);
						reject(new Error('Release not found'));
					}
				} catch (e) {
					reject(e);
				}
			},
		);
		req.on('error', (e) => reject(e));
		req.end();
	});
}

/** GitHub List release assets 单页上限（接口最大 100） */
const RELEASE_ASSETS_PER_PAGE = 100;

type ReleaseAssetSummary = { id?: number; name?: string };

async function listReleaseAssetsPage(
	cfg: ReleaseUploadConfig,
	releaseId: number,
	page: number,
	userAgent: string,
): Promise<ReleaseAssetSummary[]> {
	return new Promise((resolve, reject) => {
		const req = https.request(
			{
				hostname: 'api.github.com',
				path: `/repos/${cfg.owner}/${cfg.repo}/releases/${releaseId}/assets?per_page=${RELEASE_ASSETS_PER_PAGE}&page=${page}`,
				method: 'GET',
				headers: {
					Authorization: `token ${cfg.token}`,
					'User-Agent': userAgent,
					Accept: 'application/vnd.github.v3+json',
				},
			},
			async (res) => {
				try {
					const assets = await parseJsonResponse<unknown>(res);
					resolve(Array.isArray(assets) ? assets : []);
				} catch (e) {
					reject(e);
				}
			},
		);
		req.on('error', (e) => reject(e));
		req.end();
	});
}

/** 按文件名查找已有附件 id（遍历全部分页，避免默认 30 条漏查导致 422 already_exists） */
export async function getExistingAssetId(
	cfg: ReleaseUploadConfig,
	releaseId: number,
	fileName: string,
): Promise<number | null> {
	const userAgent = 'dnhyxc-ai-release-script';
	let page = 1;

	while (true) {
		let assets: ReleaseAssetSummary[];
		try {
			assets = await listReleaseAssetsPage(cfg, releaseId, page, userAgent);
		} catch {
			return null;
		}

		const existing = assets.find(
			(a) =>
				a &&
				typeof a.name === 'string' &&
				a.name === fileName &&
				typeof a.id === 'number',
		);
		if (existing?.id != null) {
			return existing.id;
		}

		if (assets.length < RELEASE_ASSETS_PER_PAGE) {
			return null;
		}
		page += 1;
	}
}

export async function deleteAsset(cfg: ReleaseUploadConfig, assetId: number) {
	return new Promise<boolean>((resolve, reject) => {
		const req = https.request(
			{
				hostname: 'api.github.com',
				path: `/repos/${cfg.owner}/${cfg.repo}/releases/assets/${assetId}`,
				method: 'DELETE',
				headers: {
					Authorization: `token ${cfg.token}`,
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

export async function uploadToRelease(
	cfg: ReleaseUploadConfig,
	filePath: string,
	releaseId: number,
): Promise<boolean> {
	if (!fs.existsSync(filePath)) {
		console.error(`❌ 文件不存在: ${filePath}`);
		process.exit(1);
	}

	const fileName = path.basename(filePath);
	const fileContent = fs.readFileSync(filePath);
	const contentType = getContentType(filePath);

	const existingId = await getExistingAssetId(cfg, releaseId, fileName);
	if (existingId) {
		console.log(`🗑️ 删除已有资源: ${fileName}`);
		await deleteAsset(cfg, existingId);
	}

	return new Promise((resolve, reject) => {
		const req = https.request(
			{
				hostname: 'uploads.github.com',
				path: `/repos/${cfg.owner}/${cfg.repo}/releases/${releaseId}/assets?name=${encodeURIComponent(fileName)}`,
				method: 'POST',
				headers: {
					Authorization: `token ${cfg.token}`,
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
