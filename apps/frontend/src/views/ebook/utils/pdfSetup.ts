import * as pdfjs from 'pdfjs-dist';
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

pdfjs.GlobalWorkerOptions.workerSrc = pdfWorker;

/** 生成站点根下的绝对资源 URL（worker 内 fetch 须用绝对路径，避免落到 /assets/ 下） */
function pdfAssetUrl(dir: string): string {
	const base = import.meta.env.BASE_URL || '/';
	if (typeof window === 'undefined') {
		return `${base}${dir}/`;
	}
	return new URL(`${base}${dir}/`, window.location.origin).href;
}

export const PDFJS_WASM_URL = pdfAssetUrl('pdfjs-wasm');
export const PDFJS_CMAP_URL = pdfAssetUrl('pdfjs-cmaps');

export function pdfLoadOptions(data: Uint8Array) {
	return {
		data,
		wasmUrl: PDFJS_WASM_URL,
		cMapUrl: PDFJS_CMAP_URL,
		cMapPacked: true,
	};
}

export { pdfjs };
