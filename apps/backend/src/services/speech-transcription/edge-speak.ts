/**
 * Edge 朗读走 speech.platform.bing.com + Sec-MS-GEC v2。
 * api.msedgeservices.com 在机房出口回 HTTP 200，WebSocket 升不了级。
 */

import { randomBytes, randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import {
	EDGE_SEC_MS_GEC_VERSION,
	EDGE_WSS_URL,
	secMsGecV2,
} from './edge-sec-ms-gec';

const nodeRequire = createRequire(__filename);
const WebSocket = createRequire(nodeRequire.resolve('@andresaya/edge-tts'))(
	'ws',
) as new (
	url: string,
	options: {
		headers: Record<string, string>;
		perMessageDeflate: boolean;
		handshakeTimeout: number;
	},
) => {
	on(event: 'open', cb: () => void): void;
	on(
		event: 'message',
		cb: (data: Buffer | string, isBinary: boolean) => void,
	): void;
	on(event: 'error', cb: (err: Error) => void): void;
	on(event: 'close', cb: () => void): void;
	send(data: string): void;
	close(): void;
	terminate(): void;
};

const UA =
	'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36 Edg/143.0.0.0';

export type EdgeSpeakInput = {
	text: string;
	voice: string;
	rate: string;
	volume: string;
	pitch: string;
};

export type EdgeSpeakWord = { text: string; offset: number; duration: number };

function edgeTimestamp(): string {
	const d = new Date();
	const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
	const months = [
		'Jan',
		'Feb',
		'Mar',
		'Apr',
		'May',
		'Jun',
		'Jul',
		'Aug',
		'Sep',
		'Oct',
		'Nov',
		'Dec',
	];
	const p = (n: number) => String(n).padStart(2, '0');
	return `${days[d.getUTCDay()]} ${months[d.getUTCMonth()]} ${p(d.getUTCDate())} ${d.getUTCFullYear()} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())} GMT+0000 (Coordinated Universal Time)`;
}

function escapeXml(text: string): string {
	return text
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&apos;');
}

function headerPath(head: string): string {
	return /Path:([^\r\n]*)/i.exec(head)?.[1]?.trim() ?? '';
}

function parseTextFrame(text: string): { path: string; body: string } {
	const split = text.indexOf('\r\n\r\n');
	if (split === -1) return { path: headerPath(text), body: '' };
	return {
		path: headerPath(text.slice(0, split)),
		body: text.slice(split + 4),
	};
}

function parseBinaryFrame(data: Buffer): { path: string; body: Buffer } {
	if (data.length < 2) return { path: '', body: Buffer.alloc(0) };
	const headerLength = (data[0] << 8) | data[1];
	return {
		path: headerPath(data.subarray(2, 2 + headerLength).toString('utf8')),
		body: data.subarray(2 + headerLength),
	};
}

export function speakEdge(
	input: EdgeSpeakInput,
	timeoutMs: number,
): Promise<{ audio: Buffer; words: EdgeSpeakWord[] }> {
	const id = randomUUID().replace(/-/g, '');
	const url =
		`${EDGE_WSS_URL}&ConnectionId=${id}` +
		`&Sec-MS-GEC=${secMsGecV2()}` +
		`&Sec-MS-GEC-Version=${EDGE_SEC_MS_GEC_VERSION}`;
	const ws = new WebSocket(url, {
		perMessageDeflate: true,
		handshakeTimeout: timeoutMs,
		headers: {
			Pragma: 'no-cache',
			'Cache-Control': 'no-cache',
			Origin: 'chrome-extension://jdiccldimpdaibmpdkjnbmckianbfold',
			'User-Agent': UA,
			'Accept-Encoding': 'gzip, deflate, br, zstd',
			'Accept-Language': 'en-US,en;q=0.9',
			Cookie: `muid=${randomBytes(16).toString('hex').toUpperCase()};`,
		},
	});
	const chunks: Buffer[] = [];
	const words: EdgeSpeakWord[] = [];
	return new Promise((resolve, reject) => {
		let settled = false;
		let timerId: ReturnType<typeof setTimeout>;
		const bump = () => {
			clearTimeout(timerId);
			timerId = setTimeout(
				() => finish(new Error('WebSocket inactivity timeout')),
				timeoutMs,
			);
		};
		const finish = (err?: Error, audio?: Buffer) => {
			if (settled) return;
			settled = true;
			clearTimeout(timerId);
			if (err) {
				ws.terminate();
				reject(err);
				return;
			}
			ws.close();
			resolve({ audio: audio ?? Buffer.alloc(0), words });
		};
		bump();
		ws.on('open', () => {
			bump();
			const ts = edgeTimestamp();
			ws.send(
				`X-Timestamp:${ts}\r\nContent-Type:application/json; charset=utf-8\r\nPath:speech.config\r\n\r\n` +
					`{"context":{"synthesis":{"audio":{"metadataoptions":{"sentenceBoundaryEnabled":"false","wordBoundaryEnabled":"true"},"outputFormat":"audio-24khz-48kbitrate-mono-mp3"}}}}\r\n`,
			);
			const ssml =
				`<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='en-US'>` +
				`<voice name='${input.voice}'>` +
				`<prosody pitch='${input.pitch}' rate='${input.rate}' volume='${input.volume}'>` +
				`${escapeXml(input.text)}</prosody></voice></speak>`;
			ws.send(
				`X-RequestId:${randomUUID().replace(/-/g, '')}\r\nContent-Type:application/ssml+xml\r\nX-Timestamp:${ts}Z\r\nPath:ssml\r\n\r\n${ssml}`,
			);
		});
		ws.on('message', (data, isBinary) => {
			bump();
			if (!isBinary) {
				const frame = parseTextFrame(
					typeof data === 'string' ? data : data.toString('utf8'),
				);
				if (frame.path === 'audio.metadata') {
					try {
						const metadata = JSON.parse(frame.body) as {
							Metadata?: Array<{
								Type?: string;
								Data?: {
									Offset?: number;
									Duration?: number;
									text?: { Text?: string };
								};
							}>;
						};
						for (const item of metadata.Metadata ?? []) {
							if (item.Type !== 'WordBoundary') continue;
							words.push({
								text: item.Data?.text?.Text ?? '',
								offset: item.Data?.Offset ?? 0,
								duration: item.Data?.Duration ?? 0,
							});
						}
					} catch {
						/* 元数据坏了不影响出声 */
					}
				} else if (frame.path === 'turn.end') {
					const audio = Buffer.concat(chunks);
					finish(audio.length ? undefined : new Error('未收到音频数据'), audio);
				}
				return;
			}
			const frame = parseBinaryFrame(
				Buffer.isBuffer(data) ? data : Buffer.from(data),
			);
			if (frame.path === 'audio' && frame.body.length) chunks.push(frame.body);
		});
		ws.on('error', (err) => finish(err));
		ws.on('close', () => {
			if (settled) return;
			const audio = Buffer.concat(chunks);
			finish(audio.length ? undefined : new Error('未收到音频数据'), audio);
		});
	});
}
