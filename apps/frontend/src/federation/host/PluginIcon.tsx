import { Puzzle } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { resolveCosUrlForWebDisplay } from '@/utils';
import { getPlatformFetch } from '@/utils/fetch';
import {
	type HostSvgParts,
	isPluginIconUrl,
	normalizeSvgForHostIcon,
} from './pluginIconUrl';

export type PluginIconProps = {
	/** registry `menu.icon` / `host.icon`：SVG 图片 URL */
	name?: string;
	className?: string;
};

const CACHE_VER = 'kind-v9';
const svgCache = new Map<string, HostSvgParts>();

function cacheKey(url: string) {
	return `${CACHE_VER}:${url}`;
}

/**
 * 与 registry 拉取一致：绝对 http(s) 走 Tauri HTTP 插件（无 CORS）；
 * `/ext-cos/` 等同源路径仍用窗口 fetch（对齐侧栏头像的 resolveCosUrlForWebDisplay）。
 */
async function fetchIconText(src: string): Promise<string> {
	const doFetch = /^https?:\/\//i.test(src)
		? await getPlatformFetch()
		: globalThis.fetch.bind(globalThis);
	const res = await doFetch(src, { cache: 'no-cache' });
	if (!res.ok) throw new Error(`icon fetch ${res.status}`);
	return res.text();
}

/**
 * 内联 SVG：近黑灰单色（含 iconfont #2c2c2c）跟侧栏 text-* / 选中 text-teal-500；
 * 品牌多色保留上传色；填充/描边分流动画。
 *
 * dangerouslySetInnerHTML 必须用稳定对象引用：React 19 updateProperties 对
 * 该 prop 做 `===`，每次新 `{__html}` 都会 `innerHTML=` 重建子节点；
 * stroke 画线挂在 path 上会在仍 :hover 时重播；fill 画线挂在 svg 上故无感。
 */
export function PluginIcon({ name, className }: PluginIconProps) {
	const [parts, setParts] = useState<HostSvgParts | null>(() => {
		const key = name?.trim() ?? '';
		return isPluginIconUrl(key) ? (svgCache.get(cacheKey(key)) ?? null) : null;
	});
	const [failed, setFailed] = useState(() => !isPluginIconUrl(name));

	useEffect(() => {
		const key = name?.trim() ?? '';
		if (!isPluginIconUrl(key)) {
			setParts(null);
			setFailed(true);
			return;
		}
		const cached = svgCache.get(cacheKey(key));
		if (cached) {
			setParts(cached);
			setFailed(false);
			return;
		}

		let cancelled = false;
		setFailed(false);
		setParts(null);

		// 与侧栏头像同一套展示 URL：dev/Web 生产走 /ext-cos/；Tauri 生产保留 COS 直链
		const src = resolveCosUrlForWebDisplay(key);
		void (async () => {
			try {
				const text = await fetchIconText(src);
				const next = normalizeSvgForHostIcon(text);
				if (!next) throw new Error('invalid svg');
				svgCache.set(cacheKey(key), next);
				if (!cancelled) setParts(next);
			} catch {
				if (!cancelled) {
					setParts(null);
					setFailed(true);
				}
			}
		})();

		return () => {
			cancelled = true;
		};
	}, [name]);

	const html = useMemo(
		() => (parts ? { __html: parts.innerHTML } : null),
		[parts],
	);

	if (failed || !parts || !html) {
		return (
			<Puzzle
				className={cn('size-4 shrink-0 overflow-visible', className)}
				aria-hidden
			/>
		);
	}

	return (
		<svg
			xmlns="http://www.w3.org/2000/svg"
			viewBox={parts.viewBox}
			{...parts.rootProps}
			data-plugin-icon-kind={parts.kind}
			data-plugin-icon-theme={parts.theme}
			className={cn(
				'size-4 shrink-0 overflow-visible plugin-host-icon',
				parts.theme === 'current' && 'plugin-host-icon--theme',
				className,
			)}
			aria-hidden
			focusable="false"
			dangerouslySetInnerHTML={html}
		/>
	);
}
