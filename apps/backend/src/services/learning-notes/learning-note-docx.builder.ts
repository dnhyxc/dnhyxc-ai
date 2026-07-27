/**
 * 学习笔记 TipTap HTML → DOCX：保留富文本样式 + 图片 + 表格。
 */
import {
	AlignmentType,
	BorderStyle,
	Document,
	ExternalHyperlink,
	type IBorderOptions,
	type IBordersOptions,
	ImageRun,
	type IRunStylePropertiesOptions,
	type ISpacingProperties,
	LineRuleType,
	Packer,
	Paragraph,
	type ParagraphChild,
	ShadingType,
	Table,
	TableCell,
	TableRow,
	TextRun,
	UnderlineType,
	WidthType,
} from 'docx';
import {
	decodeUploadPublicPath,
	resolveUploadPublicPathToAbsolute,
} from '../../utils/upload-paths';

/** 单篇 HTML 字符上限（与 Save DTO 同量级） */
export const NOTE_DOCX_HTML_MAX_CHARS = 5_000_000;
/** 最多嵌入图片数 */
export const NOTE_DOCX_IMAGE_MAX_COUNT = 120;
/** 单张解码后建议上限（超过仍尝试嵌入，仅缩小显示尺寸） */
export const NOTE_DOCX_IMAGE_SOFT_MAX_BYTES = 6_000_000;
/** 全部图片解码字节合计软上限 */
export const NOTE_DOCX_IMAGES_TOTAL_SOFT_MAX_BYTES = 40_000_000;
/** 正文单段文本截断 */
const PARA_TEXT_MAX = 50_000;
/** 导出图显示最大宽（px） */
const IMAGE_MAX_WIDTH_PX = 640;
/** 拉取外链图超时 */
const FETCH_TIMEOUT_MS = 20_000;
/** 表格内容区宽度（DXA，约等于 A4 页边距内可用宽） */
const TABLE_WIDTH_DXA = 9026;
/** 对齐页面正文约 11pt；Word size = half-points */
const BODY_SIZE = 22;
/** 对齐页面 line-height: 1.9（240 = 单倍行距） */
const BODY_LINE = 456;
/** 列表每层缩进（twip）；约等于页面 padding-left 1.5em */
const LIST_INDENT = 480;
/** 表格边框：可见细线（size 单位为 1/8 pt） */
const TABLE_BORDER: IBorderOptions = {
	style: BorderStyle.SINGLE,
	size: 8,
	color: 'BFBFBF',
};
/** 代码块无可见边框（靠底色区分） */
const CODE_BORDER: IBorderOptions = {
	style: BorderStyle.NONE,
	size: 0,
	color: 'FFFFFF',
};
/**
 * 对齐页面 `.tiptap pre { padding: 0.75em 1em }`（约 14px 字号 → px×15≈twip）。
 * 水平用段落 indent（各端 Word/WPS 都认）；垂直用空段撑开。
 * ponytail: 不依赖 tcMar——部分客户端会忽略单元格边距，看起来贴左边。
 */
const CODE_PAD_H = 210;
const CODE_PAD_V_LINE = 200;
/** 代码块底色（浅灰，接近页面预览） */
const CODE_BG = 'F3F3F3';

type DocxChild = Paragraph | Table;

function clip(s: string, max: number): string {
	if (!s) return '';
	return s.length <= max ? s : `${s.slice(0, max)}…`;
}

function decodeEntities(s: string): string {
	return s
		.replace(/&nbsp;/gi, ' ')
		.replace(/&amp;/gi, '&')
		.replace(/&lt;/gi, '<')
		.replace(/&gt;/gi, '>')
		.replace(/&quot;/gi, '"')
		.replace(/&#39;/gi, "'")
		.replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
		.replace(/&#x([0-9a-f]+);/gi, (_, h) =>
			String.fromCharCode(Number.parseInt(h, 16)),
		);
}

function parseAttrs(raw: string): Record<string, string> {
	const attrs: Record<string, string> = {};
	const re = /([:@\w.-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g;
	let m: RegExpExecArray | null;
	while ((m = re.exec(raw)) !== null) {
		attrs[m[1].toLowerCase()] = decodeEntities(m[2] ?? m[3] ?? m[4] ?? '');
	}
	return attrs;
}

function styleMap(style: string | undefined): Record<string, string> {
	const out: Record<string, string> = {};
	if (!style) return out;
	for (const part of style.split(';')) {
		const i = part.indexOf(':');
		if (i < 0) continue;
		const k = part.slice(0, i).trim().toLowerCase();
		const v = part.slice(i + 1).trim();
		if (k) out[k] = v;
	}
	return out;
}

function cssColorToHex(input: string | undefined): string | undefined {
	if (!input) return undefined;
	const s = input.trim().toLowerCase();
	const hex = /^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.exec(s);
	if (hex) {
		const h = hex[1];
		if (h.length === 3)
			return `${h[0]}${h[0]}${h[1]}${h[1]}${h[2]}${h[2]}`.toUpperCase();
		return h.slice(0, 6).toUpperCase();
	}
	const rgb = /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i.exec(s);
	if (rgb) {
		const to = (n: string) =>
			Math.max(0, Math.min(255, Number(n)))
				.toString(16)
				.padStart(2, '0');
		return `${to(rgb[1])}${to(rgb[2])}${to(rgb[3])}`.toUpperCase();
	}
	return undefined;
}

function readAlign(
	attrs: Record<string, string>,
): (typeof AlignmentType)[keyof typeof AlignmentType] | undefined {
	const styles = styleMap(attrs.style);
	const align = (styles['text-align'] || attrs.align || '').toLowerCase();
	if (align === 'center') return AlignmentType.CENTER;
	if (align === 'right' || align === 'end') return AlignmentType.RIGHT;
	if (align === 'justify' || align === 'both') return AlignmentType.JUSTIFIED;
	if (align === 'left' || align === 'start') return AlignmentType.LEFT;
	return undefined;
}

type ImgType = 'jpg' | 'png' | 'gif' | 'bmp';

function mimeToType(mime: string): ImgType | 'webp' | null {
	const m = mime.toLowerCase();
	if (m.includes('png')) return 'png';
	if (m.includes('jpeg') || m.includes('jpg')) return 'jpg';
	if (m.includes('gif')) return 'gif';
	if (m.includes('bmp')) return 'bmp';
	if (m.includes('webp')) return 'webp';
	return null;
}

function sniffType(buf: Buffer): ImgType | 'webp' | null {
	if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff)
		return 'jpg';
	if (buf.length >= 8 && buf[0] === 0x89 && buf[1] === 0x50) return 'png';
	if (buf.length >= 6 && buf[0] === 0x47 && buf[1] === 0x49) return 'gif';
	if (buf.length >= 2 && buf[0] === 0x42 && buf[1] === 0x4d) return 'bmp';
	if (
		buf.length >= 12 &&
		buf.toString('ascii', 0, 4) === 'RIFF' &&
		buf.toString('ascii', 8, 12) === 'WEBP'
	)
		return 'webp';
	return null;
}

function pngSize(buf: Buffer): { w: number; h: number } | null {
	if (buf.length < 24 || buf[0] !== 0x89) return null;
	const w = buf.readUInt32BE(16);
	const h = buf.readUInt32BE(20);
	if (!w || !h || w > 20_000 || h > 20_000) return null;
	return { w, h };
}

function jpegSize(buf: Buffer): { w: number; h: number } | null {
	if (buf.length < 4 || buf[0] !== 0xff || buf[1] !== 0xd8) return null;
	let i = 2;
	while (i + 9 < buf.length) {
		if (buf[i] !== 0xff) {
			i += 1;
			continue;
		}
		const marker = buf[i + 1];
		if (marker === 0xd9 || marker === 0xda) break;
		const len = buf.readUInt16BE(i + 2);
		if (len < 2) break;
		if (
			(marker >= 0xc0 && marker <= 0xc3) ||
			(marker >= 0xc5 && marker <= 0xc7) ||
			(marker >= 0xc9 && marker <= 0xcb) ||
			(marker >= 0xcd && marker <= 0xcf)
		) {
			const h = buf.readUInt16BE(i + 5);
			const w = buf.readUInt16BE(i + 7);
			if (w && h && w <= 20_000 && h <= 20_000) return { w, h };
			return null;
		}
		i += 2 + len;
	}
	return null;
}

function gifSize(buf: Buffer): { w: number; h: number } | null {
	if (buf.length < 10 || buf.toString('ascii', 0, 3) !== 'GIF') return null;
	const w = buf.readUInt16LE(6);
	const h = buf.readUInt16LE(8);
	if (!w || !h || w > 20_000 || h > 20_000) return null;
	return { w, h };
}

function webpSize(buf: Buffer): { w: number; h: number } | null {
	if (buf.length < 30 || buf.toString('ascii', 0, 4) !== 'RIFF') return null;
	if (buf.toString('ascii', 8, 12) !== 'WEBP') return null;
	const chunk = buf.toString('ascii', 12, 16);
	if (chunk === 'VP8X' && buf.length >= 30) {
		const w = 1 + buf[24] + (buf[25] << 8) + (buf[26] << 16);
		const h = 1 + buf[27] + (buf[28] << 8) + (buf[29] << 16);
		if (w && h && w <= 20_000 && h <= 20_000) return { w, h };
	}
	if (chunk === 'VP8 ' && buf.length >= 30) {
		const w = buf.readUInt16LE(26) & 0x3fff;
		const h = buf.readUInt16LE(28) & 0x3fff;
		if (w && h) return { w, h };
	}
	return null;
}

function imageSize(
	buf: Buffer,
	kind: ImgType | 'webp',
): { w: number; h: number } {
	const dim =
		kind === 'png'
			? pngSize(buf)
			: kind === 'jpg'
				? jpegSize(buf)
				: kind === 'gif'
					? gifSize(buf)
					: kind === 'webp'
						? webpSize(buf)
						: null;
	return (
		dim ?? { w: IMAGE_MAX_WIDTH_PX, h: Math.round(IMAGE_MAX_WIDTH_PX * 0.75) }
	);
}

function scaleSize(w: number, h: number): { width: number; height: number } {
	if (w <= IMAGE_MAX_WIDTH_PX) return { width: w, height: Math.max(1, h) };
	const height = Math.max(1, Math.round((h * IMAGE_MAX_WIDTH_PX) / w));
	return { width: IMAGE_MAX_WIDTH_PX, height };
}

type ImageBudget = {
	count: number;
	bytes: number;
	skipped: number;
	/** 跳过原因（最多记几条，写入页脚便于线上排查） */
	reasons: string[];
};

function skipImage(budget: ImageBudget, reason: string): null {
	budget.skipped += 1;
	if (budget.reasons.length < 6) budget.reasons.push(reason);
	return null;
}

function parseDataUrl(src: string): { mime: string; buf: Buffer } | null {
	const m =
		/^data:(image\/[a-z0-9.+-]+)((?:;[\w.=+-]+)*)?(;base64),([\s\S]+)$/i.exec(
			src.trim(),
		);
	if (!m?.[3]) return null;
	try {
		const buf = Buffer.from(m[4].replace(/\s+/g, ''), 'base64');
		if (!buf.length) return null;
		return { mime: m[1].toLowerCase(), buf };
	} catch {
		return null;
	}
}

async function fetchRemoteImage(
	url: string,
): Promise<{ mime: string; buf: Buffer } | null> {
	let parsed: URL;
	try {
		parsed = new URL(url);
	} catch {
		return null;
	}
	if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
	const ac = new AbortController();
	const timer = setTimeout(() => ac.abort(), FETCH_TIMEOUT_MS);
	try {
		const res = await fetch(url, {
			signal: ac.signal,
			redirect: 'follow',
			headers: { Accept: 'image/*,*/*;q=0.8' },
		});
		if (!res.ok) return null;
		const mime =
			(res.headers.get('content-type') || '').split(';')[0].trim() ||
			'application/octet-stream';
		const buf = Buffer.from(await res.arrayBuffer());
		if (!buf.length) return null;
		return { mime, buf };
	} catch {
		return null;
	} finally {
		clearTimeout(timer);
	}
}

const MIME_BY_EXT: Record<string, string> = {
	'.jpg': 'image/jpeg',
	'.jpeg': 'image/jpeg',
	'.png': 'image/png',
	'.gif': 'image/gif',
	'.webp': 'image/webp',
	'.bmp': 'image/bmp',
};

/**
 * 从绝对/相对 URL 抽出本机 uploads 公开路径（/images|files|remotes/...）。
 * 生产机自拉公网常因 hairpin/反代失败；优先读盘比 fetch 稳。
 */
function extractUploadPublicPath(src: string): string | null {
	const trimmed = src.trim();
	if (!trimmed) return null;
	try {
		const asUrl = /^https?:\/\//i.test(trimmed)
			? new URL(trimmed)
			: new URL(trimmed, 'http://local.invalid');
		const servePath =
			/\/upload\/serve\/?$/i.test(asUrl.pathname) ||
			/\/api\/upload\/serve\/?$/i.test(asUrl.pathname)
				? asUrl.searchParams.get('path')
				: null;
		if (servePath?.trim()) {
			return decodeUploadPublicPath(servePath);
		}
		if (/^\/(images|files|remotes)\//.test(asUrl.pathname)) {
			return decodeUploadPublicPath(asUrl.pathname);
		}
	} catch {
		/* fall through */
	}
	if (/^\/(images|files|remotes)\//.test(trimmed.split('?')[0])) {
		return decodeUploadPublicPath(trimmed.split('?')[0]);
	}
	return null;
}

async function tryReadLocalUpload(
	src: string,
): Promise<{ mime: string; buf: Buffer } | null> {
	const publicPath = extractUploadPublicPath(src);
	if (!publicPath) return null;
	try {
		const { existsSync } = await import('node:fs');
		const { readFile } = await import('node:fs/promises');
		const { extname } = await import('node:path');
		const abs = resolveUploadPublicPathToAbsolute(publicPath);
		if (!existsSync(abs)) return null;
		const buf = await readFile(abs);
		if (!buf.length) return null;
		const mime =
			MIME_BY_EXT[extname(abs).toLowerCase()] ?? 'application/octet-stream';
		return { mime, buf };
	} catch {
		return null;
	}
}

async function loadImageBytes(
	src: string,
): Promise<{ mime: string; buf: Buffer } | null> {
	if (/^data:/i.test(src)) return parseDataUrl(src);
	const local = await tryReadLocalUpload(src);
	if (local) return local;
	if (/^https?:\/\//i.test(src)) return fetchRemoteImage(src);
	return null;
}

/**
 * Word 只稳吃 jpg/png/gif/bmp。webp/avif/heic 等经 sharp 转 JPEG。
 * 懒加载 sharp：不能顶层 require——生产 Node18 装错版本时会拖垮整个进程。
 * sharp 需 ≤0.33.x（支持 Node 18）；0.35+ 要求 Node ≥20.9。
 */
async function rasterToJpeg(buf: Buffer): Promise<Buffer | null> {
	try {
		// ponytail: 延迟 require，启动路径与 sharp 解耦
		const mod = require('sharp') as
			| ((input: Buffer) => {
					rotate: () => {
						jpeg: (o: { quality: number }) => {
							toBuffer: () => Promise<Buffer>;
						};
					};
			  })
			| {
					default: (input: Buffer) => {
						rotate: () => {
							jpeg: (o: { quality: number }) => {
								toBuffer: () => Promise<Buffer>;
							};
						};
					};
			  };
		const sharpFn = typeof mod === 'function' ? mod : mod.default;
		if (typeof sharpFn !== 'function') throw new Error('sharp unavailable');
		return await sharpFn(buf).rotate().jpeg({ quality: 90 }).toBuffer();
	} catch {
		/* fall through to sips（仅 macOS 本机开发兜底） */
	}
	try {
		const { mkdtemp, writeFile, readFile, rm } = await import(
			'node:fs/promises'
		);
		const { tmpdir } = await import('node:os');
		const { join } = await import('node:path');
		const { execFile } = await import('node:child_process');
		const { promisify } = await import('node:util');
		const execFileAsync = promisify(execFile);
		const dir = await mkdtemp(join(tmpdir(), 'note-img-'));
		const inPath = join(dir, 'in.bin');
		const outPath = join(dir, 'out.jpg');
		try {
			await writeFile(inPath, buf);
			await execFileAsync(
				'sips',
				['-s', 'format', 'jpeg', inPath, '--out', outPath],
				{ timeout: 15_000 },
			);
			return await readFile(outPath);
		} finally {
			await rm(dir, { recursive: true, force: true }).catch(() => undefined);
		}
	} catch {
		return null;
	}
}

function docxNativeKind(
	mime: string,
	buf: Buffer,
): ImgType | 'webp' | 'foreign' | null {
	const fromMime = mimeToType(mime);
	if (fromMime) return fromMime;
	const sniffed = sniffType(buf);
	if (sniffed) return sniffed;
	// image/* 但 Word 不认（avif/heic/svg…）→ 交 sharp
	if (mime.startsWith('image/')) return 'foreign';
	return null;
}

async function toDocxImage(
	src: string,
	budget: ImageBudget,
): Promise<ParagraphChild | null> {
	if (budget.count >= NOTE_DOCX_IMAGE_MAX_COUNT) {
		return skipImage(budget, '超过图片数量上限');
	}
	const preview = src.trim().slice(0, 48);
	const loaded = await loadImageBytes(src);
	if (!loaded) {
		return skipImage(
			budget,
			`无法读取(${preview}${src.length > 48 ? '…' : ''})`,
		);
	}
	let { mime, buf } = loaded;
	let kind = docxNativeKind(mime, buf);
	if (!kind) {
		return skipImage(budget, `无法识别格式(${mime || 'unknown'})`);
	}
	if (kind === 'webp' || kind === 'foreign') {
		const jpeg = await rasterToJpeg(buf);
		if (!jpeg) {
			return skipImage(budget, `转JPEG失败(${mime || kind})`);
		}
		buf = jpeg;
		kind = 'jpg';
	}
	if (buf.length > 15_000_000) {
		return skipImage(budget, '单图过大');
	}
	const dim = imageSize(buf, kind);
	const transformation = scaleSize(dim.w, dim.h);
	budget.count += 1;
	budget.bytes += buf.length;
	return new ImageRun({ type: kind, data: buf, transformation });
}

// —— 富文本：行内样式 ——

type InlineStyle = {
	bold?: boolean;
	italics?: boolean;
	underline?: boolean;
	strike?: boolean;
	code?: boolean;
	color?: string;
	highlight?: string;
	href?: string;
	/** Word half-points；未设则沿用正文默认 */
	size?: number;
};

/**
 * 对齐 remote-plugins RichEditor/styles.css 的块级视觉（不用 Word 内置 Heading，避免蓝字）。
 * 字号按 body 11pt × CSS em 估算。
 */
type BlockVisual = {
	spacing?: ISpacingProperties;
	indent?: { left?: number };
	border?: IBordersOptions;
	baseRun?: InlineStyle;
};

function blockVisual(tag: string): BlockVisual {
	const bodySpacing: ISpacingProperties = {
		before: 40,
		after: 40,
		line: BODY_LINE,
		lineRule: LineRuleType.AUTO,
	};
	switch (tag) {
		case 'h1':
			return {
				spacing: {
					before: 160,
					after: 100,
					line: 312,
					lineRule: LineRuleType.AUTO,
				},
				baseRun: { bold: true, size: 40, color: '1A1A1A' },
			};
		case 'h2':
			return {
				spacing: {
					before: 140,
					after: 90,
					line: 324,
					lineRule: LineRuleType.AUTO,
				},
				baseRun: { bold: true, size: 37, color: '1A1A1A' },
			};
		case 'h3':
			return {
				spacing: {
					before: 120,
					after: 80,
					line: 336,
					lineRule: LineRuleType.AUTO,
				},
				baseRun: { bold: true, size: 33, color: '1A1A1A' },
			};
		case 'h4':
			return {
				spacing: {
					before: 100,
					after: 70,
					line: 336,
					lineRule: LineRuleType.AUTO,
				},
				baseRun: { bold: true, size: 30, color: '1A1A1A' },
			};
		case 'h5':
		case 'h6':
			return {
				spacing: {
					before: 90,
					after: 60,
					line: 348,
					lineRule: LineRuleType.AUTO,
				},
				baseRun: { bold: true, size: 26, color: '1A1A1A' },
			};
		case 'blockquote':
			return {
				spacing: bodySpacing,
				indent: { left: 120 },
				border: {
					left: {
						style: BorderStyle.SINGLE,
						size: 24,
						color: 'C8C8C8',
						space: 14,
					},
				},
				baseRun: { color: '666666' },
			};
		default:
			return { spacing: bodySpacing };
	}
}

function mergeStyle(base: InlineStyle, patch: InlineStyle): InlineStyle {
	return { ...base, ...patch };
}

function runProps(style: InlineStyle): IRunStylePropertiesOptions {
	const codeSize = style.size
		? Math.max(16, Math.round(style.size * 0.875))
		: 18;
	return {
		...(style.bold ? { bold: true } : {}),
		...(style.italics ? { italics: true } : {}),
		...(style.underline || style.href
			? { underline: { type: UnderlineType.SINGLE } }
			: {}),
		...(style.strike ? { strike: true } : {}),
		...(style.size && !style.code ? { size: style.size } : {}),
		...(style.code
			? {
					font: 'Courier New',
					size: codeSize,
					shading: { type: ShadingType.CLEAR, fill: 'F0F0F0' },
				}
			: {}),
		...(style.href
			? { color: '0563C1' }
			: style.color
				? { color: style.color }
				: {}),
		...(style.highlight && !style.code
			? {
					shading: {
						type: ShadingType.CLEAR,
						fill: style.highlight,
					},
				}
			: {}),
	};
}

function makeTextRun(text: string, style: InlineStyle): TextRun {
	return new TextRun({
		text: clip(text, PARA_TEXT_MAX),
		...runProps(style),
	});
}

function pushText(
	out: ParagraphChild[],
	text: string,
	style: InlineStyle,
): void {
	if (!text) return;
	const run = makeTextRun(text, style);
	if (style.href) {
		let link = style.href.trim();
		if (link && !/^https?:\/\//i.test(link) && !/^mailto:/i.test(link)) {
			link = `https://${link}`;
		}
		out.push(
			new ExternalHyperlink({
				link,
				children: [run],
			}),
		);
		return;
	}
	out.push(run);
}

type OpenTag = { name: string; attrs: Record<string, string> };

/** 把一段 HTML 转成带样式的 runs（遇 img 返回占位，由外层拆段） */
function htmlToStyledRuns(
	html: string,
	baseStyle: InlineStyle = {},
): Array<
	{ type: 'runs'; children: ParagraphChild[] } | { type: 'img'; src: string }
> {
	const segments: Array<
		{ type: 'runs'; children: ParagraphChild[] } | { type: 'img'; src: string }
	> = [];
	let current: ParagraphChild[] = [];
	const stack: InlineStyle[] = [baseStyle];
	const tagStack: OpenTag[] = [];

	const flushRuns = () => {
		if (current.length) {
			segments.push({ type: 'runs', children: current });
			current = [];
		}
	};

	const styleNow = () => stack[stack.length - 1] ?? {};

	let i = 0;
	while (i < html.length) {
		if (html[i] !== '<') {
			const next = html.indexOf('<', i);
			const raw = next < 0 ? html.slice(i) : html.slice(i, next);
			pushText(current, decodeEntities(raw), styleNow());
			i = next < 0 ? html.length : next;
			continue;
		}
		const end = html.indexOf('>', i);
		if (end < 0) break;
		const rawTag = html.slice(i + 1, end);
		i = end + 1;

		if (rawTag.startsWith('!--')) continue;
		const selfClosing = rawTag.endsWith('/');
		const body = selfClosing ? rawTag.slice(0, -1).trim() : rawTag.trim();
		if (!body) continue;

		if (body.startsWith('/')) {
			const name = body.slice(1).trim().toLowerCase().split(/\s+/)[0];
			while (tagStack.length) {
				const top = tagStack.pop()!;
				stack.pop();
				if (top.name === name) break;
			}
			continue;
		}

		const nameMatch = /^([a-z0-9-]+)/i.exec(body);
		if (!nameMatch) continue;
		const name = nameMatch[1].toLowerCase();
		const attrs = parseAttrs(body.slice(nameMatch[0].length));

		if (name === 'br') {
			pushText(current, '\n', styleNow());
			continue;
		}
		if (name === 'img') {
			const src = attrs.src?.trim();
			if (src) {
				flushRuns();
				segments.push({ type: 'img', src });
			}
			continue;
		}
		if (name === 'hr') continue;

		const voidTags = new Set([
			'area',
			'base',
			'col',
			'embed',
			'input',
			'link',
			'meta',
			'param',
			'source',
			'track',
			'wbr',
		]);
		if (selfClosing || voidTags.has(name)) continue;

		const prev = styleNow();
		const next = { ...prev };
		const styles = styleMap(attrs.style);

		if (name === 'strong' || name === 'b') next.bold = true;
		if (name === 'em' || name === 'i') next.italics = true;
		if (name === 'u') next.underline = true;
		if (name === 's' || name === 'del' || name === 'strike') next.strike = true;
		if (name === 'code') next.code = true;
		if (name === 'mark') {
			next.highlight =
				cssColorToHex(attrs['data-color']) ||
				cssColorToHex(styles['background-color']) ||
				'FFEB3B';
		}
		if (name === 'a' && attrs.href) {
			next.href = attrs.href;
			next.underline = true;
		}
		if (styles.color) {
			const c = cssColorToHex(styles.color);
			if (c) next.color = c;
		}
		if (styles['background-color'] && name !== 'mark') {
			const h = cssColorToHex(styles['background-color']);
			if (h) next.highlight = h;
		}
		// span 上的 text-decoration
		const deco = (styles['text-decoration'] || '').toLowerCase();
		if (deco.includes('underline')) next.underline = true;
		if (deco.includes('line-through')) next.strike = true;
		const weight = (styles['font-weight'] || '').toLowerCase();
		if (weight === 'bold' || Number(weight) >= 600) next.bold = true;
		const fs = (styles['font-style'] || '').toLowerCase();
		if (fs === 'italic') next.italics = true;

		tagStack.push({ name, attrs });
		stack.push(mergeStyle(prev, next));
	}

	flushRuns();
	return segments;
}

type Block =
	| {
			kind: 'el';
			tag: string;
			attrs: Record<string, string>;
			inner: string;
	  }
	| { kind: 'img'; src: string }
	| { kind: 'hr' };

/** 顶层块扫描（尊重 ul/ol/pre 嵌套，不把内部 p 提前拆出） */
function splitTopBlocks(html: string): Block[] {
	const blocks: Block[] = [];
	let i = 0;
	const s = html;

	const skipWs = () => {
		while (i < s.length && /\s/.test(s[i])) i += 1;
	};

	while (i < s.length) {
		skipWs();
		if (i >= s.length) break;
		if (s[i] !== '<') {
			const next = s.indexOf('<', i);
			const text = (next < 0 ? s.slice(i) : s.slice(i, next)).trim();
			if (text) {
				blocks.push({
					kind: 'el',
					tag: 'p',
					attrs: {},
					inner: text,
				});
			}
			i = next < 0 ? s.length : next;
			continue;
		}

		const end = s.indexOf('>', i);
		if (end < 0) break;
		const raw = s.slice(i + 1, end);
		i = end + 1;

		if (raw.startsWith('!--') || raw.startsWith('/')) continue;
		const selfClosing = raw.endsWith('/');
		const body = (selfClosing ? raw.slice(0, -1) : raw).trim();
		const nameMatch = /^([a-z0-9-]+)/i.exec(body);
		if (!nameMatch) continue;
		const tag = nameMatch[1].toLowerCase();
		const attrs = parseAttrs(body.slice(nameMatch[0].length));

		if (tag === 'img') {
			const src = attrs.src?.trim();
			if (src) blocks.push({ kind: 'img', src });
			continue;
		}
		if (tag === 'hr') {
			blocks.push({ kind: 'hr' });
			continue;
		}
		if (tag === 'br') {
			blocks.push({ kind: 'el', tag: 'p', attrs: {}, inner: '' });
			continue;
		}

		// 找匹配闭合标签（简单深度计数）
		const openRe = new RegExp(`<${tag}\\b[^>]*>`, 'gi');
		const closeRe = new RegExp(`</${tag}\\s*>`, 'gi');
		let depth = 1;
		let cursor = i;
		let innerEnd = s.length;
		while (cursor < s.length && depth > 0) {
			openRe.lastIndex = cursor;
			closeRe.lastIndex = cursor;
			const openM = openRe.exec(s);
			const closeM = closeRe.exec(s);
			if (!closeM) break;
			if (openM && openM.index < closeM.index) {
				depth += 1;
				cursor = openM.index + openM[0].length;
			} else {
				depth -= 1;
				if (depth === 0) {
					innerEnd = closeM.index;
					i = closeM.index + closeM[0].length;
					break;
				}
				cursor = closeM.index + closeM[0].length;
			}
		}

		const inner = s.slice(end + 1, depth === 0 ? innerEnd : s.length);
		if (depth !== 0) i = s.length;

		if (
			tag === 'p' ||
			tag === 'h1' ||
			tag === 'h2' ||
			tag === 'h3' ||
			tag === 'h4' ||
			tag === 'h5' ||
			tag === 'h6' ||
			tag === 'blockquote' ||
			tag === 'pre' ||
			tag === 'ul' ||
			tag === 'ol' ||
			tag === 'div' ||
			tag === 'li' ||
			tag === 'table'
		) {
			blocks.push({ kind: 'el', tag, attrs, inner });
		} else {
			// 未知容器：展开内部（tbody/thead/tr/td 等会走到这里，仅当外层未按 table 整块吃掉时）
			blocks.push(...splitTopBlocks(inner));
		}
	}
	return blocks;
}

function extractLis(inner: string): Array<{
	attrs: Record<string, string>;
	inner: string;
}> {
	// 深度匹配：避免嵌套 </li> 被非贪婪正则提前截断，导致缩进层级丢失
	return extractClosedElements(inner, new Set(['li'])).map((el) => ({
		attrs: el.attrs,
		inner: el.inner,
	}));
}

/** 去掉 taskItem 的 label/checkbox UI，只留内容区（通常是外层 div） */
function unwrapTaskItemContent(html: string): string {
	const blocks = splitTopBlocks(html);
	if (blocks.length === 0) {
		return html.replace(/<label\b[^>]*>[\s\S]*?<\/label>/gi, '');
	}
	const parts: string[] = [];
	for (const b of blocks) {
		if (b.kind !== 'el') continue;
		if (b.tag === 'label') continue;
		if (b.tag === 'div') {
			parts.push(b.inner);
			continue;
		}
		parts.push(`<${b.tag}${attrsToHtml(b.attrs)}>${b.inner}</${b.tag}>`);
	}
	return (
		parts.join('') || html.replace(/<label\b[^>]*>[\s\S]*?<\/label>/gi, '')
	);
}

function attrsToHtml(attrs: Record<string, string>): string {
	const keys = Object.keys(attrs);
	if (keys.length === 0) return '';
	return keys
		.map((k) => ` ${k}="${String(attrs[k]).replace(/"/g, '&quot;')}"`)
		.join('');
}

function isTaskListAttrs(attrs: Record<string, string>): boolean {
	return (attrs['data-type'] || '').toLowerCase() === 'tasklist';
}

function isTaskItemAttrs(
	attrs: Record<string, string>,
	inTaskList: boolean,
): boolean {
	const type = (attrs['data-type'] || '').toLowerCase();
	if (type === 'taskitem') return true;
	if (inTaskList && 'data-checked' in attrs) return true;
	return false;
}

function taskItemChecked(
	attrs: Record<string, string>,
	innerHtml: string,
): boolean {
	if ('data-checked' in attrs) {
		const raw = String(attrs['data-checked']).toLowerCase();
		return raw === 'true' || raw === 'checked' || raw === '';
	}
	return /<input\b[^>]*\bchecked\b/i.test(innerHtml);
}

/** 按深度匹配提取指定标签（跳过其它开标签，便于扫 table 内的 tr/td） */
function extractClosedElements(
	html: string,
	tags: Set<string>,
): Array<{ tag: string; attrs: Record<string, string>; inner: string }> {
	const out: Array<{
		tag: string;
		attrs: Record<string, string>;
		inner: string;
	}> = [];
	let i = 0;
	const s = html;
	while (i < s.length) {
		const lt = s.indexOf('<', i);
		if (lt < 0) break;
		const gt = s.indexOf('>', lt);
		if (gt < 0) break;
		const raw = s.slice(lt + 1, gt);
		i = gt + 1;
		if (raw.startsWith('!') || raw.startsWith('/') || raw.startsWith('?')) {
			continue;
		}
		const selfClosing = raw.endsWith('/');
		const body = (selfClosing ? raw.slice(0, -1) : raw).trim();
		const nameMatch = /^([a-z0-9-]+)/i.exec(body);
		if (!nameMatch) continue;
		const tag = nameMatch[1].toLowerCase();
		if (!tags.has(tag)) continue;
		const attrs = parseAttrs(body.slice(nameMatch[0].length));
		if (selfClosing) {
			out.push({ tag, attrs, inner: '' });
			continue;
		}
		const openRe = new RegExp(`<${tag}\\b[^>]*>`, 'gi');
		const closeRe = new RegExp(`</${tag}\\s*>`, 'gi');
		let depth = 1;
		let cursor = i;
		let innerEnd = s.length;
		while (cursor < s.length && depth > 0) {
			openRe.lastIndex = cursor;
			closeRe.lastIndex = cursor;
			const openM = openRe.exec(s);
			const closeM = closeRe.exec(s);
			if (!closeM) break;
			if (openM && openM.index < closeM.index) {
				depth += 1;
				cursor = openM.index + openM[0].length;
			} else {
				depth -= 1;
				if (depth === 0) {
					innerEnd = closeM.index;
					i = closeM.index + closeM[0].length;
					break;
				}
				cursor = closeM.index + closeM[0].length;
			}
		}
		out.push({ tag, attrs, inner: s.slice(gt + 1, innerEnd) });
		if (depth !== 0) break;
	}
	return out;
}

type HtmlTableCell = {
	tag: 'td' | 'th';
	attrs: Record<string, string>;
	inner: string;
};

function parseHtmlTable(inner: string): HtmlTableCell[][] {
	return extractClosedElements(inner, new Set(['tr']))
		.map((row) =>
			extractClosedElements(row.inner, new Set(['td', 'th'])).map((c) => ({
				tag: (c.tag === 'th' ? 'th' : 'td') as 'td' | 'th',
				attrs: c.attrs,
				inner: c.inner,
			})),
		)
		.filter((r) => r.length > 0);
}

async function tableFromHtml(
	inner: string,
	budget: ImageBudget,
): Promise<Table | null> {
	const rowDatas = parseHtmlTable(inner);
	if (rowDatas.length === 0) return null;

	const colCount = Math.max(
		1,
		...rowDatas.map((r) =>
			r.reduce((n, c) => n + Math.max(1, Number(c.attrs.colspan) || 1), 0),
		),
	);
	const colW = Math.max(1, Math.floor(TABLE_WIDTH_DXA / colCount));

	const rows: TableRow[] = [];
	for (const row of rowDatas) {
		const cells: TableCell[] = [];
		for (const cell of row) {
			const isHeader = cell.tag === 'th';
			const colspan = Math.max(1, Number(cell.attrs.colspan) || 1);
			const rowspan = Math.max(1, Number(cell.attrs.rowspan) || 1);
			const blocks = splitTopBlocks(cell.inner);
			const children: DocxChild[] = [];
			if (blocks.length === 0) {
				children.push(
					new Paragraph({
						children: [
							new TextRun({ text: '', ...(isHeader ? { bold: true } : {}) }),
						],
					}),
				);
			} else {
				for (const b of blocks) {
					if (b.kind !== 'el') {
						children.push(...(await blocksToDocxChildren([b], budget)));
						continue;
					}
					if (
						b.tag === 'table' ||
						b.tag === 'ul' ||
						b.tag === 'ol' ||
						b.tag === 'div'
					) {
						children.push(...(await blocksToDocxChildren([b], budget)));
						continue;
					}
					children.push(
						...(await paragraphsFromStyledInner(
							{
								tag: b.tag,
								attrs: b.attrs,
								inner: isHeader
									? `<span style="font-weight:700">${b.inner}</span>`
									: b.inner,
							},
							budget,
						)),
					);
				}
			}
			if (children.length === 0) {
				children.push(new Paragraph({ children: [new TextRun({ text: '' })] }));
			}
			cells.push(
				new TableCell({
					borders: {
						top: TABLE_BORDER,
						bottom: TABLE_BORDER,
						left: TABLE_BORDER,
						right: TABLE_BORDER,
					},
					width: { type: WidthType.DXA, size: colW * colspan },
					...(colspan > 1 ? { columnSpan: colspan } : {}),
					...(rowspan > 1 ? { rowSpan: rowspan } : {}),
					...(isHeader
						? { shading: { type: ShadingType.CLEAR, fill: 'EFEFEF' } }
						: {}),
					margins: { top: 60, bottom: 60, left: 80, right: 80 },
					children,
				}),
			);
		}
		rows.push(
			new TableRow({
				children: cells,
				// ponytail: 不设 tableHeader。Word 的 w:tblHeader（跨页重复表头）会在部分客户端
				// 把表头再画成一张「只有表头」的表，看起来像导出重复。表头外观靠 th 底色/加粗即可。
			}),
		);
	}

	return new Table({
		width: { type: WidthType.DXA, size: TABLE_WIDTH_DXA },
		columnWidths: Array.from({ length: colCount }, () => colW),
		borders: {
			top: TABLE_BORDER,
			bottom: TABLE_BORDER,
			left: TABLE_BORDER,
			right: TABLE_BORDER,
			insideHorizontal: TABLE_BORDER,
			insideVertical: TABLE_BORDER,
		},
		rows,
	});
}

/**
 * 代码块：单格表格底色 + 段落缩进/空段模拟 CSS padding
 *（段落 shading 与 tcMar 在部分客户端不可靠）。
 */
function preToDocxTable(
	inner: string,
	alignment: (typeof AlignmentType)[keyof typeof AlignmentType] | undefined,
): Table {
	const text = clip(
		decodeEntities(inner.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '')),
		PARA_TEXT_MAX,
	);
	const lines = text ? text.split('\n') : [' '];

	const spacer = () =>
		new Paragraph({
			alignment,
			spacing: {
				before: 0,
				after: 0,
				line: CODE_PAD_V_LINE,
				lineRule: LineRuleType.EXACT,
			},
			children: [
				new TextRun({
					text: ' ',
					font: 'Courier New',
					size: 18,
					color: '1A1A1A',
				}),
			],
		});

	const children = [
		spacer(),
		...lines.map(
			(line) =>
				new Paragraph({
					alignment,
					indent: { left: CODE_PAD_H, right: CODE_PAD_H },
					spacing: {
						before: 0,
						after: 0,
						line: 276,
						lineRule: LineRuleType.AUTO,
					},
					children: [
						new TextRun({
							text: line || ' ',
							font: 'Courier New',
							size: 18,
							color: '1A1A1A',
						}),
					],
				}),
		),
		spacer(),
	];

	return new Table({
		width: { type: WidthType.DXA, size: TABLE_WIDTH_DXA },
		columnWidths: [TABLE_WIDTH_DXA],
		borders: {
			top: CODE_BORDER,
			bottom: CODE_BORDER,
			left: CODE_BORDER,
			right: CODE_BORDER,
			insideHorizontal: CODE_BORDER,
			insideVertical: CODE_BORDER,
		},
		rows: [
			new TableRow({
				children: [
					new TableCell({
						borders: {
							top: CODE_BORDER,
							bottom: CODE_BORDER,
							left: CODE_BORDER,
							right: CODE_BORDER,
						},
						width: { type: WidthType.DXA, size: TABLE_WIDTH_DXA },
						shading: { type: ShadingType.CLEAR, fill: CODE_BG },
						// 边距交给段落 indent/空段，避免与 tcMar 叠加或被客户端忽略
						margins: { top: 0, bottom: 0, left: 0, right: 0 },
						children,
					}),
				],
			}),
		],
	});
}

async function paragraphsFromStyledInner(
	opts: {
		tag: string;
		attrs: Record<string, string>;
		inner: string;
		listPrefix?: string;
		/** 列表层级缩进（twip）；与 listPrefix 独立，嵌套层可只加缩进不加前缀 */
		listIndent?: number;
	},
	budget: ImageBudget,
): Promise<DocxChild[]> {
	const { tag, attrs, inner, listPrefix, listIndent } = opts;
	const alignment = readAlign(attrs);
	const visual = blockVisual(tag);
	const indentLeft = (listIndent ?? 0) + (visual.indent?.left ?? 0);
	const paraExtras = {
		alignment,
		spacing: visual.spacing,
		border: visual.border,
		...(indentLeft > 0 ? { indent: { left: indentLeft } } : {}),
	};
	const out: DocxChild[] = [];

	if (tag === 'pre') {
		out.push(preToDocxTable(inner, alignment));
		return out;
	}

	const segments = htmlToStyledRuns(inner, visual.baseRun ?? {});
	if (segments.length === 0) {
		out.push(
			new Paragraph({
				...paraExtras,
				children: listPrefix
					? [
							new TextRun({
								text: listPrefix,
								...runProps(visual.baseRun ?? {}),
							}),
						]
					: [
							new TextRun({
								text: '',
								...runProps(visual.baseRun ?? {}),
							}),
						],
			}),
		);
		return out;
	}

	let pendingPrefix = listPrefix;
	for (const seg of segments) {
		if (seg.type === 'img') {
			const run = await toDocxImage(seg.src, budget);
			out.push(
				new Paragraph({
					alignment,
					spacing: visual.spacing,
					...(indentLeft > 0 ? { indent: { left: indentLeft } } : {}),
					children: run
						? [run]
						: [
								new TextRun({
									text: '[图片无法嵌入]',
									italics: true,
									color: '888888',
								}),
							],
				}),
			);
			pendingPrefix = undefined;
			continue;
		}
		const children = [...seg.children];
		if (pendingPrefix) {
			children.unshift(
				new TextRun({
					text: pendingPrefix,
					...runProps(visual.baseRun ?? {}),
				}),
			);
			pendingPrefix = undefined;
		}
		if (children.length === 0) continue;
		out.push(
			new Paragraph({
				...paraExtras,
				children,
			}),
		);
	}
	return out;
}

async function listToDocxChildren(
	tag: 'ul' | 'ol',
	attrs: Record<string, string>,
	inner: string,
	budget: ImageBudget,
	depth: number,
): Promise<DocxChild[]> {
	const out: DocxChild[] = [];
	const inTaskList = isTaskListAttrs(attrs);
	const items = extractLis(inner);
	let index = 1;
	const indent = LIST_INDENT * (depth + 1);

	for (const item of items) {
		const isTask = isTaskItemAttrs(item.attrs, inTaskList);
		const contentHtml = isTask ? unwrapTaskItemContent(item.inner) : item.inner;

		let prefix = '• ';
		if (tag === 'ol') {
			prefix = `${index}. `;
			index += 1;
		}
		if (isTask) {
			prefix = taskItemChecked(item.attrs, item.inner) ? '☑ ' : '☐ ';
		}

		const innerBlocks = splitTopBlocks(contentHtml);
		if (innerBlocks.length === 0) {
			out.push(
				...(await paragraphsFromStyledInner(
					{
						tag: 'p',
						attrs: item.attrs,
						inner: contentHtml,
						listPrefix: prefix,
						listIndent: indent,
					},
					budget,
				)),
			);
			continue;
		}

		let usedPrefix = false;
		for (const ib of innerBlocks) {
			if (ib.kind === 'el' && (ib.tag === 'ul' || ib.tag === 'ol')) {
				out.push(
					...(await listToDocxChildren(
						ib.tag,
						ib.attrs,
						ib.inner,
						budget,
						depth + 1,
					)),
				);
				continue;
			}
			if (ib.kind !== 'el') {
				out.push(...(await blocksToDocxChildren([ib], budget)));
				continue;
			}
			if (ib.tag === 'table') {
				out.push(...(await blocksToDocxChildren([ib], budget)));
				continue;
			}
			if (ib.tag === 'div') {
				// 非 task 的残留 div：展开后继续按列表项渲染
				const nested = splitTopBlocks(ib.inner);
				for (const nb of nested) {
					if (nb.kind === 'el' && (nb.tag === 'ul' || nb.tag === 'ol')) {
						out.push(
							...(await listToDocxChildren(
								nb.tag,
								nb.attrs,
								nb.inner,
								budget,
								depth + 1,
							)),
						);
						continue;
					}
					if (nb.kind !== 'el') {
						out.push(...(await blocksToDocxChildren([nb], budget)));
						continue;
					}
					out.push(
						...(await paragraphsFromStyledInner(
							{
								tag: nb.tag === 'li' ? 'p' : nb.tag,
								attrs: nb.attrs,
								inner: nb.inner,
								listPrefix: usedPrefix ? undefined : prefix,
								listIndent: indent,
							},
							budget,
						)),
					);
					usedPrefix = true;
				}
				continue;
			}
			out.push(
				...(await paragraphsFromStyledInner(
					{
						tag: ib.tag,
						attrs: ib.attrs,
						inner: ib.inner,
						listPrefix: usedPrefix ? undefined : prefix,
						listIndent: indent,
					},
					budget,
				)),
			);
			usedPrefix = true;
		}
	}

	return out;
}

async function blocksToDocxChildren(
	blocks: Block[],
	budget: ImageBudget,
): Promise<DocxChild[]> {
	const out: DocxChild[] = [];

	for (const block of blocks) {
		if (block.kind === 'hr') {
			out.push(
				new Paragraph({
					border: {
						bottom: {
							style: BorderStyle.SINGLE,
							size: 12,
							color: 'CCCCCC',
							space: 1,
						},
					},
					spacing: { before: 120, after: 120 },
					children: [],
				}),
			);
			continue;
		}
		if (block.kind === 'img') {
			const run = await toDocxImage(block.src, budget);
			out.push(
				new Paragraph({
					children: run
						? [run]
						: [
								new TextRun({
									text: '[图片无法嵌入]',
									italics: true,
									color: '888888',
								}),
							],
				}),
			);
			continue;
		}

		const { tag, attrs, inner } = block;

		if (tag === 'table') {
			const table = await tableFromHtml(inner, budget);
			if (table) {
				out.push(table);
				out.push(new Paragraph({ children: [] }));
			}
			continue;
		}

		if (tag === 'ul' || tag === 'ol') {
			out.push(...(await listToDocxChildren(tag, attrs, inner, budget, 0)));
			continue;
		}

		// 引用：按内部块分段，保留多段换行（避免多个 <p> 被拼成一行）
		if (tag === 'blockquote') {
			const innerBlocks = splitTopBlocks(inner);
			if (innerBlocks.length === 0) {
				out.push(
					...(await paragraphsFromStyledInner(
						{ tag: 'blockquote', attrs, inner },
						budget,
					)),
				);
			} else {
				for (const ib of innerBlocks) {
					if (ib.kind !== 'el') {
						out.push(...(await blocksToDocxChildren([ib], budget)));
						continue;
					}
					if (ib.tag === 'blockquote') {
						out.push(...(await blocksToDocxChildren([ib], budget)));
						continue;
					}
					out.push(
						...(await paragraphsFromStyledInner(
							{
								tag: 'blockquote',
								attrs: { ...attrs, ...ib.attrs },
								inner: ib.inner,
							},
							budget,
						)),
					);
				}
			}
			continue;
		}

		if (tag === 'div') {
			// 展开 div（如 taskItem 内层）
			out.push(...(await blocksToDocxChildren(splitTopBlocks(inner), budget)));
			continue;
		}

		out.push(
			...(await paragraphsFromStyledInner({ tag, attrs, inner }, budget)),
		);
	}

	return out;
}

/**
 * 将 TipTap HTML 转为 DOCX Buffer（保留样式与图片）。
 */
export async function buildLearningNoteDocxBuffer(input: {
	title: string;
	html: string;
}): Promise<Buffer> {
	const html = input.html ?? '';
	if (html.length > NOTE_DOCX_HTML_MAX_CHARS) {
		throw new Error(
			`笔记内容过大（>${NOTE_DOCX_HTML_MAX_CHARS} 字符），请精简后再导出`,
		);
	}

	const budget: ImageBudget = { count: 0, bytes: 0, skipped: 0, reasons: [] };
	const children: DocxChild[] = [
		new Paragraph({
			spacing: {
				before: 0,
				after: 200,
				line: 312,
				lineRule: LineRuleType.AUTO,
			},
			children: [
				new TextRun({
					text: clip(input.title.trim() || '无标题笔记', 200),
					bold: true,
					size: 44,
					color: '1A1A1A',
				}),
			],
		}),
		new Paragraph({ text: '' }),
	];

	const body = html.replace(
		/<div[^>]*data-type=["']note-title["'][^>]*>[\s\S]*?<\/div>/gi,
		'',
	);

	const paras = await blocksToDocxChildren(splitTopBlocks(body), budget);
	children.push(...paras);

	if (budget.skipped > 0) {
		const detail = budget.reasons.length
			? budget.reasons.join('；')
			: '格式不支持或文件过大';
		children.push(new Paragraph({ text: '' }));
		children.push(
			new Paragraph({
				children: [
					new TextRun({
						text: `（有 ${budget.skipped} 张图片未能嵌入：${detail}）`,
						italics: true,
						color: '888888',
						size: 18,
					}),
				],
			}),
		);
	}

	const doc = new Document({
		styles: {
			default: {
				document: {
					run: {
						font: 'Calibri',
						size: BODY_SIZE,
						color: '1A1A1A',
					},
					paragraph: {
						spacing: {
							line: BODY_LINE,
							lineRule: LineRuleType.AUTO,
						},
					},
				},
			},
		},
		sections: [
			{
				properties: {
					page: {
						margin: {
							top: 720,
							right: 720,
							bottom: 720,
							left: 720,
						},
					},
				},
				children,
			},
		],
	});
	return Buffer.from(await Packer.toBuffer(doc));
}
