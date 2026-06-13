import { randomUUID } from 'node:crypto';
import {
	AIMessage,
	HumanMessage,
	SystemMessage,
} from '@langchain/core/messages';
import { DynamicTool } from '@langchain/core/tools';
import { Inject, Injectable, type LoggerService } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
import { Observable } from 'rxjs';
import { KnowledgeQaEnum } from '../../enum/config.enum';
import { createLlm } from '../../utils/create-llm';
import { KnowledgeEmbeddingService } from '../knowledge-embedding/knowledge-embedding.service';
import { LlmConfigService } from '../llm-config/llm-config.service';

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
		private readonly llmConfigService: LlmConfigService,
		private readonly embedding: KnowledgeEmbeddingService,
		@Inject(WINSTON_MODULE_NEST_PROVIDER)
		private readonly logger: LoggerService,
	) {}

	private toLangChainMessages(
		messages: Array<{
			role: 'system' | 'user' | 'assistant';
			content: string;
		}>,
	): (SystemMessage | HumanMessage | AIMessage)[] {
		return messages.map((msg) => {
			if (msg.role === 'system') {
				return new SystemMessage(msg.content);
			}
			if (msg.role === 'assistant') {
				return new AIMessage(msg.content);
			}
			return new HumanMessage(msg.content);
		});
	}

	private async *streamChatCompletions(
		input: {
			messages: Array<{
				role: 'system' | 'user' | 'assistant';
				content: string;
			}>;
			temperature?: number;
			maxTokens?: number;
		},
		userId?: number,
		signal?: AbortSignal,
	): AsyncGenerator<string> {
		const llm = await createLlm(
			this.config,
			{
				preset: 'knowledgeQa',
				userId,
				temperature: input.temperature,
				maxTokens: input.maxTokens,
				defaultTemperature: 0.2,
				maxTokensPolicy: 'default',
				defaultMaxTokens: 4096,
				abortSignal: signal,
			},
			this.llmConfigService,
		);
		const stream = await llm.stream(this.toLangChainMessages(input.messages));

		for await (const chunk of stream) {
			const content = chunk.content;
			if (typeof content === 'string' && content) {
				yield content;
			}
		}
	}

	/**
	 * 向量召回 + rerank（askStream 与 Agent RAG 工具共用，避免重复实现）
	 */
	private async retrieveEvidencesWithRerank(params: {
		question: string;
		authorId: number;
		/** 与 askStream 一致：未传时使用 KNOWLEDGE_QA_TOPK，缺省为 10 */
		topK?: number;
		/** rerank 失败日志前缀，便于区分调用方 */
		rerankErrorLogTag: string;
	}): Promise<KnowledgeQaEvidence[]> {
		const topK =
			params.topK ??
			Number(this.config.get<string>(KnowledgeQaEnum.KNOWLEDGE_QA_TOPK) || 10);

		const hits = await this.embedding.searchKnowledgeChunksForAuthor({
			question: params.question,
			authorId: params.authorId,
			topK,
		});

		let evidences: KnowledgeQaEvidence[] = hits.map((h) => ({
			knowledgeId: h.payload.knowledgeId,
			title: h.payload.title,
			chunkIndex: h.payload.chunkIndex,
			score: h.score,
			text: h.payload.text,
		}));

		if (evidences.length > 1) {
			try {
				const docs = evidences.map(
					(e) => `标题：${e.title}\n分片：#${e.chunkIndex}\n内容：\n${e.text}`,
				);
				const reranked = await this.embedding.rerank({
					query: params.question,
					documents: docs,
					topN: Math.min(evidences.length, topK),
					authorId: params.authorId,
				});
				if (reranked.length > 0) {
					const used = new Set<number>();
					const next: KnowledgeQaEvidence[] = [];
					for (const r of reranked) {
						const ev = evidences[r.index];
						if (!ev) continue;
						used.add(r.index);
						next.push(ev);
					}
					for (let i = 0; i < evidences.length; i++) {
						if (!used.has(i)) next.push(evidences[i]!);
					}
					evidences = next;
				}
			} catch (e) {
				this.logger.error(
					`[${params.rerankErrorLogTag}]: Failed to rerank evidences: ${JSON.stringify(e)}`,
				);
			}
		}

		return evidences;
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

					const evidences = await this.retrieveEvidencesWithRerank({
						question: input.question,
						authorId: input.authorId,
						topK: input.topK,
						rerankErrorLogTag: 'askStream',
					});

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

					for await (const text of this.streamChatCompletions(
						{
							messages: [
								{ role: 'system', content: system },
								{ role: 'user', content: user },
							],
							temperature: 0.2,
							maxTokens: 4096,
						},
						input.authorId,
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

	/**
	 * 封装供 LangChain Agent 使用的知识库 RAG DynamicTool（固定绑定 authorId，与当前登录用户一致）。
	 */
	createAgentKnowledgeRagTool(authorId: number): DynamicTool {
		return new DynamicTool({
			name: 'knowledge_base_retrieval',
			description:
				'从当前用户已入库的知识库中做语义检索（向量 + 重排），返回相关文档分片。' +
				'适用于问题与用户自有笔记、文档、站内知识相关时；输入为一句简洁检索查询。' +
				'公网时效信息请改用互联网搜索工具。',
			func: async (input: string) => {
				const q =
					typeof input === 'string' ? input.trim() : String(input ?? '').trim();
				if (!q) {
					return '（查询为空：请传入检索句或关键词。）';
				}
				try {
					const evidences = await this.retrieveEvidencesWithRerank({
						question: q,
						authorId,
						rerankErrorLogTag: 'createAgentKnowledgeRagTool',
					});
					if (evidences.length === 0) {
						return '未在知识库中检索到相关分片。可尝试换关键词，或使用互联网搜索工具。';
					}
					return evidences
						.slice(0, 12)
						.map(
							(e, i) =>
								`[#${i + 1}] 标题：${e.title}\n知识条目ID：${e.knowledgeId}\n分片序号：${e.chunkIndex} | 相关度=${e.score.toFixed(4)}\n${e.text}`,
						)
						.join('\n\n---\n\n');
				} catch (err: unknown) {
					const msg =
						err instanceof Error ? err.message : String(err ?? '未知错误');
					return `知识库检索失败：${msg}`;
				}
			},
		});
	}
}
