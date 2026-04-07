/**
 * Mermaid 图表点击放大预览：将 DOM 中的 SVG 转为 ImagePreview（<img>）可用的 data URL。
 */

import { downloadBlob } from '@/utils';

/**
 * 将 `data:image/svg+xml` 类 data URL 转为 Blob（支持 URI 编码与 base64）。
 */
export function svgImageDataUrlToBlob(dataUrl: string): Blob | null {
	try {
		const trimmed = dataUrl.trim();
		const m = /^data:([^,]*),([\s\S]*)$/i.exec(trimmed);
		if (!m) return null;
		const meta = m[1].toLowerCase();
		const payload = m[2];
		if (!meta.includes('svg')) return null;
		const isBase64 = /;base64/i.test(meta);
		let text: string;
		if (isBase64) {
			text = atob(payload.replace(/\s/g, ''));
		} else {
			try {
				text = decodeURIComponent(payload);
			} catch {
				text = payload;
			}
		}
		return new Blob([text], { type: 'image/svg+xml;charset=utf-8' });
	} catch {
		return null;
	}
}

/** 下载 Mermaid 预览用的 SVG data URL（Web 与 Tauri 均走 {@link downloadBlob}） */
export async function downloadMermaidPreviewSvg(
	dataUrl: string,
	fileName?: string,
): Promise<void> {
	const blob = svgImageDataUrlToBlob(dataUrl);
	if (!blob) return;
	const stamp = Date.now();
	await downloadBlob(
		{
			file_name: fileName ?? `mermaid-${stamp}.svg`,
			id: `mermaid-svg-${stamp}`,
			overwrite: true,
		},
		blob,
	);
}

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
