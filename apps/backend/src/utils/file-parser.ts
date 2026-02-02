import http from 'node:http';
import https from 'node:https';
import { extname } from 'node:path';
import { InternalServerErrorException } from '@nestjs/common';

export const urlToBuffer = async (url: string) => {
	return new Promise((resolve, reject) => {
		const protocol = url.startsWith('https') ? https : http;

		protocol
			.get(url, (response) => {
				const chunks: any[] = [];

				response.on('data', (chunk) => {
					chunks.push(chunk);
				});

				response.on('end', () => {
					const buffer = Buffer.concat(chunks);
					resolve(buffer);
				});
			})
			.on('error', reject);
	});
};

const parsePdf = async (buffer: Buffer): Promise<string> => {
	try {
		// 动态导入 pdf-parse 库
		// @ts-expect-error
		const pdf = await import('pdf-parse');
		const data = await pdf.default(buffer);
		return data.text;
	} catch (error) {
		throw new InternalServerErrorException(
			`PDF 解析失败: ${error.message}. 请确保已安装 pdf-parse 库: npm install pdf-parse`,
		);
	}
};

const parseDocx = async (buffer: Buffer): Promise<string> => {
	try {
		// 动态导入 mammoth 库
		const mammoth = await import('mammoth');
		const result = await mammoth.extractRawText({ buffer });
		return result.value;
	} catch (error) {
		throw new InternalServerErrorException(
			`DOCX 解析失败: ${error.message}. 请确保已安装 mammoth 库: npm install mammoth`,
		);
	}
};

const parseExcel = async (buffer: Buffer): Promise<string> => {
	try {
		// 动态导入 xlsx 库
		// @ts-expect-error
		const xlsx = await import('xlsx');
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

		return text.trim();
	} catch (error) {
		throw new InternalServerErrorException(
			`Excel 解析失败: ${error.message}. 请确保已安装 xlsx 库: npm install xlsx`,
		);
	}
};

const parseText = async (buffer: Buffer): Promise<string> => {
	return buffer.toString('utf-8');
};

export const parseFile = async (
	filePath: string,
	mimeType?: string,
): Promise<string> => {
	const extension = mimeType || extname(filePath).toLowerCase();

	try {
		// const buffer = await readFile(filePath);
		const buffer = (await urlToBuffer(filePath)) as Buffer;

		switch (extension) {
			case '.pdf':
				return await parsePdf(buffer);
			case '.docx':
				return await parseDocx(buffer);
			case '.xlsx':
			case '.xls':
				return await parseExcel(buffer);
			case '.txt':
				return await parseText(buffer);
			default:
				throw new InternalServerErrorException(
					`不支持的文件格式: ${extension}. 支持的格式: .pdf, .docx, .xlsx, .xls, .txt`,
				);
		}
	} catch (error) {
		if (error instanceof InternalServerErrorException) {
			throw error;
		}
		throw new InternalServerErrorException(`文件解析失败: ${error.message}`);
	}
};
