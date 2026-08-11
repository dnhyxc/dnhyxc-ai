/**
 * 插件用：选本地文件。
 * - Web：input → blob: URL（与拖拽 createObjectURL 同量级，只建引用）
 * - Tauri：系统对话框 → convertFileSrc（asset 流式，不整文件读入；需 tauri.conf assetProtocol）
 */
import type {
	HostPickedLocalFile,
	PickLocalFilesOptions,
} from '@dnhyxc-ai/federation-kit';
import { isTauriRuntime } from '@/utils/runtime';
import { selectFile, selectFiles } from '@/utils/select-files';

function fileNameFromPath(path: string): string {
	const parts = path.split(/[/\\]/).filter(Boolean);
	return parts[parts.length - 1] ?? path;
}

/** Web：隐藏 input；取消 null */
function pickViaInput(
	options?: PickLocalFilesOptions,
): Promise<HostPickedLocalFile[] | null> {
	return new Promise((resolve) => {
		const input = document.createElement('input');
		input.type = 'file';
		if (options?.accept?.trim()) input.accept = options.accept.trim();
		input.multiple = options?.multiple === true;
		input.style.display = 'none';
		document.body.appendChild(input);

		const cleanup = () => input.remove();

		input.addEventListener('change', () => {
			const list = Array.from(input.files ?? []);
			cleanup();
			if (!list.length) {
				resolve(null);
				return;
			}
			resolve(
				list.map((f) => ({
					path: f.name,
					name: f.name,
					src: URL.createObjectURL(f),
				})),
			);
		});

		input.addEventListener('cancel', () => {
			cleanup();
			resolve(null);
		});

		input.click();
	});
}

/** Host capabilities.pickLocalFiles → bridge `api.ui.pickLocalFiles` */
export async function pickLocalFilesForPlugins(
	options?: PickLocalFilesOptions,
): Promise<HostPickedLocalFile[] | null> {
	if (!isTauriRuntime()) {
		return pickViaInput(options);
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
