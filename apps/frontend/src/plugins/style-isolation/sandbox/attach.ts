/**
 * 挂载期样式隔离入口：CSS 捕获 + Portal 收编。
 */
import { attachPortalScopeBridge } from '../portal/attachPortal';
import { styleRealmKey } from '../protocol';
import { beginPluginStyleCapture } from './capture';

/**
 * 插件页挂载期间继续隔离（HMR / 延迟 CSS）+ Portal/Teleport 静默纳入 realm。
 */
export function attachPluginStyleIsolation(
	pluginId: string,
	entry: string,
	remoteName?: string,
): () => void {
	const realm = styleRealmKey(entry, remoteName, pluginId);
	const endCss = beginPluginStyleCapture(pluginId, entry, remoteName);
	const endPortal = attachPortalScopeBridge(pluginId, realm);
	return () => {
		endPortal();
		endCss();
	};
}
