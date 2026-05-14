/**
 * LangChain.js `createAgent` / LangGraph（Pregel）等会用到 Web Crypto 语义（如 randomUUID），依赖 `globalThis.crypto`。
 *
 * 官方 Node **v18.13+** 通常会自带 `globalThis.crypto`（PM2 + v18.20.8 实测启动时为 `object`）。
 * 本 polyfill 仅在 `globalThis.crypto` **缺失**时补上 `node:crypto` 的 `webcrypto`，不覆盖已有实现。
 * 须在 `main.ts` 中先于 `./app.module` 导入，避免加载 `langchain` 早于 polyfill。
 */
import { webcrypto } from 'node:crypto';

if (typeof globalThis.crypto === 'undefined') {
	Object.defineProperty(globalThis, 'crypto', {
		value: webcrypto,
		writable: true,
		configurable: true,
		enumerable: true,
	});
}
