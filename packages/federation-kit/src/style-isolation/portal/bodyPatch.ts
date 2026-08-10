/**
 * body / createPortal 原型劫持：把挂到 document.body 的节点收编进 portal scope。
 *
 * 原生方法闭包捕获后永不置空；release 只还原 prototype。
 * 状态见 state.ts（globalThis），避免双入口双份 patch。
 */
import { isValidElement, type ReactNode } from 'react';
import ReactDOM from 'react-dom';
import { resolveClaimPluginId } from './claim';
import { ensureBodyPortalScope, stampRealmOnPortalNode } from './scopeDom';
import {
	getPortalNatives,
	portalPlugins,
	portalState,
	setPortalNatives,
} from './state';

const PORTAL_SKIP_TAGS = new Set([
	'SCRIPT',
	'STYLE',
	'LINK',
	'META',
	'NOSCRIPT',
	'TEMPLATE',
	'BASE',
]);

function isBodyPortalTarget(
	container: Element | DocumentFragment | null | undefined,
): boolean {
	return container === document.body || container === document.documentElement;
}

function shouldSkipPortalNode(node: Node): boolean {
	if (node instanceof DocumentFragment) return false;
	if (!(node instanceof Element)) return true;
	if (PORTAL_SKIP_TAGS.has(node.tagName)) return true;
	if (node.hasAttribute('data-mf-portal-scope')) return true;
	if (node.hasAttribute('data-mf-portal-stamp')) return true;
	if (node.hasAttribute('data-sonner-toaster')) return true;
	if (node.hasAttribute('data-sonner-toast')) return true;
	if (node.hasAttribute('data-mf-host-portal')) return true;
	return false;
}

function retargetPortalContainer(
	container: Element | DocumentFragment,
): Element | DocumentFragment {
	if (!isBodyPortalTarget(container)) return container;
	if (
		container instanceof Element &&
		container.closest('[data-mf-host-portal]')
	) {
		return container;
	}
	const id = resolveClaimPluginId();
	if (!id) return container;
	return ensureBodyPortalScope(id);
}

function isHostProtectedPortalChildren(children: ReactNode): boolean {
	if (!isValidElement(children)) return false;
	const p = children.props as {
		className?: string;
		'data-sonner-toaster'?: unknown;
		'data-mf-host-portal'?: unknown;
	};
	if (p['data-sonner-toaster'] != null || p['data-mf-host-portal'] != null) {
		return true;
	}
	const cn = p.className;
	return typeof cn === 'string' && /\btoaster\b/.test(cn);
}

function ensurePortalNatives() {
	const existing = getPortalNatives();
	if (existing) return existing;
	const natives = {
		appendChild: Node.prototype.appendChild,
		insertBefore: Node.prototype.insertBefore,
		append: Element.prototype.append,
		prepend: Element.prototype.prepend,
		removeChild: Node.prototype.removeChild,
		replaceChild: Node.prototype.replaceChild,
		createPortal: ReactDOM.createPortal.bind(ReactDOM),
	};
	setPortalNatives(natives);
	return natives;
}

export function ensureCreatePortalPatch() {
	if (portalState.createPortalPatched) return;
	const { createPortal: nativeCreatePortal } = ensurePortalNatives();
	portalState.createPortalPatched = true;
	ReactDOM.createPortal = ((children, container, key) => {
		if (isHostProtectedPortalChildren(children)) {
			return nativeCreatePortal(children, container as Element, key);
		}
		const next =
			portalPlugins.size > 0 || portalState.portalClaimOverride
				? retargetPortalContainer(container as Element | DocumentFragment)
				: container;
		return nativeCreatePortal(children, next as Element, key);
	}) as typeof ReactDOM.createPortal;
}

/**
 * append 被重定向到 portal scope 后，调用方仍可能对 body 做 remove/replace。
 * 若 child 实际父节点已变，改从实际父节点操作，避免 NotFoundError。
 */
export function resolveRetargetedChildParent(
	assumedParent: Node,
	child: Node,
): Node {
	const actual = child.parentNode;
	return actual && actual !== assumedParent ? actual : assumedParent;
}

function retargetBodyMount(parent: Node, node: Node): Node {
	if (portalState.bodyPatchBusy) return parent;
	if (parent !== document.body && parent !== document.documentElement) {
		return parent;
	}
	if (portalPlugins.size === 0 && !portalState.portalClaimOverride) {
		return parent;
	}
	if (shouldSkipPortalNode(node)) return parent;
	return retargetPortalContainer(parent as Element);
}

export function ensureBodyPortalPatch() {
	if (portalState.bodyPortalPatched) return;

	// 只在首次安装时抓原生方法（ensurePortalNatives）；勿把已 patch 的函数存成 orig
	const {
		appendChild: nativeAppend,
		insertBefore: nativeInsert,
		append: nativeAppendFn,
		prepend: nativePrepend,
		removeChild: nativeRemove,
		replaceChild: nativeReplace,
	} = ensurePortalNatives();

	portalState.bodyPortalPatched = true;

	Node.prototype.appendChild = function mfAppendChild<T extends Node>(
		node: T,
	): T {
		if (
			portalState.bodyPatchBusy ||
			(this !== document.body && this !== document.documentElement) ||
			(portalPlugins.size === 0 && !portalState.portalClaimOverride)
		) {
			return nativeAppend.call(this, node) as T;
		}
		const parent = retargetBodyMount(this, node);
		const ret = nativeAppend.call(parent, node) as T;
		if (parent !== this) stampRealmOnPortalNode(node);
		return ret;
	};

	Node.prototype.insertBefore = function mfInsertBefore<T extends Node>(
		node: T,
		ref: Node | null,
	): T {
		if (
			portalState.bodyPatchBusy ||
			(this !== document.body && this !== document.documentElement) ||
			(portalPlugins.size === 0 && !portalState.portalClaimOverride)
		) {
			return nativeInsert.call(this, node, ref) as T;
		}
		const parent = retargetBodyMount(this, node);
		if (parent !== this) {
			const ret = nativeAppend.call(parent, node) as T;
			stampRealmOnPortalNode(node);
			return ret;
		}
		return nativeInsert.call(this, node, ref) as T;
	};

	Node.prototype.removeChild = function mfRemoveChild<T extends Node>(
		child: T,
	): T {
		if (
			portalState.bodyPatchBusy ||
			(this !== document.body && this !== document.documentElement)
		) {
			return nativeRemove.call(this, child) as T;
		}
		const parent = resolveRetargetedChildParent(this, child);
		return nativeRemove.call(parent, child) as T;
	};

	Node.prototype.replaceChild = function mfReplaceChild<T extends Node>(
		node: Node,
		child: T,
	): T {
		if (
			portalState.bodyPatchBusy ||
			(this !== document.body && this !== document.documentElement)
		) {
			return nativeReplace.call(this, node, child) as T;
		}
		const parent = resolveRetargetedChildParent(this, child);
		return nativeReplace.call(parent, node, child) as T;
	};

	Element.prototype.append = function mfAppend(
		...nodes: (Node | string)[]
	): void {
		if (
			portalState.bodyPatchBusy ||
			(this !== document.body && this !== document.documentElement) ||
			(portalPlugins.size === 0 && !portalState.portalClaimOverride)
		) {
			nativeAppendFn.apply(this, nodes);
			return;
		}
		for (const n of nodes) {
			if (typeof n === 'string') {
				nativeAppendFn.call(this, n);
				continue;
			}
			const parent = retargetBodyMount(this, n);
			if (parent !== this) {
				nativeAppend.call(parent, n);
				stampRealmOnPortalNode(n);
			} else {
				nativeAppendFn.call(this, n);
			}
		}
	};

	Element.prototype.prepend = function mfPrepend(
		...nodes: (Node | string)[]
	): void {
		if (
			portalState.bodyPatchBusy ||
			(this !== document.body && this !== document.documentElement) ||
			(portalPlugins.size === 0 && !portalState.portalClaimOverride)
		) {
			nativePrepend.apply(this, nodes);
			return;
		}
		for (const n of nodes) {
			if (typeof n === 'string') {
				nativePrepend.call(this, n);
				continue;
			}
			const parent = retargetBodyMount(this, n);
			if (parent !== this) {
				nativeAppend.call(parent, n);
				stampRealmOnPortalNode(n);
			} else {
				nativePrepend.call(this, n);
			}
		}
	};
}

export function maybeReleaseBodyPortalPatch() {
	if (!portalState.bodyPortalPatched) return;
	if (portalPlugins.size > 0 || portalState.portalClaimOverride) return;
	const natives = getPortalNatives();
	if (natives) {
		Node.prototype.appendChild = natives.appendChild;
		Node.prototype.insertBefore = natives.insertBefore;
		Element.prototype.append = natives.append;
		Element.prototype.prepend = natives.prepend;
		Node.prototype.removeChild = natives.removeChild;
		Node.prototype.replaceChild = natives.replaceChild;
		if (portalState.createPortalPatched) {
			ReactDOM.createPortal = natives.createPortal;
			portalState.createPortalPatched = false;
		}
	}
	setPortalNatives(null);
	portalState.bodyPortalPatched = false;
}
