/**
 * 样式隔离协议：realm 键、DOM 契约属性、选择器与幂等判定。
 */

/** 隔离协议版本标记；升版后强制重写 head 里旧前缀 CSS */
export const MF_ISO_MARK = '/*mf-iso:3*/';
export const MF_ISO_MARK_RE = /\/\*mf-iso(?::\d+)?\*\//g;
/** html/body 布局选择器后缀：只命中插件根，不命中打了 realm 的浮层 */
export const PLUGIN_ROOT_ATTR = '[data-plugin-root]';

// 把选择器里的特殊字符转义，避免 realm 含 : / 时属性选择器非法
export function cssEscapeIdent(id: string): string {
	if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') {
		// 返回规范转义后的标识/字符串片段
		return CSS.escape(id);
		// 结束 CSS.escape 可用分支
	}
	// 无 CSS.escape 时手工转义非 [A-Za-z0-9_-] 字符
	return id.replace(/[^a-zA-Z0-9_-]/g, '\\$&');
	// 结束 cssEscapeIdent
}

/**
 * 同一 MF Remote（同 entry 源）共用一个样式域。
 * 优先 entry origin+目录；显式 remoteName 且异于 id 时作补充键。
 */
export function styleRealmKey(
	entry: string,
	// 可选 Module Federation remote 名
	remoteName?: string,
	// 可选插件 id，URL 解析失败时的最终回退键
	pluginId?: string,
	// 返回 realm 字符串；try 内按 URL 规范化
): string {
	// 尝试按绝对 URL 规范化 entry
	try {
		// 解析 entry 为 URL；非法则进 catch 回退分支
		const u = new URL(entry);
		// 去掉 query，避免同入口不同缓存参数拆成多 realm
		u.search = '';
		// 去掉 hash，只保留定位路径
		u.hash = '';
		// 剥掉末尾 manifest/remoteEntry 文件名，得到 Remote 根路径
		let path = u.pathname.replace(
			// 匹配 mf-manifest.json 或 remoteEntry.js（可带尾斜杠）
			/\/(?:mf-manifest\.json|remoteEntry\.js)\/?$/i,
			// replace 第二参：删掉入口文件名，留下目录路径
			'',
			// 结束 pathname.replace 调用
		);
		// 保证路径以 / 结尾，统一目录形态的 realm 键
		if (!path.endsWith('/')) path += '/';
		// 返回 entry:origin+path 形式的共享 realm
		return `entry:${u.origin}${path}`;
		// URL 非法时按 remoteName / pluginId 回退
	} catch {
		// 去掉 remoteName 首尾空白
		const named = remoteName?.trim();
		// 显式 remote 名且不同于 pluginId 时用 remote: 键
		if (named && named !== pluginId) return `remote:${named}`;
		// 再无可用名则用 plugin: 键，unknown 兜底
		return `plugin:${pluginId || 'unknown'}`;
		// 结束 styleRealmKey 的 catch
	}
	// 结束 styleRealmKey
}

// 生成与 DOM data-mf-style-realm 匹配的属性选择器（引号内转义，勿用 CSS.escape）
export function scopeSelector(realm: string): string {
	const v = realm.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
	return `[data-mf-style-realm="${v}"]`;
}

/** 已带当前协议标记 + realm 前缀（transpile 可跳过） */
export function alreadyScoped(text: string, sel: string): boolean {
	return (
		text.includes(MF_ISO_MARK) &&
		text.includes('data-mf-style-realm=') &&
		text.includes(sel)
	);
}

/**
 * HMR/回写是否还需要再 wrap。
 * 已有 realm 前缀且无旧 @scope → false（避免与 antd cssinjs 互殴卡死）。
 */
export function styleNeedsRescope(text: string, sel: string): boolean {
	const t = text.trim();
	if (!t) return false;
	if (/@scope\s*\(/.test(t)) return true;
	// 任意版本 mf-iso 且已含本 realm 选择器 → 视为已前缀，勿再写 textContent
	if (text.includes(sel) && /\/\*mf-iso(?::\d+)?\*\//.test(text)) return false;
	if (text.includes(sel)) return false;
	return true;
}
