/**
 * loadRemote / 挂载期样式捕获窗口。
 */
import { styleRealmKey } from '../protocol';
import { activeCtx, type CaptureCtx, captureStack } from './context';
import { ensureHeadPatch, releaseHeadPatch } from './headPatch';
import {
	entryOriginOf,
	processNode,
	reclaimEntryStyles,
	repairHostCriticalStyles,
} from './reclaim';

export type BeginStyleCaptureOptions = {
	/**
	 * loadRemote 默认 true；挂载期应传 false。
	 * @see CaptureCtx.claimUnmarked
	 */
	claimUnmarked?: boolean;
};

/**
 * 在 loadRemote 前后包一层：捕获本次注入的 CSS 并按选择器前缀隔离到 realm。
 */
export function beginPluginStyleCapture(
	pluginId: string,
	entry: string,
	remoteName?: string,
	opts?: BeginStyleCaptureOptions,
): () => void {
	const realm = styleRealmKey(entry, remoteName, pluginId);
	const ctx: CaptureCtx = {
		pluginId,
		realm,
		entryOrigin: entryOriginOf(entry),
		claimUnmarked: opts?.claimUnmarked !== false,
	};
	captureStack.push(ctx);
	ensureHeadPatch();
	repairHostCriticalStyles();
	reclaimEntryStyles(ctx);

	// ponytail: 只听 head 直系 childList；空 style / HMR 由节点级 MO 负责
	const obs = new MutationObserver((mutations) => {
		if (activeCtx()?.realm !== realm) return;
		for (const m of mutations) {
			for (const n of m.addedNodes) processNode(n, ctx);
		}
	});
	obs.observe(document.head, { childList: true });

	return () => {
		obs.disconnect();
		const idx = captureStack.lastIndexOf(ctx);
		if (idx >= 0) captureStack.splice(idx, 1);
		releaseHeadPatch();
	};
}
