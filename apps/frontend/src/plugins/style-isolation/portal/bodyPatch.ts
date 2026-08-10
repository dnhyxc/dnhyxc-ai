/**
 * body / createPortal 原型劫持：把挂到 document.body 的节点收编进 portal scope。
 */
import { isValidElement, type ReactNode } from 'react';
import ReactDOM from 'react-dom';
import { resolveClaimPluginId } from './claim';
import { ensureBodyPortalScope, stampRealmOnPortalNode } from './scopeDom';
import { portalPlugins, portalState } from './state';

const PORTAL_SKIP_TAGS = new Set([
	'SCRIPT',
	'STYLE',
	'LINK',
	'META',
	'NOSCRIPT',
	'TEMPLATE',
	'BASE',
]);

let origCreatePortal: typeof ReactDOM.createPortal | null = null;
let origBodyAppend: typeof Node.prototype.appendChild | null = null;
let origBodyInsert: typeof Node.prototype.insertBefore | null = null;
let origBodyAppendFn: typeof Element.prototype.append | null = null;
let origBodyPrepend: typeof Element.prototype.prepend | null = null;
let origBodyRemove: typeof Node.prototype.removeChild | null = null;
let origBodyReplace: typeof Node.prototype.replaceChild | null = null;

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

export function ensureCreatePortalPatch() {
	if (portalState.createPortalPatched) return;
	portalState.createPortalPatched = true;
	origCreatePortal = ReactDOM.createPortal.bind(ReactDOM);
	ReactDOM.createPortal = ((children, container, key) => {
		if (isHostProtectedPortalChildren(children)) {
			return origCreatePortal!(children, container as Element, key);
		}
		const next =
			portalPlugins.size > 0 || portalState.portalClaimOverride
				? retargetPortalContainer(container as Element | DocumentFragment)
				: container;
		return origCreatePortal!(children, next as Element, key);
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
	portalState.bodyPortalPatched = true;
	origBodyAppend = Node.prototype.appendChild;
	origBodyInsert = Node.prototype.insertBefore;
	origBodyAppendFn = Element.prototype.append;
	origBodyPrepend = Element.prototype.prepend;
	origBodyRemove = Node.prototype.removeChild;
	origBodyReplace = Node.prototype.replaceChild;

	Node.prototype.appendChild = function mfAppendChild<T extends Node>(
		node: T,
	): T {
		if (
			portalState.bodyPatchBusy ||
			(this !== document.body && this !== document.documentElement) ||
			(portalPlugins.size === 0 && !portalState.portalClaimOverride)
		) {
			return origBodyAppend!.call(this, node) as T;
		}
		const parent = retargetBodyMount(this, node);
		const ret = origBodyAppend!.call(parent, node) as T;
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
			return origBodyInsert!.call(this, node, ref) as T;
		}
		const parent = retargetBodyMount(this, node);
		if (parent !== this) {
			const ret = origBodyAppend!.call(parent, node) as T;
			stampRealmOnPortalNode(node);
			return ret;
		}
		return origBodyInsert!.call(this, node, ref) as T;
	};

	Node.prototype.removeChild = function mfRemoveChild<T extends Node>(
		child: T,
	): T {
		if (
			portalState.bodyPatchBusy ||
			(this !== document.body && this !== document.documentElement)
		) {
			return origBodyRemove!.call(this, child) as T;
		}
		const parent = resolveRetargetedChildParent(this, child);
		return origBodyRemove!.call(parent, child) as T;
	};

	Node.prototype.replaceChild = function mfReplaceChild<T extends Node>(
		node: Node,
		child: T,
	): T {
		if (
			portalState.bodyPatchBusy ||
			(this !== document.body && this !== document.documentElement)
		) {
			return origBodyReplace!.call(this, node, child) as T;
		}
		const parent = resolveRetargetedChildParent(this, child);
		return origBodyReplace!.call(parent, node, child) as T;
	};

	Element.prototype.append = function mfAppend(
		...nodes: (Node | string)[]
	): void {
		if (
			portalState.bodyPatchBusy ||
			(this !== document.body && this !== document.documentElement) ||
			(portalPlugins.size === 0 && !portalState.portalClaimOverride)
		) {
			origBodyAppendFn!.apply(this, nodes);
			return;
		}
		for (const n of nodes) {
			if (typeof n === 'string') {
				origBodyAppendFn!.call(this, n);
				continue;
			}
			const parent = retargetBodyMount(this, n);
			if (parent !== this) {
				origBodyAppend!.call(parent, n);
				stampRealmOnPortalNode(n);
			} else {
				origBodyAppendFn!.call(this, n);
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
			origBodyPrepend!.apply(this, nodes);
			return;
		}
		for (const n of nodes) {
			if (typeof n === 'string') {
				origBodyPrepend!.call(this, n);
				continue;
			}
			const parent = retargetBodyMount(this, n);
			if (parent !== this) {
				origBodyAppend!.call(parent, n);
				stampRealmOnPortalNode(n);
			} else {
				origBodyPrepend!.call(this, n);
			}
		}
	};
}

export function maybeReleaseBodyPortalPatch() {
	if (!portalState.bodyPortalPatched) return;
	if (portalPlugins.size > 0 || portalState.portalClaimOverride) return;
	if (origBodyAppend) Node.prototype.appendChild = origBodyAppend;
	if (origBodyInsert) Node.prototype.insertBefore = origBodyInsert;
	if (origBodyAppendFn) Element.prototype.append = origBodyAppendFn;
	if (origBodyPrepend) Element.prototype.prepend = origBodyPrepend;
	if (origBodyRemove) Node.prototype.removeChild = origBodyRemove;
	if (origBodyReplace) Node.prototype.replaceChild = origBodyReplace;
	origBodyAppend = null;
	origBodyInsert = null;
	origBodyAppendFn = null;
	origBodyPrepend = null;
	origBodyRemove = null;
	origBodyReplace = null;
	portalState.bodyPortalPatched = false;
}
