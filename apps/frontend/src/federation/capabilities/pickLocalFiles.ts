/**
 * 插件用：选本地文件。
 * - Web：公共 pickBrowserFiles → blob: URL
 * - Tauri：系统对话框 → convertFileSrc（asset 流式；需 tauri.conf assetProtocol）
 */
import type {
	HostPickedLocalFile,
	PickLocalFilesOptions,
} from '@dnhyxc-ai/federation-kit';
import { isTauriRuntime } from '@/utils/runtime';
import {
	fileNameFromPath,
	pickBrowserFiles,
	selectFile,
	selectFiles,
} from '@/utils/select-files';

/** Host capabilities.pickLocalFiles → bridge `api.ui.pickLocalFiles` */
export async function pickLocalFilesForPlugins(
	options?: PickLocalFilesOptions,
): Promise<HostPickedLocalFile[] | null> {
	if (!isTauriRuntime()) {
		const files = await pickBrowserFiles({
			accept: options?.accept,
			multiple: options?.multiple,
		});
		if (!files?.length) return null;
		return files.map((f) => ({
			path: f.name,
			name: f.name,
			src: URL.createObjectURL(f),
		}));
	}

	const accept = options?.accept;
	const title = options?.title;
	let list: string[] | null;
	if (options?.multiple) {
		list = await selectFiles({ accept, title });
	} else {
		const one = await selectFile({ accept, title });
		list = one ? [one] : null;
	}
	if (!list?.length) return null;

	const { convertFileSrc } = await import('@tauri-apps/api/core');
	return list.map((path) => ({
		path,
		name: fileNameFromPath(path),
		src: convertFileSrc(path),
	}));
}
