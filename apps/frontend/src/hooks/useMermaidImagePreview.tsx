import ImagePreview from '@design/ImagePreview';
import {
	type ReactNode,
	type RefObject,
	useCallback,
	useEffect,
	useRef,
	useState,
} from 'react';
import { mermaidSvgToPreviewDataUrl } from '@/utils/mermaidImagePreview';

export type UseMermaidImagePreviewResult = {
	/** 打开预览（传入 {@link mermaidSvgToPreviewDataUrl} 或等价的 data URL） */
	openMermaidPreview: (dataUrl: string) => void;
	/** 挂到页面中的 ImagePreview 节点（通常放在组件树根附近） */
	mermaidImagePreviewModal: ReactNode;
};

/**
 * Mermaid 图表：ImagePreview 弹层状态与下载逻辑。
 * 与 {@link useMermaidDiagramClickPreview} 配合，在任意 Markdown 根节点上委托点击。
 */
export function useMermaidImagePreview(): UseMermaidImagePreviewResult {
	const [previewUrl, setPreviewUrl] = useState<string | null>(null);

	const openMermaidPreview = useCallback((dataUrl: string) => {
		setPreviewUrl(dataUrl);
	}, []);

	const onPreviewVisibleChange = useCallback((visible: boolean) => {
		if (!visible) setPreviewUrl(null);
	}, []);

	const mermaidImagePreviewModal = (
		<ImagePreview
			visible={previewUrl !== null}
			selectedImage={previewUrl ? { url: previewUrl } : { url: '' }}
			onVisibleChange={onPreviewVisibleChange}
			title="Mermaid 图表预览"
			showPrevAndNext={false}
		/>
	);

	return { openMermaidPreview, mermaidImagePreviewModal };
}

/**
 * 在 `root` 子树内委托点击：命中某块 `.markdown-mermaid-wrap` 内的 SVG 时打开预览。
 * 使用 `closest('.markdown-mermaid-wrap')`，同一根下多块 Mermaid 也能区分。
 *
 * @param rebindWhen 变化时重新绑定（如预览 html、岛 code），避免 ref 或 innerHTML 更新后未挂上监听
 */
export function useMermaidDiagramClickPreview(
	rootRef: RefObject<HTMLElement | null>,
	openMermaidPreview: (dataUrl: string) => void,
	enabled: boolean,
	rebindWhen: unknown,
): void {
	const openRef = useRef(openMermaidPreview);
	openRef.current = openMermaidPreview;

	useEffect(() => {
		if (!enabled) return;
		const root = rootRef.current;
		if (!root) return;

		const onClick = (e: MouseEvent) => {
			const el = e.target as HTMLElement | null;
			if (!el) return;
			if (el.closest('.markdown-mermaid-zoom-chrome')) return;

			const wrap = el.closest('.markdown-mermaid-wrap');
			if (!wrap) return;

			const svg = wrap.querySelector('.mermaid svg') as SVGSVGElement | null;
			if (!svg || !svg.contains(el)) return;

			const url = mermaidSvgToPreviewDataUrl(svg);
			if (url) openRef.current(url);
		};

		root.addEventListener('click', onClick);
		return () => root.removeEventListener('click', onClick);
	}, [enabled, rebindWhen, rootRef]);
}
