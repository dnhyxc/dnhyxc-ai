export const PDF_READER_ZOOM_STORAGE_KEY = 'dnhyxc_pdf_reader_zoom';

/** 相对「适应宽度」的缩放倍数，1 = 100%（满宽） */
export const DEFAULT_PDF_ZOOM = 1;
export const PDF_ZOOM_MIN = 0.5;
export const PDF_ZOOM_MAX = 3;
export const PDF_ZOOM_STEP = 0.1;

export function clampPdfZoom(value: number): number {
	if (!Number.isFinite(value)) return DEFAULT_PDF_ZOOM;
	return Math.min(PDF_ZOOM_MAX, Math.max(PDF_ZOOM_MIN, value));
}

export function loadPdfZoom(): number {
	try {
		const raw = localStorage.getItem(PDF_READER_ZOOM_STORAGE_KEY);
		if (raw == null) return DEFAULT_PDF_ZOOM;
		return clampPdfZoom(Number.parseFloat(raw));
	} catch {
		return DEFAULT_PDF_ZOOM;
	}
}

export function savePdfZoom(zoom: number): void {
	try {
		localStorage.setItem(
			PDF_READER_ZOOM_STORAGE_KEY,
			String(clampPdfZoom(zoom)),
		);
	} catch {
		/* ignore quota / private mode */
	}
}

export function stepPdfZoom(current: number, delta: number): number {
	const next = clampPdfZoom(Math.round((current + delta) * 10) / 10);
	return next;
}
