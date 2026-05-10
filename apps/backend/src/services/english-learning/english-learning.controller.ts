import { randomUUID } from 'node:crypto';
import {
	Body,
	ClassSerializerInterceptor,
	Controller,
	Get,
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
import type { Request } from 'express';
import { Observable } from 'rxjs';
import { JwtGuard } from 'src/guards/jwt.guard';
import {
	ENGLISH_CLASSIC_QUOTES_GENERATION_MAX,
	ENGLISH_VOCAB_GENERATION_MAX,
	GenerateClassicQuotesDto,
	GenerateVocabularyDto,
} from './dto/generate-vocabulary.dto';
import { EnglishLearningService } from './english-learning.service';

type AuthedRequest = Request & { user?: { userId: number } };

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
	) {}

	/**
	 * 按主题与档位拉取单词学习资料（含 IPA、中文释义、例句）；读音由前端调用 TTS 播放 word。
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

	@Post('vocabulary-pack')
	async vocabularyPack(@Body() dto: GenerateVocabularyDto) {
		const itemsPayload =
			await this.englishLearningService.generateVocabularyPack(dto);
		return { success: true, data: itemsPayload };
	}

	/**
	 * 同上，但以 SSE 推送进度、每轮新词条（`vocab.chunk`）并最终下发完整 items。
	 * 事件：`vocab.progress`（可选）→ `vocab.chunk`（每轮有新词时）→ `vocab.complete` | `vocab.error`
	 */
	@Post('vocabulary-pack/stream')
	@Sse()
	vocabularyPackStream(
		@Req() req: AuthedRequest,
		@Body() dto: GenerateVocabularyDto,
	): Observable<{ data: Record<string, unknown> }> {
		const userId = req.user?.userId;
		if (userId == null) {
			throw new UnauthorizedException('未授权');
		}
		const target = Math.min(
			ENGLISH_VOCAB_GENERATION_MAX,
			Math.max(1, dto.count ?? 10),
		);
		const streamId = randomUUID();
		const level = dto.level ?? null;
		return new Observable((subscriber) => {
			subscriber.next({
				data: {
					type: 'vocab.progress',
					streamId,
					collected: 0,
					target,
					round: 0,
				},
			});
			void (async () => {
				try {
					const items =
						await this.englishLearningService.runVocabularyGeneration(
							dto,
							async (p) => {
								subscriber.next({
									data: {
										type: 'vocab.progress',
										streamId,
										collected: p.collected,
										target: p.target,
										round: p.round,
									},
								});
								if (p.newItems?.length) {
									await this.englishLearningService.saveVocabularyPackBatch({
										userId,
										streamId,
										round: p.round,
										topic: dto.topic,
										level,
										targetCount: target,
										items: p.newItems,
									});
									subscriber.next({
										data: {
											type: 'vocab.chunk',
											streamId,
											round: p.round,
											collected: p.collected,
											target: p.target,
											items: p.newItems,
										},
									});
								}
							},
						);
					subscriber.next({
						data: {
							type: 'vocab.complete',
							success: true,
							streamId,
							items,
							requested: target,
						},
					});
				} catch (e: unknown) {
					const message =
						e instanceof HttpException
							? vocabularyHttpMessage(e)
							: '生成单词资料失败，请稍后重试';
					subscriber.next({
						data: {
							type: 'vocab.error',
							success: false,
							message,
						},
					});
				} finally {
					subscriber.complete();
				}
			})();
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

	@Post('classic-quotes')
	async classicQuotesPack(@Body() dto: GenerateClassicQuotesDto) {
		const payload =
			await this.englishLearningService.generateClassicQuotesPack(dto);
		return { success: true, data: payload };
	}

	/**
	 * 经典语句 SSE：`classic.progress` → `classic.chunk` → `classic.complete` | `classic.error`
	 */
	@Post('classic-quotes/stream')
	@Sse()
	classicQuotesStream(
		@Req() req: AuthedRequest,
		@Body() dto: GenerateClassicQuotesDto,
	): Observable<{ data: Record<string, unknown> }> {
		const userId = req.user?.userId;
		if (userId == null) {
			throw new UnauthorizedException('未授权');
		}
		const target = Math.min(
			ENGLISH_CLASSIC_QUOTES_GENERATION_MAX,
			Math.max(1, dto.count ?? 10),
		);
		const streamId = randomUUID();
		const level = dto.level ?? null;
		return new Observable((subscriber) => {
			subscriber.next({
				data: {
					type: 'classic.progress',
					streamId,
					collected: 0,
					target,
					round: 0,
				},
			});
			void (async () => {
				try {
					const items =
						await this.englishLearningService.runClassicQuotesGeneration(
							dto,
							async (p) => {
								subscriber.next({
									data: {
										type: 'classic.progress',
										streamId,
										collected: p.collected,
										target: p.target,
										round: p.round,
									},
								});
								if (p.newItems?.length) {
									await this.englishLearningService.saveClassicQuotesPackBatch({
										userId,
										streamId,
										round: p.round,
										topic: dto.topic,
										level,
										targetCount: target,
										items: p.newItems,
									});
									subscriber.next({
										data: {
											type: 'classic.chunk',
											streamId,
											round: p.round,
											collected: p.collected,
											target: p.target,
											items: p.newItems,
										},
									});
								}
							},
						);
					subscriber.next({
						data: {
							type: 'classic.complete',
							success: true,
							streamId,
							items,
							requested: target,
						},
					});
				} catch (e: unknown) {
					const message =
						e instanceof HttpException
							? classicQuoteHttpMessage(e)
							: '生成经典语句失败，请稍后重试';
					subscriber.next({
						data: {
							type: 'classic.error',
							success: false,
							message,
						},
					});
				} finally {
					subscriber.complete();
				}
			})();
		});
	}
}
