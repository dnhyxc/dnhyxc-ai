/**
 * CSSOM insertRule 沙箱（antd cssinjs 等）。
 */

import { transpileStyleRule } from '../css/transpile';
import { scopeSelector } from '../protocol';

// CSSOM insertRule patch 引用计数
let cssomPatchDepth = 0;
// 保存 CSSStyleSheet.prototype.insertRule 原函数
let origInsertRule: typeof CSSStyleSheet.prototype.insertRule | null = null;

// 从 stylesheet 的 ownerNode 读 mfStyleOwner 作为 realm
export function sheetOwnerRealm(sheet: CSSStyleSheet): string | null {
	// CSSOM sheet 对应的 DOM 节点
	const owner = sheet.ownerNode;
	// 非 style 标签拥有的 sheet 不走此 patch 语义
	if (!(owner instanceof HTMLStyleElement)) return null;
	// Host 关键 style 上的规则不改写
	if (owner.dataset.mfHostStyle === '1') return null;
	// 返回 dataset 上的 owner realm，无则 null
	return owner.dataset.mfStyleOwner || null;
	// 结束 sheetOwnerRealm
}

// 确保 CSSStyleSheet.insertRule 被包一层 @scope 转译
export function ensureCssomPatch() {
	// 已 patch：只增加深度，避免重复替换 prototype
	if (cssomPatchDepth > 0) {
		// 嵌套引用 +1
		cssomPatchDepth += 1;
		// 已装过则返回
		return;
		// 结束已 patch 分支
	}
	// 保存原生 insertRule
	origInsertRule = CSSStyleSheet.prototype.insertRule;
	// 替换为会按 owner realm 转译的实现
	CSSStyleSheet.prototype.insertRule = function mfInsertRule(
		// 待插入的 CSS 规则文本
		rule: string,
		// 可选插入下标
		index?: number,
		// 返回新规则索引；包装函数体开始
	): number {
		// 看本 sheet 是否属于某插件 realm
		const realm = sheetOwnerRealm(this);
		// 有 owner 则转译后再插入
		if (realm) {
			// 生成本 realm 的 scope 选择器
			const sel = scopeSelector(realm);
			// 单条规则 transpile 后写回局部 rule
			rule = transpileStyleRule(rule, sel, realm);
			// 结束有 realm 分支
		}
		// 调用原生 insertRule，保持 CSSOM 索引语义
		return origInsertRule!.call(this, rule, index);
		// 结束 mfInsertRule
	};
	// 深度置 1，标记 patch 已装
	cssomPatchDepth = 1;
	// 结束 ensureCssomPatch
}

// 减少 CSSOM patch 引用；到 0 时恢复原生 insertRule
export function releaseCssomPatch() {
	// 未装过则无操作
	if (cssomPatchDepth <= 0) return;
	// 引用计数 -1
	cssomPatchDepth -= 1;
	// 仍有其它捕获窗口持有 patch 则不卸载
	if (cssomPatchDepth > 0) return;
	// 仅当当前仍是我们的包装函数时才还原，避免误伤他人 patch
	if (origInsertRule && CSSStyleSheet.prototype.insertRule !== origInsertRule) {
		// 恢复原型上的原生 insertRule
		CSSStyleSheet.prototype.insertRule = origInsertRule;
		// 结束仍是我们包装的分支
	}
	// 清空保存的原函数引用
	origInsertRule = null;
	// 结束 releaseCssomPatch
}
