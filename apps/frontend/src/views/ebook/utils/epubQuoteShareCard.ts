/** 书摘分享卡：Canvas 绘制微信读书式日历卡片并导出图片 */

import type { QuoteShareRun } from './epubQuoteShareStyled';
import {
	drawStyledQuoteLines,
	layoutStyledQuoteLines,
	measureStyledQuoteHeight,
	normalizeSegmentsForCanvas,
} from './epubQuoteShareStyled';

const CARD_WIDTH = 360;
const PAD_X = 52;
const CONTENT_W = CARD_WIDTH - PAD_X * 2;
const SCALE = 2;

/** 参考微信读书书摘卡配色 */
const BG = '#F7F7F7';
const TEXT_PRIMARY = '#332C2B';
const TEXT_SECONDARY = '#999999';
const TEXT_BRAND = '#888888';
const DIVIDER = '#E0E0E0';

const FONT_SANS =
	'PingFang SC, Hiragino Sans GB, Microsoft YaHei, Noto Sans SC, sans-serif';

const LAYOUT = {
	padTop: 15,
	daySize: 100,
	dayWeight: 700,
	monthSize: 20,
	monthLineHeight: 24,
	monthWeight: 700,
	weekdaySize: 16,
	weekdayLineHeight: 22,
	gapAfterDay: 20,
	gapAfterMonth: 14,
	gapBeforeDivider: 28,
	dividerWidth: 60,
	gapAfterDivider: 32,
	quoteSize: 17,
	quoteWeight: 600,
	quoteLineHeight: 28,
	gapAfterQuote: 24,
	titleSize: 14,
	titleLineHeight: 22,
	gapAfterTitle: 6,
	authorSize: 12,
	authorLineHeight: 18,
	gapBeforeBrand: 28,
	brandSize: 13,
	padBottom: 50,
};

export type QuoteShareCardInput = {
	quote: string;
	/** 选区 DOM 提取的样式片段；有则保留原文字号/字重 */
	quoteSegments?: QuoteShareRun[];
	bookTitle: string;
	author?: string;
	/** 卡片日期区；默认当天 */
	date?: Date;
	brand: string;
	locale?: string;
};

export type QuoteShareCardResult = {
	canvas: HTMLCanvasElement;
	dataUrl: string;
	blob: Blob;
};

function formatBookTitle(title: string): string {
	const t = title.trim();
	if (!t) return '';
	if (t.startsWith('《') && t.endsWith('》')) return t;
	return `《${t}》`;
}

function formatDateParts(date: Date, locale?: string) {
	const day = String(date.getDate());
	const monthYear = date
		.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
		.toUpperCase();
	const weekday = date.toLocaleDateString(
		locale?.startsWith('en') ? 'en-US' : 'zh-CN',
		{ weekday: 'long' },
	);
	return { day, monthYear, weekday };
}

/** 按最大宽度拆行（中日韩逐字、西文按词） */
function wrapLines(
	ctx: CanvasRenderingContext2D,
	text: string,
	maxWidth: number,
): string[] {
	const normalized = text.replace(/\r\n/g, '\n').trim();
	if (!normalized) return [];

	const lines: string[] = [];
	const paragraphs = normalized.split('\n');

	for (const para of paragraphs) {
		if (!para.trim()) {
			lines.push('');
			continue;
		}
		let line = '';
		for (const char of para) {
			const probe = line + char;
			if (line && ctx.measureText(probe).width > maxWidth) {
				lines.push(line);
				line = char.trimStart() ? char : '';
			} else {
				line = probe;
			}
		}
		if (line) lines.push(line);
	}

	return lines.length ? lines : [''];
}

function quoteFont(ctx: CanvasRenderingContext2D) {
	ctx.font = `${LAYOUT.quoteWeight} ${LAYOUT.quoteSize}px ${FONT_SANS}`;
}

function resolveQuoteLines(
	ctx: CanvasRenderingContext2D,
	input: QuoteShareCardInput,
): { lines: ReturnType<typeof layoutStyledQuoteLines>; height: number } {
	if (input.quoteSegments?.length) {
		const normalized = normalizeSegmentsForCanvas(
			input.quoteSegments,
			LAYOUT.quoteSize,
			FONT_SANS,
		);
		const lines = layoutStyledQuoteLines(ctx, normalized, CONTENT_W);
		return { lines, height: measureStyledQuoteHeight(lines) };
	}

	quoteFont(ctx);
	const plainLines = wrapLines(ctx, input.quote.trim(), CONTENT_W);
	const lines = plainLines.map((text) => ({
		runs: [
			{
				text,
				fontSize: LAYOUT.quoteSize,
				fontWeight: String(LAYOUT.quoteWeight),
				fontFamily: FONT_SANS,
				fontStyle: 'normal',
				width: ctx.measureText(text).width,
			},
		],
		width: ctx.measureText(text).width,
		lineHeight: LAYOUT.quoteLineHeight,
	}));
	return { lines, height: lines.length * LAYOUT.quoteLineHeight };
}

function measureCardHeight(
	ctx: CanvasRenderingContext2D,
	input: QuoteShareCardInput,
): number {
	const title = formatBookTitle(input.bookTitle);
	const author = input.author?.trim() ?? '';
	const { height: quoteBlockH } = resolveQuoteLines(ctx, input);

	let h = LAYOUT.padTop;
	h += LAYOUT.daySize + LAYOUT.gapAfterDay;
	h += LAYOUT.monthLineHeight + LAYOUT.gapAfterMonth;
	h += LAYOUT.weekdayLineHeight + LAYOUT.gapBeforeDivider;
	h += 1 + LAYOUT.gapAfterDivider;
	h += quoteBlockH + LAYOUT.gapAfterQuote;
	if (title) h += LAYOUT.titleLineHeight;
	if (author) h += LAYOUT.gapAfterTitle + LAYOUT.authorLineHeight;
	if (input.brand.trim()) {
		h += LAYOUT.gapBeforeBrand + LAYOUT.brandSize;
	}
	h += LAYOUT.padBottom;
	return h;
}

function drawDivider(ctx: CanvasRenderingContext2D, y: number): void {
	ctx.strokeStyle = DIVIDER;
	ctx.lineWidth = 1;
	const half = LAYOUT.dividerWidth / 2;
	ctx.beginPath();
	ctx.moveTo(CARD_WIDTH / 2 - half, y);
	ctx.lineTo(CARD_WIDTH / 2 + half, y);
	ctx.stroke();
}

function drawCard(
	ctx: CanvasRenderingContext2D,
	input: QuoteShareCardInput,
	height: number,
): void {
	const { day, monthYear, weekday } = formatDateParts(
		input.date ?? new Date(),
		input.locale,
	);
	const title = formatBookTitle(input.bookTitle);
	const author = input.author?.trim() ?? '';
	const brand = input.brand.trim();
	const { lines: quoteLines } = resolveQuoteLines(ctx, input);

	ctx.fillStyle = BG;
	ctx.fillRect(0, 0, CARD_WIDTH, height);

	ctx.textAlign = 'center';
	ctx.textBaseline = 'top';

	let y = LAYOUT.padTop;

	ctx.fillStyle = TEXT_PRIMARY;
	ctx.font = `${LAYOUT.dayWeight} ${LAYOUT.daySize}px ${FONT_SANS}`;
	ctx.fillText(day, CARD_WIDTH / 2, y);
	y += LAYOUT.daySize + LAYOUT.gapAfterDay;

	ctx.font = `${LAYOUT.monthWeight} ${LAYOUT.monthSize}px ${FONT_SANS}`;
	ctx.fillText(monthYear, CARD_WIDTH / 2, y);
	y += LAYOUT.monthLineHeight + LAYOUT.gapAfterMonth;

	ctx.fillStyle = TEXT_SECONDARY;
	ctx.font = `400 ${LAYOUT.weekdaySize}px ${FONT_SANS}`;
	ctx.fillText(weekday, CARD_WIDTH / 2, y);
	y += LAYOUT.weekdayLineHeight + LAYOUT.gapBeforeDivider;

	drawDivider(ctx, y);
	y += 1 + LAYOUT.gapAfterDivider;

	drawStyledQuoteLines(ctx, quoteLines, CARD_WIDTH / 2, y, TEXT_PRIMARY);
	y += measureStyledQuoteHeight(quoteLines) + LAYOUT.gapAfterQuote;

	if (title) {
		ctx.font = `400 ${LAYOUT.titleSize}px ${FONT_SANS}`;
		ctx.fillStyle = TEXT_PRIMARY;
		ctx.fillText(title, CARD_WIDTH / 2, y);
		y += LAYOUT.titleLineHeight;
	}

	if (author) {
		y += title ? LAYOUT.gapAfterTitle : 0;
		ctx.font = `400 ${LAYOUT.authorSize}px ${FONT_SANS}`;
		ctx.fillStyle = TEXT_SECONDARY;
		ctx.fillText(author, CARD_WIDTH / 2, y);
		y += LAYOUT.authorLineHeight;
	}

	if (brand) {
		y += LAYOUT.gapBeforeBrand;
		ctx.font = `400 ${LAYOUT.brandSize}px ${FONT_SANS}`;
		ctx.fillStyle = TEXT_BRAND;
		ctx.fillText(brand, CARD_WIDTH / 2, y);
	}
}

/** 渲染书摘分享卡为 Canvas 与 PNG Blob */
export async function renderQuoteShareCard(
	input: QuoteShareCardInput,
): Promise<QuoteShareCardResult> {
	const measureCanvas = document.createElement('canvas');
	const measureCtx = measureCanvas.getContext('2d');
	if (!measureCtx) throw new Error('无法生成分享图片');

	const height = measureCardHeight(measureCtx, input);

	const canvas = document.createElement('canvas');
	canvas.width = CARD_WIDTH * SCALE;
	canvas.height = height * SCALE;
	const ctx = canvas.getContext('2d');
	if (!ctx) throw new Error('无法生成分享图片');

	ctx.scale(SCALE, SCALE);
	drawCard(ctx, input, height);

	const blob = await new Promise<Blob>((resolve, reject) => {
		canvas.toBlob((result) => {
			if (result) resolve(result);
			else reject(new Error('无法生成分享图片'));
		}, 'image/png');
	});

	const dataUrl = canvas.toDataURL('image/png');
	return { canvas, dataUrl, blob };
}
