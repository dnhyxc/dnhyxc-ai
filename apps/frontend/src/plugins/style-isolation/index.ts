/**
 * Host 侧 CSS 隔离（对齐 qiankun experimentalStyleIsolation + 社区 body 弹层修法）。
 *
 * 分层：protocol / css(transpile) / sandbox(head+CSSOM) / portal(body 代理)。
 */

export {
	claimPluginPortalTarget,
	clearPluginPortalClaim,
} from './portal/claim';
export { styleRealmKey } from './protocol';
export { attachPluginStyleIsolation } from './sandbox/attach';
export { beginPluginStyleCapture } from './sandbox/capture';

import {
	transpileStyleRule,
	transpileStyleText,
	unwrapScope,
} from './css/transpile';
import { resolveRetargetedChildParent } from './portal/bodyPatch';
import { alreadyScoped, scopeSelector, styleNeedsRescope } from './protocol';

/** @internal smoke / 自检用 */
export const __styleIsolationTest = {
	transpileStyleText,
	transpileStyleRule,
	unwrapScope,
	scopeSelector,
	resolveRetargetedChildParent,
	alreadyScoped,
	styleNeedsRescope,
};
