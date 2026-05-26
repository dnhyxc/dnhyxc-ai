import {
	createCipheriv,
	createDecipheriv,
	randomBytes,
	scryptSync,
} from 'node:crypto';

const ALGO = 'aes-256-gcm';
const IV_LEN = 12;
const TAG_LEN = 16;
const SCRYPT_SALT = 'llm-runtime-config-v1';

function deriveKey(secret: string): Buffer {
	return scryptSync(secret.trim() || 'fallback-insecure', SCRYPT_SALT, 32);
}

/** 将 apiKey 加密为 base64 载荷（iv + tag + ciphertext） */
export function encryptApiKey(plain: string, secret: string): string {
	const key = deriveKey(secret);
	const iv = randomBytes(IV_LEN);
	const cipher = createCipheriv(ALGO, key, iv);
	const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
	const tag = cipher.getAuthTag();
	return Buffer.concat([iv, tag, enc]).toString('base64');
}

export function decryptApiKey(payload: string, secret: string): string {
	const buf = Buffer.from(payload, 'base64');
	if (buf.length < IV_LEN + TAG_LEN + 1) {
		throw new Error('无效的 apiKey 密文');
	}
	const iv = buf.subarray(0, IV_LEN);
	const tag = buf.subarray(IV_LEN, IV_LEN + TAG_LEN);
	const data = buf.subarray(IV_LEN + TAG_LEN);
	const key = deriveKey(secret);
	const decipher = createDecipheriv(ALGO, key, iv);
	decipher.setAuthTag(tag);
	return Buffer.concat([decipher.update(data), decipher.final()]).toString(
		'utf8',
	);
}

/** 列表/GET 展示用，不暴露完整密钥 */
export function maskApiKey(key: string): string {
	const t = key.trim();
	if (t.length <= 8) return '****';
	return `${t.slice(0, 4)}…${t.slice(-4)}`;
}
