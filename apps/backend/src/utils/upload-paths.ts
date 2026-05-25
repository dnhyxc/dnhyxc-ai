import { existsSync, mkdirSync } from 'node:fs';
import { basename, dirname, isAbsolute, join, resolve } from 'node:path';
import { FileEnum } from '../enum/config.enum';
import { getEnvConfig } from './index';

let cachedBackendRoot: string | null = null;

/** 环境变量路径在当前机器可用时才采用（避免本地 Mac 误用线上 /usr/local/...） */
function resolveEnvPathIfUsable(path: string | undefined): string | undefined {
	if (!path?.trim()) {
		return undefined;
	}
	const resolved = resolve(path.trim());
	if (existsSync(resolved)) {
		return resolved;
	}
	const parent = dirname(resolved);
	if (existsSync(parent)) {
		return resolved;
	}
	return undefined;
}

/**
 * 定位部署根目录（与 dist 同级）。
 * 本地：apps/backend；线上：/usr/local/dnhyxc-ai/server
 */
export function getBackendPackageRoot(fromDirname: string = __dirname): string {
	if (cachedBackendRoot) {
		return cachedBackendRoot;
	}

	const config = getEnvConfig();
	const serverRoot = resolveEnvPathIfUsable(
		config[FileEnum.SERVER_ROOT] as string | undefined,
	);
	if (serverRoot) {
		cachedBackendRoot = serverRoot;
		return cachedBackendRoot;
	}

	// 从编译产物位置向上找「含 dist 子目录」的包根（不依赖 process.cwd，避免 monorepo 根误判）
	let dir = resolve(fromDirname);
	for (;;) {
		const parent = dirname(dir);
		if (parent === dir) {
			break;
		}
		if (basename(dir) !== 'dist' && existsSync(join(dir, 'dist'))) {
			cachedBackendRoot = dir;
			return dir;
		}
		dir = parent;
	}

	// 兜底：dist/src/services/upload → 上四级到 backend
	cachedBackendRoot = resolve(fromDirname, '../../../..');
	return cachedBackendRoot;
}

/**
 * uploads 根目录（与 dist 同级，不在 dist 内）。
 *
 * 优先级：
 * 1. UPLOAD_ROOT（绝对路径；当前机器不可用则忽略，便于本地开发）
 * 2. SERVER_ROOT / 自动识别 + FILE_ROOT（默认 uploads）
 */
export function getUploadsRoot(fromDirname: string = __dirname): string {
	const config = getEnvConfig();
	const uploadRoot = resolveEnvPathIfUsable(
		config[FileEnum.UPLOAD_ROOT] as string | undefined,
	);
	if (uploadRoot) {
		return uploadRoot;
	}

	const backendRoot = getBackendPackageRoot(fromDirname);
	const fileRoot = config[FileEnum.FILE_ROOT] as string | undefined;

	if (fileRoot) {
		return isAbsolute(fileRoot) ? fileRoot : join(backendRoot, fileRoot);
	}

	return join(backendRoot, 'uploads');
}

export function getUploadImagesDir(fromDirname: string = __dirname): string {
	return join(getUploadsRoot(fromDirname), 'images');
}

export function getUploadFilesDir(fromDirname: string = __dirname): string {
	return join(getUploadsRoot(fromDirname), 'files');
}

export function ensureUploadDir(dir: string): void {
	if (!existsSync(dir)) {
		mkdirSync(dir, { recursive: true });
	}
}

export function resolveStoredUploadAbsolutePath(
	filename: string,
	folder: 'images' | 'files',
	fromDirname: string = __dirname,
): string {
	const absolutePath = join(getUploadsRoot(fromDirname), folder, filename);
	if (existsSync(absolutePath)) {
		return absolutePath;
	}
	throw new Error(`文件不存在: ${filename}`);
}

/**
 * 将 multer 落盘绝对路径转为对外 URL 相对路径（/images/... 或 /files/...）。
 * 按路径中的 images|files 段解析，避免写入目录与配置根目录短暂不一致时报错。
 */
export function toUploadPublicPath(absoluteFilePath: string): string {
	const normalized = resolve(absoluteFilePath).replace(/\\/g, '/');
	const matched = normalized.match(/\/(images|files)\/(.+)$/);
	if (matched) {
		return `/${matched[1]}/${matched[2]}`;
	}
	throw new Error(`无法解析上传文件路径: ${absoluteFilePath}`);
}

export function getAllowedUploadRoots(
	fromDirname: string = __dirname,
): string[] {
	return [resolve(getUploadsRoot(fromDirname))];
}
