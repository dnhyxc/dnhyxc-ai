/** 短文示例：含标题节点 + 常见块 */
export const SAMPLE_SHORT_HTML = `
<div data-type="note-title" data-value="richtext-kit 试用笔记">richtext-kit 试用笔记</div>
<p>这是 <strong>短文编辑</strong> 示例：编辑器 / 预览用法对齐学习笔记插件。</p>
<ul>
  <li>短文：<code>RichEditor</code> + <code>NotePreview</code></li>
  <li>长文：<code>LargeRichEditor</code> + <code>NotePreview</code> + <code>WindowedNotePreview</code></li>
  <li>图片：<code>onUploadImage</code>（本 demo 用 Object URL）</li>
</ul>
<p><img alt="preview" src="data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='640' height='400'><rect fill='%2314b8a6' width='640' height='400'/><text x='320' y='210' fill='white' font-size='36' text-anchor='middle'>click to preview</text></svg>"></p>
<pre><code class="language-ts">import { RichEditor, Btn } from '@dnhyxc-ai/richtext-kit';
import { NotePreview } from '@dnhyxc-ai/richtext-kit/preview';
import { isLargeNoteHtml, LargeRichEditor, WindowedNotePreview } from '@dnhyxc-ai/richtext-kit/windowed';</code></pre>
<blockquote><p>样式：<code>@dnhyxc-ai/richtext-kit/styles.css</code> + 宿主 theme token</p></blockquote>
`.trim();

/** 生成触发窗口化阈值的长文（≥ LARGE_MIN_BLOCKS） */
export function buildLargeHtml(blocks = 96): string {
	const title =
		'<div data-type="note-title" data-value="长文窗口示例">长文窗口示例</div>';
	const paras = Array.from(
		{ length: blocks },
		(_, i) =>
			`<p>段落 ${i + 1}：滚动编辑时只挂载窗口内 DOM，避免全文拖垮页面。</p>`,
	).join('');
	return `${title}${paras}`;
}
