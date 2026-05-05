/**
 * 与各功能脚本共用的仓库路径（入口在 src 下的 version / release / wiki）。
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const libDir = path.dirname(fileURLToPath(import.meta.url));

/** packages/release-run 根目录（与 export.sh、.env 同级，不含 src） */
export const SCRIPTS_ROOT = path.resolve(libDir, '../..');

/** 仓库根目录（monorepo root） */
export const REPO_ROOT = path.resolve(SCRIPTS_ROOT, '../..');

export const TAURI_CONFIG_PATH = path.join(
	REPO_ROOT,
	'apps/frontend/src-tauri/tauri.conf.json',
);

export const LATEST_JSON_PATH = path.join(
	REPO_ROOT,
	'apps/frontend/latest.json',
);

/** macOS 更新包（.tar.gz）构建产物路径 */
export const MACOS_TAR_GZ_PATH = path.join(
	REPO_ROOT,
	'apps/frontend/src-tauri/target/release/bundle/macos/dnhyxc-ai.app.tar.gz',
);

/** Tauri 生成的签名文件路径 */
export const MACOS_SIG_PATH = path.join(
	REPO_ROOT,
	'apps/frontend/src-tauri/target/release/bundle/macos/dnhyxc-ai.app.tar.gz.sig',
);

/** Tauri 打 dmg 后的默认目录 */
export const DMG_BUNDLE_DIR = path.join(
	REPO_ROOT,
	'apps/frontend/src-tauri/target/release/bundle/dmg',
);

export const DOC_PROJECT_UPDATE_INFO = path.join(
	REPO_ROOT,
	'docs/project-update-info.md',
);

export const DOC_PROJECT_GUIDE = path.join(REPO_ROOT, 'docs/project-guide.md');
