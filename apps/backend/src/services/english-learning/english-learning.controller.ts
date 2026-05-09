import {
	Body,
	ClassSerializerInterceptor,
	Controller,
	HttpException,
	Post,
	Sse,
	UseGuards,
	UseInterceptors,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { JwtGuard } from 'src/guards/jwt.guard';
import { GenerateVocabularyDto } from './dto/generate-vocabulary.dto';
import { EnglishLearningService } from './english-learning.service';

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
	@Post('vocabulary-pack')
	async vocabularyPack(@Body() dto: GenerateVocabularyDto) {
		const itemsPayload =
			await this.englishLearningService.generateVocabularyPack(dto);
		return { success: true, data: itemsPayload };
	}

	/**
	 * 同上，但以 SSE 推送进度并最终下发完整 items，避免大批量时 HTTP 短超时导致一直转圈无结果。
	 * 事件：`vocab.progress` → `vocab.complete` | `vocab.error`
	 */
	@Post('vocabulary-pack/stream')
	@Sse()
	vocabularyPackStream(
		@Body() dto: GenerateVocabularyDto,
	): Observable<{ data: Record<string, unknown> }> {
		const target = Math.min(3000, Math.max(3, dto.count ?? 10));
		console.log('dto', dto);
		return new Observable((subscriber) => {
			subscriber.next({
				data: {
					type: 'vocab.progress',
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
							(p) => {
								subscriber.next({
									data: {
										type: 'vocab.progress',
										collected: p.collected,
										target: p.target,
										round: p.round,
									},
								});
							},
						);
					subscriber.next({
						data: {
							type: 'vocab.complete',
							success: true,
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
}
