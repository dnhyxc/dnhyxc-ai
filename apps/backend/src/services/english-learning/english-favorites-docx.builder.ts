/**
 * 将英语学习「单词 / 经典句」收藏列表打包为 Word（docx），供导出下载。
 */
import { Document, HeadingLevel, Packer, Paragraph, TextRun } from 'docx';

const FIELD_MAX = 12000;

function clip(s: string, max: number = FIELD_MAX): string {
	if (!s) return '';
	const t = s.trim();
	return t.length <= max ? t : `${t.slice(0, max)}…`;
}

/**
 * 导出 DOCX 时音标用斜线包裹（如 /ˈæpl/）。
 * 若原文已带前导或尾随 `/`，只补缺失的一侧，避免重复。
 */
function formatIpaForDocxExport(ipa: string): string {
	const t = ipa.trim();
	if (!t) return '';
	const hasLeading = t.startsWith('/');
	const hasTrailing = t.endsWith('/');
	if (hasLeading && hasTrailing) {
		return t;
	}
	if (hasLeading) {
		return `${t}/`;
	}
	if (hasTrailing) {
		return `/${t}`;
	}
	return `/${t}/`;
}

/** 单词收藏：标题 + 逐条（词、音标、释义、例句） */
export async function buildVocabularyFavoritesDocxBuffer(
	rows: ReadonlyArray<{
		word: string;
		ipa: string;
		pos: string;
		segmentation: string;
		translationZh: string;
		example: string;
	}>,
): Promise<Buffer> {
	const children: Paragraph[] = [
		new Paragraph({
			heading: HeadingLevel.HEADING_1,
			children: [new TextRun({ text: '英语单词收藏', bold: true })],
		}),
		new Paragraph({
			children: [
				new TextRun({ text: `共 ${rows.length} 条（按收藏时间倒序）` }),
			],
		}),
		new Paragraph({ text: '' }),
	];

	for (let i = 0; i < rows.length; i++) {
		const r = rows[i];
		children.push(
			new Paragraph({
				children: [
					new TextRun({ text: `${i + 1}. `, bold: true }),
					new TextRun({ text: clip(r.word, 500), bold: true }),
				],
			}),
		);
		if (r.ipa?.trim()) {
			children.push(
				new Paragraph({
					children: [
						new TextRun({ text: '音标：', bold: true }),
						new TextRun({
							text: clip(formatIpaForDocxExport(r.ipa), 500),
						}),
					],
				}),
			);
		}
		if (r.pos?.trim()) {
			children.push(
				new Paragraph({
					children: [
						new TextRun({ text: '词性：', bold: true }),
						new TextRun({ text: clip(r.pos, 64) }),
					],
				}),
			);
		}
		if (r.segmentation?.trim()) {
			children.push(
				new Paragraph({
					children: [
						new TextRun({ text: '音节划分：', bold: true }),
						new TextRun({ text: clip(r.segmentation, 500) }),
					],
				}),
			);
		}
		children.push(
			new Paragraph({
				children: [
					new TextRun({ text: '释义：', bold: true }),
					new TextRun({ text: clip(r.translationZh) }),
				],
			}),
		);
		children.push(
			new Paragraph({
				children: [
					new TextRun({ text: '例句：', bold: true }),
					new TextRun({ text: clip(r.example), italics: true }),
				],
			}),
		);
		children.push(new Paragraph({ text: '' }));
	}

	const doc = new Document({
		sections: [{ children }],
	});
	return Buffer.from(await Packer.toBuffer(doc));
}

/** 经典句收藏：标题 + 逐条（英文、译文、出处、赏析） */
export async function buildClassicQuoteFavoritesDocxBuffer(
	rows: ReadonlyArray<{
		english: string;
		translationZh: string;
		source: string;
		noteZh: string;
	}>,
): Promise<Buffer> {
	const children: Paragraph[] = [
		new Paragraph({
			heading: HeadingLevel.HEADING_1,
			children: [new TextRun({ text: '英语经典句收藏', bold: true })],
		}),
		new Paragraph({
			children: [
				new TextRun({ text: `共 ${rows.length} 条（按收藏时间倒序）` }),
			],
		}),
		new Paragraph({ text: '' }),
	];

	for (let i = 0; i < rows.length; i++) {
		const r = rows[i];
		children.push(
			new Paragraph({
				children: [
					new TextRun({ text: `${i + 1}. `, bold: true }),
					new TextRun({ text: clip(r.english), bold: true }),
				],
			}),
		);
		children.push(
			new Paragraph({
				children: [
					new TextRun({ text: '译文：', bold: true }),
					new TextRun({ text: clip(r.translationZh) }),
				],
			}),
		);
		children.push(
			new Paragraph({
				children: [
					new TextRun({ text: '出处：', bold: true }),
					new TextRun({ text: clip(r.source, 2000) }),
				],
			}),
		);
		children.push(
			new Paragraph({
				children: [
					new TextRun({ text: '赏析：', bold: true }),
					new TextRun({ text: clip(r.noteZh), italics: true }),
				],
			}),
		);
		children.push(new Paragraph({ text: '' }));
	}

	const doc = new Document({
		sections: [{ children }],
	});
	return Buffer.from(await Packer.toBuffer(doc));
}
