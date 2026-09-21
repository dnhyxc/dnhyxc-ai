import { createHash } from 'node:crypto';
import { SENTENCE_WORD_ANNOTATION_CACHE_VERSION } from './constant';

/** cache_key：version + 规范化句 + 分词序列；升 version 后旧行由服务启动后首次标注请求清理 */
export function buildSentenceWordAnnotationCacheKey(
	englishNorm: string,
	words: readonly string[],
): string {
	const payload = `${SENTENCE_WORD_ANNOTATION_CACHE_VERSION}\0${englishNorm}\0${words.join('\0')}`;
	return createHash('sha256').update(payload, 'utf8').digest('hex');
}

type AnnotationFields = {
	posZh?: string | null;
	ipa?: string | null;
	meaningZh?: string | null;
};

/**
 * 可入库 / 可计 hit：词数对齐，且每个词 posZh、ipa、meaningZh 非空。
 * 禁止把缺词垫空串当成「已标注」。
 */
export function isUsableSentenceWordAnnotations(
	annotations: readonly AnnotationFields[] | null | undefined,
	expectedWordCount: number,
): boolean {
	if (!Array.isArray(annotations) || annotations.length !== expectedWordCount) {
		return false;
	}
	if (expectedWordCount === 0) return false;
	return annotations.every(
		(a) =>
			typeof a?.posZh === 'string' &&
			a.posZh.trim() !== '' &&
			typeof a?.ipa === 'string' &&
			a.ipa.trim() !== '' &&
			typeof a?.meaningZh === 'string' &&
			a.meaningZh.trim() !== '',
	);
}
