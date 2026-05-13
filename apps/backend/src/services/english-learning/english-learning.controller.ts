import { randomUUID } from 'node:crypto';
import {
	Body,
	ClassSerializerInterceptor,
	Controller,
	Get,
	Header,
	HttpException,
	Param,
	Post,
	Query,
	Req,
	Sse,
	UnauthorizedException,
	UseGuards,
	UseInterceptors,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { Observable } from 'rxjs';
import { JwtGuard } from 'src/guards/jwt.guard';
import { CancelEnglishLearningStreamDto } from './dto/cancel-english-learning-stream.dto';
import {
	ClassicQuoteFavoriteBodyDto,
	ClassicQuoteFavoriteRemoveDto,
	ClassicQuoteFavoriteStatusDto,
} from './dto/classic-quote-favorite.dto';
import {
	GenerateClassicQuotesDto,
	GenerateVocabularyDto,
	resolveClassicQuotesPackTargetCount,
	resolveVocabularyPackTargetCount,
} from './dto/generate-vocabulary.dto';
import {
	VocabularyFavoriteBodyDto,
	VocabularyFavoriteRemoveDto,
	VocabularyFavoriteStatusDto,
} from './dto/vocabulary-favorite.dto';
import {
	type EnglishLearningPackAgentToolEvent,
	EnglishLearningService,
} from './english-learning.service';
import { EnglishLearningStreamAbortRegistry } from './english-learning-stream-abort.registry';

type AuthedRequest = Request & { user?: { userId: number } };

/**
 * SSE 客户端断开或显式 cancel 时中止生成：多路监听，避免仅 `req.close` 不触发。
 */
function wireEnglishLearningSseAbort(
	req: Request,
	streamAbort: AbortController,
): () => void {
	const onDisconnect = () => {
		streamAbort.abort();
	};
	if (req.aborted) {
		queueMicrotask(onDisconnect);
	}
	req.once('close', onDisconnect);
	req.once('aborted', onDisconnect);
	req.once('error', onDisconnect);
	const socket = req.socket;
	if (socket) {
		socket.once('close', onDisconnect);
	}
	const res = (req as Request & { res?: Response }).res;
	if (res) {
		res.once('close', onDisconnect);
	}
	return () => {
		req.removeListener('close', onDisconnect);
		req.removeListener('aborted', onDisconnect);
		req.removeListener('error', onDisconnect);
		socket?.removeListener('close', onDisconnect);
		res?.removeListener('close', onDisconnect);
		streamAbort.abort();
	};
}

function vocabularyHttpMessage(e: HttpException): string {
	const res = e.getResponse();
	if (typeof res === 'string' && res.trim()) return res;
	if (res && typeof res === 'object' && 'message' in res) {
		const m = (res as { message?: unknown }).message;
		if (typeof m === 'string' && m.trim()) return m;
		if (Array.isArray(m)) return m.map(String).join('；');
	}
	return e.message || '生成单词资料失败，请稍后重试';
}

/** 组装 `*.agent_tool` SSE 载荷；`organic` 仅在主检索联网完成后附带 */
function packAgentToolSsePayload(
	prefix: 'vocab' | 'classic',
	streamId: string,
	ev: EnglishLearningPackAgentToolEvent,
): Record<string, unknown> {
	const qFromSearch =
		typeof ev.searchQuery === 'string' && ev.searchQuery.trim()
			? ev.searchQuery.trim().slice(0, 240)
			: undefined;
	const data: Record<string, unknown> = {
		type: `${prefix}.agent_tool`,
		streamId,
		phase: ev.phase,
		name: typeof ev.name === 'string' ? ev.name : '',
		query: qFromSearch ?? englishPackToolInputPreview(ev.input),
	};
	if (
		ev.phase === 'organic' &&
		Array.isArray(ev.searchOrganic) &&
		ev.searchOrganic.length > 0
	) {
		data.organic = ev.searchOrganic;
	}
	return data;
}

/** 工具入参摘要，供前端展示检索关键词（控制长度避免 SSE 过大） */
function englishPackToolInputPreview(input: unknown): string | undefined {
	if (input == null) return undefined;
	if (typeof input === 'string') return input.trim().slice(0, 240);
	try {
		return JSON.stringify(input).slice(0, 240);
	} catch {
		return undefined;
	}
}

function classicQuoteHttpMessage(e: HttpException): string {
	const res = e.getResponse();
	if (typeof res === 'string' && res.trim()) return res;
	if (res && typeof res === 'object' && 'message' in res) {
		const m = (res as { message?: unknown }).message;
		if (typeof m === 'string' && m.trim()) return m;
		if (Array.isArray(m)) return m.map(String).join('；');
	}
	return e.message || '生成经典语句失败，请稍后重试';
}

/**
 * 英语学习辅助接口（结构化单词资料等）
 */
@Controller('english-learning')
@UseInterceptors(ClassSerializerInterceptor)
@UseGuards(JwtGuard)
export class EnglishLearningController {
	constructor(
		private readonly englishLearningService: EnglishLearningService,
		private readonly streamAbortRegistry: EnglishLearningStreamAbortRegistry,
	) {}

	/**
	 * 显式取消正在进行的单词包 / 经典句流式生成（不依赖 TCP 断开是否及时上报）。
	 * 与 SSE 首帧 `*.progress` 中的 `streamId` 一致；若任务已结束则 `cancelled` 为 false。
	 */
	@Post('stream/cancel')
	async cancelActiveStream(
		@Req() req: AuthedRequest,
		@Body() dto: CancelEnglishLearningStreamDto,
	) {
		const userId = req.user?.userId;
		if (userId == null) {
			throw new UnauthorizedException('未授权');
		}
		const cancelled = this.streamAbortRegistry.cancelByStreamId(
			userId,
			dto.streamId,
		);
		return { success: true, cancelled };
	}

	/**
	 * 按主题拉取单词学习资料（含 IPA、中文释义、例句）；读音由前端调用 TTS 播放 word。
	 */
	/**
	 * 分页获取当前用户历史拉取的单词包会话列表（按最近活动时间倒序）。
	 */
	@Get('vocabulary-history')
	async listVocabularyHistory(
		@Req() req: AuthedRequest,
		@Query('limit') limitStr?: string,
		@Query('offset') offsetStr?: string,
	) {
		const userId = req.user?.userId;
		if (userId == null) {
			throw new UnauthorizedException('未授权');
		}
		const limit = Math.min(
			100,
			Math.max(1, Number.parseInt(limitStr ?? '20', 10) || 20),
		);
		const offset = Math.max(0, Number.parseInt(offsetStr ?? '0', 10) || 0);
		const list = await this.englishLearningService.listVocabularyHistory(
			userId,
			{ limit, offset },
		);
		return { success: true, data: list };
	}

	/**
	 * 获取某次拉取会话的完整单词列表（验权：仅本人 streamId）。
	 */
	@Get('vocabulary-history/:streamId')
	async getVocabularyHistoryDetail(
		@Req() req: AuthedRequest,
		@Param('streamId') streamId: string,
	) {
		const userId = req.user?.userId;
		if (userId == null) {
			throw new UnauthorizedException('未授权');
		}
		const detail = await this.englishLearningService.getVocabularyHistoryDetail(
			userId,
			streamId,
		);
		return { success: true, data: detail };
	}

	/** 收藏当前单词（同一词形不重复落库） */
	@Post('vocabulary-favorites')
	async addVocabularyFavorite(
		@Req() req: AuthedRequest,
		@Body() dto: VocabularyFavoriteBodyDto,
	) {
		const userId = req.user?.userId;
		if (userId == null) {
			throw new UnauthorizedException('未授权');
		}
		const data = await this.englishLearningService.addVocabularyFavorite(
			userId,
			dto,
		);
		return { success: true, data };
	}

	/** 取消收藏 */
	@Post('vocabulary-favorites/remove')
	async removeVocabularyFavorite(
		@Req() req: AuthedRequest,
		@Body() dto: VocabularyFavoriteRemoveDto,
	) {
		const userId = req.user?.userId;
		if (userId == null) {
			throw new UnauthorizedException('未授权');
		}
		const data = await this.englishLearningService.removeVocabularyFavorite(
			userId,
			dto.word,
		);
		return { success: true, data };
	}

	/** 批量查询列表中已收藏的规范化词形 */
	@Post('vocabulary-favorites/status')
	async vocabularyFavoritesStatus(
		@Req() req: AuthedRequest,
		@Body() dto: VocabularyFavoriteStatusDto,
	) {
		const userId = req.user?.userId;
		if (userId == null) {
			throw new UnauthorizedException('未授权');
		}
		const favoritedWordKeys =
			await this.englishLearningService.listVocabularyFavoriteKeysForWords(
				userId,
				dto.words,
			);
		return { success: true, data: { favoritedWordKeys } };
	}

	@Post('vocabulary-pack')
	async vocabularyPack(
		@Req() req: AuthedRequest,
		@Body() dto: GenerateVocabularyDto,
	) {
		const userId = req.user?.userId;
		if (userId == null) {
			throw new UnauthorizedException('未授权');
		}
		const itemsPayload =
			await this.englishLearningService.generateVocabularyPack(dto, { userId });
		return { success: true, data: itemsPayload };
	}

	/**
	 * 同上，但以 SSE 推送进度、每轮新词条（`vocab.chunk`）并最终下发完整 items。
	 * 事件：`vocab.progress`（可选）→ `vocab.chunk`（每轮有新词时）→ `vocab.complete` | `vocab.error`
	 */
	@Post('vocabulary-pack/stream')
	@Sse()
	@Header('X-Accel-Buffering', 'no')
	@Header('Cache-Control', 'no-cache, no-transform')
	vocabularyPackStream(
		@Req() req: AuthedRequest,
		@Body() dto: GenerateVocabularyDto,
	): Observable<{ data: Record<string, unknown> }> {
		const userId = req.user?.userId;
		if (userId == null) {
			throw new UnauthorizedException('未授权');
		}
		const target = resolveVocabularyPackTargetCount(dto.count);
		const streamId = randomUUID();
		return new Observable((subscriber) => {
			const streamAbort = new AbortController();
			this.streamAbortRegistry.register(userId, streamId, streamAbort);
			const detachSseAbort = wireEnglishLearningSseAbort(req, streamAbort);
			const emit = (data: Record<string, unknown>) => {
				try {
					subscriber.next({ data });
				} catch {
					streamAbort.abort();
				}
			};
			emit({
				type: 'vocab.progress',
				streamId,
				collected: 0,
				target,
				round: 0,
			});
			void (async () => {
				try {
					const items =
						await this.englishLearningService.runVocabularyGeneration(
							dto,
							async (p) => {
								emit({
									type: 'vocab.progress',
									streamId,
									collected: p.collected,
									target: p.target,
									round: p.round,
								});
								if (p.newItems?.length) {
									await this.englishLearningService.saveVocabularyPackBatch({
										userId,
										streamId,
										round: p.round,
										topic: dto.topic,
										targetCount: target,
										items: p.newItems,
									});
									emit({
										type: 'vocab.chunk',
										streamId,
										round: p.round,
										collected: p.collected,
										target: p.target,
										items: p.newItems,
									});
								}
							},
							{
								userId,
								signal: streamAbort.signal,
								onAgentTool: async (ev) => {
									emit(packAgentToolSsePayload('vocab', streamId, ev));
									if (
										ev.phase === 'organic' &&
										Array.isArray(ev.searchOrganic) &&
										ev.searchOrganic.length > 0
									) {
										await this.englishLearningService.appendPackWebSearchRound({
											userId,
											streamId,
											packKind: 'vocabulary',
											query:
												typeof ev.searchQuery === 'string'
													? ev.searchQuery
													: undefined,
											organic: ev.searchOrganic,
										});
									}
								},
							},
						);
					emit({
						type: 'vocab.complete',
						success: true,
						streamId,
						items,
						requested: target,
					});
				} catch (e: unknown) {
					const message =
						e instanceof HttpException
							? vocabularyHttpMessage(e)
							: '生成单词资料失败，请稍后重试';
					emit({
						type: 'vocab.error',
						success: false,
						message,
					});
				} finally {
					this.streamAbortRegistry.unregister(streamId);
					detachSseAbort();
					subscriber.complete();
				}
			})();
			return () => {
				detachSseAbort();
				this.streamAbortRegistry.unregister(streamId);
			};
		});
	}

	/**
	 * 分页列出当前用户历史拉取的经典语句会话。
	 */
	@Get('classic-quotes-history')
	async listClassicQuotesHistory(
		@Req() req: AuthedRequest,
		@Query('limit') limitStr?: string,
		@Query('offset') offsetStr?: string,
	) {
		const userId = req.user?.userId;
		if (userId == null) {
			throw new UnauthorizedException('未授权');
		}
		const limit = Math.min(
			100,
			Math.max(1, Number.parseInt(limitStr ?? '20', 10) || 20),
		);
		const offset = Math.max(0, Number.parseInt(offsetStr ?? '0', 10) || 0);
		const list = await this.englishLearningService.listClassicQuotesHistory(
			userId,
			{ limit, offset },
		);
		return { success: true, data: list };
	}

	@Get('classic-quotes-history/:streamId')
	async getClassicQuotesHistoryDetail(
		@Req() req: AuthedRequest,
		@Param('streamId') streamId: string,
	) {
		const userId = req.user?.userId;
		if (userId == null) {
			throw new UnauthorizedException('未授权');
		}
		const detail =
			await this.englishLearningService.getClassicQuotesHistoryDetail(
				userId,
				streamId,
			);
		return { success: true, data: detail };
	}

	/** 收藏经典句（同一内容键不重复落库） */
	@Post('classic-quotes-favorites')
	async addClassicQuoteFavorite(
		@Req() req: AuthedRequest,
		@Body() dto: ClassicQuoteFavoriteBodyDto,
	) {
		const userId = req.user?.userId;
		if (userId == null) {
			throw new UnauthorizedException('未授权');
		}
		const data = await this.englishLearningService.addClassicQuoteFavorite(
			userId,
			dto,
		);
		return { success: true, data };
	}

	@Post('classic-quotes-favorites/remove')
	async removeClassicQuoteFavorite(
		@Req() req: AuthedRequest,
		@Body() dto: ClassicQuoteFavoriteRemoveDto,
	) {
		const userId = req.user?.userId;
		if (userId == null) {
			throw new UnauthorizedException('未授权');
		}
		const data = await this.englishLearningService.removeClassicQuoteFavorite(
			userId,
			dto.english,
		);
		return { success: true, data };
	}

	@Post('classic-quotes-favorites/status')
	async classicQuoteFavoritesStatus(
		@Req() req: AuthedRequest,
		@Body() dto: ClassicQuoteFavoriteStatusDto,
	) {
		const userId = req.user?.userId;
		if (userId == null) {
			throw new UnauthorizedException('未授权');
		}
		const favoritedContentKeys =
			await this.englishLearningService.listClassicQuoteFavoriteContentKeys(
				userId,
				dto.englishes,
			);
		return { success: true, data: { favoritedContentKeys } };
	}

	@Post('classic-quotes')
	async classicQuotesPack(
		@Req() req: AuthedRequest,
		@Body() dto: GenerateClassicQuotesDto,
	) {
		const userId = req.user?.userId;
		if (userId == null) {
			throw new UnauthorizedException('未授权');
		}
		const payload = await this.englishLearningService.generateClassicQuotesPack(
			dto,
			{
				userId,
			},
		);
		return { success: true, data: payload };
	}

	/**
	 * 经典语句 SSE：`classic.progress` → `classic.chunk` → `classic.complete` | `classic.error`
	 */
	@Post('classic-quotes/stream')
	@Sse()
	@Header('X-Accel-Buffering', 'no')
	@Header('Cache-Control', 'no-cache, no-transform')
	classicQuotesStream(
		@Req() req: AuthedRequest,
		@Body() dto: GenerateClassicQuotesDto,
	): Observable<{ data: Record<string, unknown> }> {
		const userId = req.user?.userId;
		if (userId == null) {
			throw new UnauthorizedException('未授权');
		}
		const target = resolveClassicQuotesPackTargetCount(dto.count);
		const streamId = randomUUID();
		return new Observable((subscriber) => {
			const streamAbort = new AbortController();
			this.streamAbortRegistry.register(userId, streamId, streamAbort);
			const detachSseAbort = wireEnglishLearningSseAbort(req, streamAbort);
			const emit = (data: Record<string, unknown>) => {
				try {
					subscriber.next({ data });
				} catch {
					streamAbort.abort();
				}
			};
			emit({
				type: 'classic.progress',
				streamId,
				collected: 0,
				target,
				round: 0,
			});
			void (async () => {
				try {
					const items =
						await this.englishLearningService.runClassicQuotesGeneration(
							dto,
							async (p) => {
								emit({
									type: 'classic.progress',
									streamId,
									collected: p.collected,
									target: p.target,
									round: p.round,
								});
								if (p.newItems?.length) {
									await this.englishLearningService.saveClassicQuotesPackBatch({
										userId,
										streamId,
										round: p.round,
										topic: dto.topic,
										targetCount: target,
										items: p.newItems,
									});
									emit({
										type: 'classic.chunk',
										streamId,
										round: p.round,
										collected: p.collected,
										target: p.target,
										items: p.newItems,
									});
								}
							},
							{
								userId,
								signal: streamAbort.signal,
								onAgentTool: async (ev) => {
									emit(packAgentToolSsePayload('classic', streamId, ev));
									if (
										ev.phase === 'organic' &&
										Array.isArray(ev.searchOrganic) &&
										ev.searchOrganic.length > 0
									) {
										await this.englishLearningService.appendPackWebSearchRound({
											userId,
											streamId,
											packKind: 'classic_quotes',
											query:
												typeof ev.searchQuery === 'string'
													? ev.searchQuery
													: undefined,
											organic: ev.searchOrganic,
										});
									}
								},
							},
						);
					emit({
						type: 'classic.complete',
						success: true,
						streamId,
						items,
						requested: target,
					});
				} catch (e: unknown) {
					const message =
						e instanceof HttpException
							? classicQuoteHttpMessage(e)
							: '生成经典语句失败，请稍后重试';
					emit({
						type: 'classic.error',
						success: false,
						message,
					});
				} finally {
					this.streamAbortRegistry.unregister(streamId);
					detachSseAbort();
					subscriber.complete();
				}
			})();
			return () => {
				detachSseAbort();
				this.streamAbortRegistry.unregister(streamId);
			};
		});
	}
}
