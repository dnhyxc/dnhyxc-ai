import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Observable } from 'rxjs';
import { KnowledgeQaEnum, ModelEnum } from '../../enum/config.enum';
import { KnowledgeEmbeddingService } from '../knowledge-embedding/knowledge-embedding.service';
import { QdrantService } from '../qdrant/qdrant.service';

export type KnowledgeQaEvidence = {
	knowledgeId: string;
	title: string;
	chunkIndex: number;
	score: number;
	text: string;
};

type QaEvent =
	| { type: 'qa.start'; runId: string }
	| { type: 'qa.retrieval'; evidences: KnowledgeQaEvidence[] }
	| { type: 'qa.delta'; content: string }
	| { type: 'qa.done'; evidences: KnowledgeQaEvidence[] }
	| { type: 'qa.error'; message: string };

@Injectable()
export class KnowledgeQaService {
	constructor(
		private readonly config: ConfigService,
		private readonly embedding: KnowledgeEmbeddingService,
		private readonly qdrant: QdrantService,
	) {}

	private getGlmModelName(): string {
		return (
			this.config.get<string>(KnowledgeQaEnum.KNOWLEDGE_QA_MODEL) ||
			this.config.get<string>(ModelEnum.ASSISTANT_GLM_MODEL_NAME) ||
			this.config.get<string>(ModelEnum.ZHIPU_MODEL_NAME) ||
			'glm-4.7'
		);
	}

	private parseGlmStreamDelta(dataStr: string): string | null {
		if (dataStr.trim() === '[DONE]') return null;
		try {
			const data = JSON.parse(dataStr);
			if (data.choices?.[0]?.delta?.content) {
				return String(data.choices[0].delta.content);
			}
			if (data.choices?.[0]?.message?.content) {
				return String(data.choices[0].message.content);
			}
			return null;
		} catch {
			return null;
		}
	}

	private async *streamGlmChatCompletions(
		input: {
			messages: Array<{
				role: 'system' | 'user' | 'assistant';
				content: string;
			}>;
			temperature?: number;
			maxTokens?: number;
		},
		signal?: AbortSignal,
	): AsyncGenerator<string> {
		// 对齐 AssistantService：智谱（GLM）走原生 /chat/completions SSE 流
		const apiKey = this.config.get<string>(ModelEnum.ZHIPU_API_KEY) || '';
		const baseURL =
			this.config.get<string>(ModelEnum.ZHIPU_BASE_URL) ||
			'https://open.bigmodel.cn/api/paas/v4';
		if (!apiKey) {
			throw new Error('智谱 API 密钥未配置（ZHIPU_API_KEY）');
		}
		const modelName = this.getGlmModelName();
		const url = `${baseURL.replace(/\/$/, '')}/chat/completions`;

		const response = await fetch(url, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Bearer ${apiKey}`,
			},
			body: JSON.stringify({
				model: modelName,
				messages: input.messages,
				thinking: { type: 'disabled' },
				stream: true,
				max_tokens: input.maxTokens ?? 4096,
				temperature: input.temperature ?? 0.2,
			}),
			...(signal ? { signal } : {}),
		});
		if (!response.ok) {
			const errText = await response.text();
			throw new Error(`智谱 API 请求失败：${response.status} ${errText}`);
		}
		const reader = response.body?.getReader();
		if (!reader) throw new Error('无法读取响应流');

		const decoder = new TextDecoder('utf-8');
		let buffer = '';
		try {
			while (true) {
				const { done, value } = await reader.read();
				if (done) break;
				buffer += decoder.decode(value, { stream: true });
				const lines = buffer.split('\n');
				buffer = lines.pop() || '';
				for (const line of lines) {
					const trimmed = line.trim();
					if (!trimmed || !trimmed.startsWith('data:')) continue;
					const dataStr = trimmed.slice(5).trim();
					const delta = this.parseGlmStreamDelta(dataStr);
					if (delta) yield delta;
				}
			}

			if (buffer.trim().startsWith('data:')) {
				const dataStr = buffer.trim().slice(5).trim();
				const delta = this.parseGlmStreamDelta(dataStr);
				if (delta) yield delta;
			}
		} finally {
			reader.releaseLock();
		}
	}

	async askStream(input: {
		question: string;
		authorId: number;
		topK?: number;
		includeEvidences?: boolean;
	}): Promise<Observable<QaEvent>> {
		return new Observable<QaEvent>((subscriber) => {
			const runId = randomUUID();
			const abortController = new AbortController();

			(async () => {
				try {
					subscriber.next({ type: 'qa.start', runId });
					const topK =
						input.topK ??
						Number(
							this.config.get<string>(KnowledgeQaEnum.KNOWLEDGE_QA_TOPK) || 6,
						);

					const qvec = await this.embedding.embedQuery(input.question);

					const hits = await this.qdrant.searchKnowledgeChunks({
						vector: qvec,
						topK,
						authorId: input.authorId,
					});

					const evidences: KnowledgeQaEvidence[] = hits.map((h) => ({
						knowledgeId: h.payload.knowledgeId,
						title: h.payload.title,
						chunkIndex: h.payload.chunkIndex,
						score: h.score,
						text: h.payload.text,
					}));

					if (input.includeEvidences !== false) {
						subscriber.next({ type: 'qa.retrieval', evidences });
					}

					if (evidences.length === 0) {
						subscriber.next({
							type: 'qa.delta',
							content:
								'我在你的知识库中没有检索到与问题直接相关的内容。你可以尝试补充关键词，或先把相关资料保存到知识库后再问我。',
						});
						subscriber.next({ type: 'qa.done', evidences: [] });
						subscriber.complete();
						return;
					}

					const context = evidences
						.slice(0, Math.min(12, evidences.length))
						.map(
							(e) =>
								`[${e.title}#${e.chunkIndex} | score=${e.score.toFixed(4)}]\n${e.text}`,
						)
						.join('\n\n---\n\n');

					const system = [
						'你是一个企业级知识库检索问答助手。',
						'你必须只基于“已检索到的知识库片段”回答问题；不要编造不存在的事实。',
						'若片段不足以支撑结论，请明确说明“不确定/未找到”，并给出建议的补充信息。',
						'回答使用简体中文；保留英文技术术语，首次出现括号注明中文。',
					].join('\n');
					const user = `问题：${input.question}\n\n已检索到的知识库片段：\n\n${context}`;

					for await (const text of this.streamGlmChatCompletions(
						{
							messages: [
								{ role: 'system', content: system },
								{ role: 'user', content: user },
							],
							temperature: 0.2,
							maxTokens: 4096,
						},
						abortController.signal,
					)) {
						if (text) subscriber.next({ type: 'qa.delta', content: text });
					}

					subscriber.next({ type: 'qa.done', evidences });
					subscriber.complete();
				} catch (err) {
					subscriber.next({
						type: 'qa.error',
						message: err instanceof Error ? err.message : String(err),
					});
					subscriber.complete();
				}
			})().catch((e) => subscriber.error(e));

			return () => {
				abortController.abort();
			};
		});
	}
}
