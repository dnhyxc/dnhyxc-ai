/**
 * Mermaid 图表点击放大预览：将 DOM 中的 SVG 转为 ImagePreview（<img>）可用的 data URL。
 */

/** 将 Mermaid 渲染得到的 SVG 转为可在 ImagePreview（<img>）中使用的 data URL */
export function mermaidSvgToPreviewDataUrl(svg: SVGElement): string | null {
	try {
		const clone = svg.cloneNode(true) as SVGSVGElement;
		if (!clone.getAttribute('xmlns')) {
			clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
		}
		const xml = new XMLSerializer().serializeToString(clone);
		return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(xml)}`;
	} catch {
		return null;
	}
}
