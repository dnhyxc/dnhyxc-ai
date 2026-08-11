/** 静态 Lucide 与插件 stroke 对齐：pathLength=1 + dasharray:1，避免路径长短导致画线快慢不一 */

const HOST = '.lucide-stroke-draw-hover';
const SHAPE =
	'svg:not(.plugin-host-icon) :is(path,line,circle,polyline,rect,ellipse)';

function ensurePathLength(host: Element) {
	for (const el of host.querySelectorAll(SHAPE)) {
		if (el.getAttribute('pathLength') !== '1') {
			el.setAttribute('pathLength', '1');
		}
	}
}

/** 悬停前给宿主内 Lucide 图形补 pathLength（插件 SVG 已在 normalize 时写好） */
export function bindLucideStrokePathLength(
	root: ParentNode = document,
): () => void {
	const onOver = (e: Event) => {
		const t = e.target;
		if (!(t instanceof Element)) return;
		const host = t.closest(HOST);
		if (host) ensurePathLength(host);
	};

	root.addEventListener('mouseover', onOver, true);
	return () => root.removeEventListener('mouseover', onOver, true);
}
