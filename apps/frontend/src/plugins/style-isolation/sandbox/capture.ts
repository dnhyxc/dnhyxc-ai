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

/**
 * 在 loadRemote 前后包一层：捕获本次注入的 CSS 并按选择器前缀隔离到 realm。
 */
// 见上行 JSDoc：loadRemote 前后包一层，捕获注入 CSS 并前缀隔离到 realm
export function beginPluginStyleCapture(
	// 插件 id
	pluginId: string,
	// Remote entry URL
	entry: string,
	// 可选 MF remote 名
	remoteName?: string,
	// 返回 dispose：断开监听、出栈、释放 patch；函数体开始
): () => void {
	// 由 entry 推导共享 realm 键
	const realm = styleRealmKey(entry, remoteName, pluginId);
	// 构造本次捕获上下文
	const ctx: CaptureCtx = {
		// 记录 pluginId
		pluginId,
		// 记录共享 realm
		realm,
		// 记录 entry origin
		entryOrigin: entryOriginOf(entry),
		// 结束 ctx 字面量
	};
	// 压栈，使 activeCtx 指向本次加载
	captureStack.push(ctx);
	// 确保 head/CSSOM 劫持已安装
	ensureHeadPatch();
	// 先修复被误 scope 的 Host 关键样式
	repairHostCriticalStyles();
	// 收回 head 里已属于该 entry 的样式到本 realm
	reclaimEntryStyles(ctx);

	// ponytail: 只听 head 直系 childList；空 style / HMR 由节点级 MO 负责
	// 见上行 ponytail：监听 head 直系子节点新增并 processNode
	const obs = new MutationObserver((mutations) => {
		// 若栈顶已不是本 realm（嵌套其它 Remote）则忽略
		if (activeCtx()?.realm !== realm) return;
		// 遍历每条 mutation
		for (const m of mutations) {
			// 对每个 addedNode 尝试 style/link 隔离
			for (const n of m.addedNodes) processNode(n, ctx);
			// 结束 addedNodes / mutations 内层循环
		}
		// 结束 MutationObserver 回调
	});
	// 只观察 childList，不做 subtree（空 style/HMR 由节点级 MO 负责）
	obs.observe(document.head, { childList: true });

	// 返回结束捕获的 dispose
	return () => {
		// 停止 head 级观察
		obs.disconnect();
		// 从栈尾侧查找本 ctx，支持嵌套乱序结束
		const idx = captureStack.lastIndexOf(ctx);
		// 找到则删除该帧，避免残留 active
		if (idx >= 0) captureStack.splice(idx, 1);
		// 配对释放 head/CSSOM patch
		releaseHeadPatch();
		// 结束 dispose 回调
	};
	// 结束 beginPluginStyleCapture
}
