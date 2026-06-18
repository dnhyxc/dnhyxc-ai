import { readFile, stat } from 'node:fs/promises';
import http from 'node:http';
import https from 'node:https';
import { extname } from 'node:path';
import { InternalServerErrorException } from '@nestjs/common';
import mammoth from 'mammoth';
import pdfParse from 'pdf-parse';
import xlsx from 'xlsx';
import {
	normalizeUploadPublicPath,
	resolveUploadPublicPathToAbsolute,
} from './upload-paths';

/** 允许进入解析管道的最大字节（聊天附件，非电子书整文件下载） */
export const MAX_ATTACHMENT_BYTES = 15 * 1024 * 1024;

/** 解析后写入 prompt 的最大字符，防止 pdf 文本撑爆 V8 数组上限 */
export const MAX_ATTACHMENT_TEXT_CHARS = 300_000;

function assertWithinParseLimit(byteSize: number, label: string): void {
	if (byteSize > MAX_ATTACHMENT_BYTES) {
		const mb = Math.round(MAX_ATTACHMENT_BYTES / 1024 / 1024);
		throw new InternalServerErrorException(
			`${label} 超过解析大小上限（${mb}MB）`,
		);
	}
}

function capParsedText(text: string): string {
	if (text.length <= MAX_ATTACHMENT_TEXT_CHARS) return text;
	return `${text.slice(0, MAX_ATTACHMENT_TEXT_CHARS)}\n...[内容已截断]`;
}

export const urlToBuffer = async (
	url: string,
	maxBytes: number = MAX_ATTACHMENT_BYTES,
): Promise<Buffer> => {
	return new Promise((resolve, reject) => {
		const protocol = url.startsWith('https') ? https : http;

		protocol
			.get(url, (response) => {
				const contentLength = Number(response.headers['content-length']);
				if (Number.isFinite(contentLength) && contentLength > maxBytes) {
					response.resume();
					reject(new InternalServerErrorException('远程文件超过解析大小上限'));
					return;
				}

				const chunks: Buffer[] = [];
				let total = 0;

				response.on('data', (chunk: Buffer) => {
					total += chunk.length;
					if (total > maxBytes) {
						response.destroy();
						reject(
							new InternalServerErrorException('远程文件超过解析大小上限'),
						);
						return;
					}
					chunks.push(chunk);
				});

				response.on('end', () => {
					resolve(Buffer.concat(chunks));
				});
			})
			.on('error', reject);
	});
};

/** 相对 /images|/files 走读盘；http(s) 走网络拉取 */
export const resolveAttachmentBuffer = async (
	pathOrUrl: string,
): Promise<Buffer> => {
	const trimmed = pathOrUrl?.trim();
	if (!trimmed) {
		throw new InternalServerErrorException('附件路径为空');
	}

	if (/^https?:\/\//i.test(trimmed)) {
		return urlToBuffer(trimmed);
	}

	const normalized = normalizeUploadPublicPath(trimmed);
	if (normalized.startsWith('/images/') || normalized.startsWith('/files/')) {
		const absolutePath = resolveUploadPublicPathToAbsolute(trimmed);
		const fileStat = await stat(absolutePath);
		assertWithinParseLimit(fileStat.size, '附件');
		return readFile(absolutePath);
	}

	throw new InternalServerErrorException(`无效的附件路径: ${pathOrUrl}`);
};

// pdf-parse 1.x 为函数式 API：pdfParse(buffer)；2.x 才有 PDFParse 类。
const parsePdf = async (
	buffer: Buffer,
	_filePath?: string,
): Promise<string> => {
	try {
		const result = await pdfParse(buffer);
		return capParsedText(result.text ?? '');
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		throw new InternalServerErrorException(
			`PDF 解析失败: ${message}. 请确保已安装 pdf-parse 库: npm install pdf-parse`,
		);
	}
};

const parseDocx = async (buffer: Buffer): Promise<string> => {
	try {
		const result = await mammoth.extractRawText({ buffer });
		return capParsedText(result.value);
	} catch (error) {
		throw new InternalServerErrorException(
			`DOCX 解析失败: ${error.message}. 请确保已安装 mammoth 库: npm install mammoth`,
		);
	}
};

const parseExcel = async (buffer: Buffer): Promise<string> => {
	try {
		const workbook = xlsx.read(buffer, { type: 'buffer' });
		let text = '';

		workbook.SheetNames.forEach((sheetName: string) => {
			const worksheet = workbook.Sheets[sheetName];
			const sheetText = xlsx.utils.sheet_to_csv(worksheet, {
				FS: '\t',
				RS: '\n',
				blankrows: false,
			});
			text += `工作表: ${sheetName}\n${sheetText}\n\n`;
		});

		return capParsedText(text.trim());
	} catch (error) {
		throw new InternalServerErrorException(
			`Excel 解析失败: ${error.message}. 请确保已安装 xlsx 库: npm install xlsx`,
		);
	}
};

const parseText = async (buffer: Buffer): Promise<string> => {
	return capParsedText(buffer.toString('utf-8'));
};

const parseMarkdown = async (buffer: Buffer): Promise<string> => {
	return await parseText(buffer);
};

export const parseFile = async (
	filePath: string,
	mimeType?: string,
): Promise<string> => {
	const extension = mimeType || extname(filePath).toLowerCase();

	try {
		const buffer = await resolveAttachmentBuffer(filePath);

		switch (extension) {
			case '.pdf':
				return await parsePdf(buffer, filePath);
			case '.docx':
				return await parseDocx(buffer);
			case '.xlsx':
			case '.xls':
				return await parseExcel(buffer);
			case '.txt':
				return await parseText(buffer);
			case '.md':
				return await parseMarkdown(buffer);
			default:
				throw new InternalServerErrorException(
					`不支持的文件格式: ${extension}. 支持的格式: .pdf, .docx, .xlsx, .xls, .txt, .md`,
				);
		}
	} catch (error) {
		if (error instanceof InternalServerErrorException) {
			throw error;
		}
		throw new InternalServerErrorException(`文件解析失败: ${error.message}`);
	}
};
