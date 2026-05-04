import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

let cached: { name: string; version: string } | null = null;

/** 读取包自身的 package.json（用于 GitHub User-Agent） */
export function getKitIdentity(): { name: string; version: string } {
	if (cached) return cached;
	const dir = path.dirname(fileURLToPath(import.meta.url));
	// dist/pkg/meta.js → 包根目录 package.json
	const pkgPath = path.join(dir, '..', '..', 'package.json');
	const raw = fs.readFileSync(pkgPath, 'utf-8');
	const j = JSON.parse(raw) as { name?: string; version?: string };
	cached = {
		name: j.name ?? 'release-kit',
		version: j.version ?? '0.0.0',
	};
	return cached;
}

export function githubUserAgent(): string {
	const { name, version } = getKitIdentity();
	return `${name}/${version}`;
}
