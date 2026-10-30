import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import type { ConfigService } from '@nestjs/config';
import {
	type CreateLlmOptions,
	createLlm,
	DECIDE_MODEL_NAME,
} from './create-llm';

export { DECIDE_MODEL_NAME };

/** 只放硅基认识的字段。不带智谱 thinking，避免不认识的字段让整批 400。 */
export const DECIDE_JSON_KWARGS = {
	enable_thinking: false,
	response_format: { type: 'json_object' as const },
};

const DECIDE_TIMEOUT_MS = 2000;
const DECIDE_MAX_TOKENS = 400;

export type DecideInput<T> = {
	/** 这一次要决定什么。由调用方写，这里不放业务规则。 */
	task: string;
	/** 模型只能看到的原文，不附历史。 */
	input: string;
	/** 形状不对返回 null。 */
	parse: (raw: unknown) => T | null;
	/** 业务闸门。不传则形状通过即可。 */
	accept?: (value: T, input: string) => T | null;
	/** 测试注入。生产不传，走 createLlm。 */
	complete?: (task: string, input: string) => Promise<string>;
	/** 测试缩短等待。生产默认 2 秒。 */
	timeoutMs?: number;
};

/** createLlm 入参。检查用它确认没有把模型交给会员档。maxTokens 缺省 400，分类传入 65536。 */
export function decideLlmOptions(
	signal: AbortSignal,
	maxTokens: number = DECIDE_MAX_TOKENS,
): CreateLlmOptions {
	return {
		preset: 'decide',
		modelName: DECIDE_MODEL_NAME,
		streaming: false,
		temperature: 0,
		defaultTemperature: 0,
		maxTokens,
		modelKwargs: DECIDE_JSON_KWARGS,
		abortSignal: signal,
	};
}

function withTimeout<T>(work: Promise<T>, ms: number): Promise<T> {
	return new Promise((resolve, reject) => {
		const timer = setTimeout(() => reject(new Error('decide timeout')), ms);
		work.then(
			(value) => {
				clearTimeout(timer);
				resolve(value);
			},
			(error) => {
				clearTimeout(timer);
				reject(error);
			},
		);
	});
}

function textOf(content: unknown): string {
	return typeof content === 'string' ? content : '';
}

async function completeWithLlm(
	config: ConfigService,
	task: string,
	input: string,
	timeoutMs: number,
): Promise<string> {
	const signal = AbortSignal.timeout(timeoutMs);
	const llm = await createLlm(config, decideLlmOptions(signal));
	const message = await llm.invoke(
		[new SystemMessage(task), new HumanMessage(input)],
		{ signal },
	);
	return textOf(message.content);
}

/**
 * 一次短决策。超时、缺密钥、非 JSON、parse 或 accept 失败都返回 null，不重试。
 * 不传 userId，也不传用户凭证 resolver。
 */
export async function decide<T>(
	config: ConfigService,
	input: DecideInput<T>,
): Promise<T | null> {
	const timeoutMs = input.timeoutMs ?? DECIDE_TIMEOUT_MS;
	try {
		const text = await withTimeout(
			input.complete
				? input.complete(input.task, input.input)
				: completeWithLlm(config, input.task, input.input, timeoutMs),
			timeoutMs,
		);
		if (!text.trim()) return null;
		let raw: unknown;
		try {
			raw = JSON.parse(text);
		} catch {
			return null;
		}
		const parsed = input.parse(raw);
		if (parsed == null) return null;
		if (!input.accept) return parsed;
		const accepted = input.accept(parsed, input.input);
		return accepted == null ? null : accepted;
	} catch {
		return null;
	}
}
