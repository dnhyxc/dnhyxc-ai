/**
 * Portal 收编共享状态（claim / scopeDom / bodyPatch / attach 共用）。
 * 用可变对象，避免跨模块对 `let` 绑定赋值失败。
 */
export const portalPlugins = new Set<string>();
export const portalRealmByPlugin = new Map<string, string>();

export const portalState = {
	lastTouchedPluginId: null as string | null,
	touchBridgeInstalled: false,
	portalClaimOverride: null as string | null,
	bodyPatchBusy: false,
	createPortalPatched: false,
	bodyPortalPatched: false,
	portalPointerCssInstalled: false,
};
