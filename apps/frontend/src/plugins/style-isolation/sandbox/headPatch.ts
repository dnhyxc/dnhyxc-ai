/**
 * document.head append/insert 劫持。
 */
import { activeCtx } from './context';
import { ensureCssomPatch, releaseCssomPatch } from './cssomPatch';
import { processNode } from './reclaim';

// head 原型 patch 引用计数：嵌套 begin 时只装一次、末次释放
let patchDepth = 0;
let origAppend: <T extends Node>(node: T) => T;
let origInsert: <T extends Node>(node: T, ref: Node | null) => T;

// 劫持 head.appendChild/insertBefore，插入后对节点做样式隔离
export function ensureHeadPatch() {
	// 已 patch：嵌套 begin 只加深度
	if (patchDepth > 0) {
		// 引用计数 +1
		patchDepth += 1;
		// 已装过则返回
		return;
		// 结束已 patch 分支
	}
	// 取 document.head
	const head = document.head;
	// 绑定保存原生 appendChild
	origAppend = head.appendChild.bind(head) as typeof origAppend;
	// 绑定保存原生 insertBefore
	origInsert = head.insertBefore.bind(head) as typeof origInsert;

	// 包装 appendChild：先原生挂载，再按 activeCtx 处理
	head.appendChild = function appendScoped<T extends Node>(node: T): T {
		// 先真正插入 DOM，保证后续读 sheet/文本可用
		const ret = origAppend(node);
		// 取当前捕获栈顶
		const ctx = activeCtx();
		// 在捕获窗口内则尝试隔离该节点
		if (ctx) processNode(node, ctx);
		// 返回插入的节点，保持与原生相同契约
		return ret;
		// 结束 appendScoped
	};

	// 包装 insertBefore：同样先插入再 processNode
	head.insertBefore = function insertScoped<T extends Node>(
		// 待插入节点
		node: T,
		// 参考节点，null 表示插到末尾
		ref: Node | null,
		// 返回插入节点；函数体开始
	): T {
		// 原生 insertBefore
		const ret = origInsert(node, ref);
		// 当前捕获上下文
		const ctx = activeCtx();
		// 有 ctx 则隔离
		if (ctx) processNode(node, ctx);
		// 返回 ret
		return ret;
		// 结束 insertScoped
	};

	// 深度置 1
	patchDepth = 1;
	// 同时装上 CSSOM insertRule patch
	ensureCssomPatch();
	// 结束 ensureHeadPatch
}

// 减少 head patch 引用；到 0 时恢复 append/insert 并释放 CSSOM
export function releaseHeadPatch() {
	// 未装过则无操作
	if (patchDepth <= 0) return;
	// 引用计数 -1
	patchDepth -= 1;
	// 仍有嵌套持有者则保持 patch
	if (patchDepth > 0) return;
	// 恢复 head.appendChild
	document.head.appendChild = origAppend as typeof document.head.appendChild;
	// 恢复 head.insertBefore
	document.head.insertBefore = origInsert as typeof document.head.insertBefore;
	// 成对释放 CSSOM patch
	releaseCssomPatch();
	// 结束 releaseHeadPatch
}
