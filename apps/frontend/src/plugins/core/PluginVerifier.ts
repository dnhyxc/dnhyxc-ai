import { translateSync } from '@/i18n';
import { HOST_API_VERSION, type PluginDescriptor } from './types';

function parseSemver(v: string): [number, number, number] | null {
	const m = v
		.trim()
		.replace(/^v/, '')
		.match(/^(\d+)\.(\d+)\.(\d+)/);
	if (!m) return null;
	return [Number(m[1]), Number(m[2]), Number(m[3])];
}

/** 支持 `^x.y.z` / `>=x.y.z` / 精确版本 */
export function satisfiesRange(version: string, range: string): boolean {
	const ver = parseSemver(version);
	if (!ver) return false;
	const r = range.trim();
	if (r.startsWith('^')) {
		const base = parseSemver(r.slice(1));
		if (!base) return false;
		if (ver[0] !== base[0]) return false;
		if (ver[0] === 0) {
			return ver[1] === base[1] && ver[2] >= base[2];
		}
		return ver[1] > base[1] || (ver[1] === base[1] && ver[2] >= base[2]);
	}
	if (r.startsWith('>=')) {
		const base = parseSemver(r.slice(2));
		if (!base) return false;
		return (
			ver[0] > base[0] ||
			(ver[0] === base[0] && ver[1] > base[1]) ||
			(ver[0] === base[0] && ver[1] === base[1] && ver[2] >= base[2])
		);
	}
	const exact = parseSemver(r);
	return (
		!!exact && exact[0] === ver[0] && exact[1] === ver[1] && exact[2] === ver[2]
	);
}

/**
 * 准入以「自家 registry 已上架」为准，不再维护逐插件 origin 白名单。
 * 生产只收 https；开发额外允许 localhost / 127.0.0.1 的 http。
 */
export function entryUrlAllowed(
	entry: string,
	opts?: { prod?: boolean },
): boolean {
	let url: URL;
	try {
		url = new URL(entry);
	} catch {
		return false;
	}
	if (url.protocol === 'https:') return true;
	const prod = opts?.prod ?? import.meta.env.PROD;
	if (prod) return false;
	return (
		url.protocol === 'http:' &&
		(url.hostname === 'localhost' || url.hostname === '127.0.0.1')
	);
}

function skipIntegrity(): boolean {
	return import.meta.env.VITE_PLUGIN_SKIP_INTEGRITY !== 'false';
}

async function sha384Base64(buf: ArrayBuffer): Promise<string> {
	const digest = await crypto.subtle.digest('SHA-384', buf);
	const bytes = new Uint8Array(digest);
	let bin = '';
	for (const b of bytes) bin += String.fromCharCode(b);
	return `sha384-${btoa(bin)}`;
}

export class PluginVerifyError extends Error {
	constructor(
		message: string,
		readonly code:
			| 'TRUST'
			| 'ORIGIN'
			| 'HOST_API'
			| 'INTEGRITY'
			| 'SIGNATURE'
			| 'IFRAME',
	) {
		super(message);
		this.name = 'PluginVerifyError';
	}
}

export async function verifyPlugin(d: PluginDescriptor): Promise<void> {
	// 不可信：只校验 iframeUrl，禁止 loadRemote 进主文档
	if (d.trust === 'untrusted') {
		const src = d.iframeUrl?.trim();
		if (!src) {
			throw new PluginVerifyError(
				`plugin ${d.id}: untrusted requires iframeUrl`,
				'IFRAME',
			);
		}
		if (!entryUrlAllowed(src)) {
			throw new PluginVerifyError(
				`plugin ${d.id}: iframeUrl must be https (or localhost http in dev)`,
				'ORIGIN',
			);
		}
		return;
	}

	if (!entryUrlAllowed(d.entry)) {
		throw new PluginVerifyError(
			`plugin ${d.id}: entry must be https (or localhost http in dev)`,
			'ORIGIN',
		);
	}

	if (!satisfiesRange(HOST_API_VERSION, d.hostApiRange)) {
		throw new PluginVerifyError(
			translateSync('plugins.verify.hostApiIncompatible', {
				id: d.id,
				hostApi: HOST_API_VERSION,
				range: d.hostApiRange,
			}),
			'HOST_API',
		);
	}

	if (d.integrity && !skipIntegrity()) {
		const res = await fetch(d.entry, { cache: 'no-store' });
		if (!res.ok) {
			throw new PluginVerifyError(
				`plugin ${d.id}: fetch entry failed ${res.status}`,
				'INTEGRITY',
			);
		}
		const hash = await sha384Base64(await res.arrayBuffer());
		if (hash !== d.integrity) {
			throw new PluginVerifyError(
				`plugin ${d.id}: integrity mismatch`,
				'INTEGRITY',
			);
		}
	}

	// ponytail: signature 由发布流水线验签后可只下发已验标记；此处留钩子
	if (d.signature === 'invalid') {
		throw new PluginVerifyError(`plugin ${d.id}: bad signature`, 'SIGNATURE');
	}
}
