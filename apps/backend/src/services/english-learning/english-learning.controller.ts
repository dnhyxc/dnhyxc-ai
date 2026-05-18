import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { unlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
	BadRequestException,
	Body,
	ClassSerializerInterceptor,
	Controller,
	Delete,
	Get,
	Header,
	HttpException,
	Param,
	Post,
	Query,
	Req,
	Res,
	Sse,
	UnauthorizedException,
	UploadedFile,
	UseGuards,
	UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Request, Response } from 'express';
import { diskStorage } from 'multer';
import { Observable } from 'rxjs';
import { JwtGuard } from 'src/guards/jwt.guard';
import {
	PACK_SSE_COMPLETE_OMIT_ITEMS_THRESHOLD,
	PACK_SSE_KEEPALIVE_INTERVAL_MS,
} from './constant';
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
import { SaveClassicQuotesLibraryDto } from './dto/save-classic-quotes-library.dto';
import { SaveVocabularyLibraryDto } from './dto/save-vocabulary-library.dto';
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

/** 长任务 SSE 心跳，避免库内加载/向量匹配期间被代理或客户端判为断流 */
function startEnglishPackSseKeepalive(
	emit: (data: Record<string, unknown>) => void,
	params: {
		eventPrefix: 'vocab' | 'classic';
		streamId: string;
		target: number;
	},
): () => void {
	const timer = setInterval(() => {
		emit({
			type: `${params.eventPrefix}.progress`,
			streamId: params.streamId,
			collected: 0,
			target: params.target,
			round: 0,
			heartbeat: true,
		});
	}, PACK_SSE_KEEPALIVE_INTERVAL_MS);
	return () => clearInterval(timer);
}

function buildEnglishPackCompleteSsePayload(params: {
	eventPrefix: 'vocab' | 'classic';
	streamId: string;
	items: unknown[];
	requested: number;
	servedFromDatabase: boolean;
}): Record<string, unknown> {
	const omitItems =
		params.servedFromDatabase ||
		params.items.length >= PACK_SSE_COMPLETE_OMIT_ITEMS_THRESHOLD;
	return {
		type: `${params.eventPrefix}.complete`,
		success: true,
		streamId: params.streamId,
		items: omitItems ? [] : params.items,
		itemCount: params.items.length,
		requested: params.requested,
		...(omitItems ? { itemsOmitted: true } : {}),
		...(params.servedFromDatabase ? { fromDatabase: true } : {}),
	};
}

type AuthedRequest = Request & { user?: { userId: number } };

/** 单词库 JSON 上传临时目录（处理完成后会删除文件） */
const EL_VOCAB_LIBRARY_UPLOAD_DIR = join(tmpdir(), 'dnhyxc-el-vocab-library');

function ensureElVocabLibraryUploadDir(): void {
	if (!existsSync(EL_VOCAB_LIBRARY_UPLOAD_DIR)) {
		mkdirSync(EL_VOCAB_LIBRARY_UPLOAD_DIR, { recursive: true });
	}
}

function vocabularyLibraryJsonUploadMulterOptions() {
	return {
		storage: diskStorage({
			destination: (_req, _file, cb) => {
				ensureElVocabLibraryUploadDir();
				cb(null, EL_VOCAB_LIBRARY_UPLOAD_DIR);
			},
			filename: (_req, _file, cb) => {
				cb(null, `${randomUUID()}.json`);
			},
		}),
		limits: { fileSize: 25 * 1024 * 1024 },
		fileFilter: (
			_req: unknown,
			file: Express.Multer.File,
			cb: (e: Error | null, accept: boolean) => void,
		) => {
			const mime = file.mimetype || '';
			const name = (file.originalname || '').toLowerCase();
			const okMime =
				mime === 'application/json' ||
				mime === 'text/plain' ||
				mime === 'application/octet-stream' ||
				mime === '';
			if (!okMime && !name.endsWith('.json')) {
				cb(new BadRequestException('请上传 JSON 文件'), false);
				return;
			}
			cb(null, true);
		},
	};
}

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

	/** 按 streamId + sortOrder 分页读取单词明细 */
	@Get('vocabulary-history/:streamId/items')
	async listVocabularyPackItems(
		@Req() req: AuthedRequest,
		@Param('streamId') streamId: string,
		@Query('limit') limitStr?: string,
		@Query('offset') offsetStr?: string,
	) {
		const userId = req.user?.userId;
		if (userId == null) {
			throw new UnauthorizedException('未授权');
		}
		const limit = Math.max(1, Number.parseInt(limitStr ?? '100', 10) || 100);
		const offset = Math.max(0, Number.parseInt(offsetStr ?? '0', 10) || 0);
		const data = await this.englishLearningService.listVocabularyPackItems(
			userId,
			streamId,
			{ limit, offset },
		);
		return { success: true, data };
	}

	/** 拉取会话元数据（不含词条明细） */
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

	/** 删除单词包拉取历史（含 pack_item 明细） */
	@Delete('vocabulary-history/:streamId')
	async deleteVocabularyPackHistory(
		@Req() req: AuthedRequest,
		@Param('streamId') streamId: string,
	) {
		const userId = req.user?.userId;
		if (userId == null) {
			throw new UnauthorizedException('未授权');
		}
		const data = await this.englishLearningService.deleteVocabularyPackHistory(
			userId,
			streamId,
		);
		return { success: true, data };
	}

	/** 分页列出当前用户的单词库（包） */
	@Get('vocabulary-libraries')
	async listVocabularyLibraries(
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
		const data = await this.englishLearningService.listVocabularyLibraries(
			userId,
			{ limit, offset },
		);
		return { success: true, data };
	}

	/** 删除单词库（含库内全部词条，数据库级联删除） */
	@Delete('vocabulary-libraries/:libraryId')
	async deleteVocabularyLibrary(
		@Req() req: AuthedRequest,
		@Param('libraryId') libraryId: string,
	) {
		const userId = req.user?.userId;
		if (userId == null) {
			throw new UnauthorizedException('未授权');
		}
		const data = await this.englishLearningService.deleteVocabularyLibrary(
			userId,
			libraryId,
		);
		return { success: true, data };
	}

	/** 分页列出某单词库内的词条（按导入顺序 sort_order 升序） */
	@Get('vocabulary-libraries/:libraryId/items')
	async listVocabularyLibraryItems(
		@Req() req: AuthedRequest,
		@Param('libraryId') libraryId: string,
		@Query('limit') limitStr?: string,
		@Query('offset') offsetStr?: string,
	) {
		const userId = req.user?.userId;
		if (userId == null) {
			throw new UnauthorizedException('未授权');
		}
		const limit = Math.min(
			200,
			Math.max(1, Number.parseInt(limitStr ?? '50', 10) || 50),
		);
		const offset = Math.max(0, Number.parseInt(offsetStr ?? '0', 10) || 0);
		const data = await this.englishLearningService.listVocabularyLibraryItems(
			userId,
			libraryId,
			{ limit, offset },
		);
		return { success: true, data };
	}

	/**
	 * multipart 上传 JSON 文件（字段 `file` + `title`），服务端读取、解析、落库后删除临时文件。
	 * 避免大 JSON 走 application/json 触达默认 body 大小限制。
	 */
	@Post('vocabulary-library/upload')
	@UseInterceptors(
		FileInterceptor('file', vocabularyLibraryJsonUploadMulterOptions()),
	)
	async saveVocabularyLibraryUpload(
		@Req() req: AuthedRequest,
		@UploadedFile() file: Express.Multer.File,
		@Body('title') titleRaw?: string,
	) {
		const userId = req.user?.userId;
		if (userId == null) {
			throw new UnauthorizedException('未授权');
		}
		const diskPath = file?.path;
		try {
			if (!diskPath) {
				throw new BadRequestException('请上传 JSON 文件');
			}
			const title = typeof titleRaw === 'string' ? titleRaw.trim() : '';
			if (!title) {
				throw new BadRequestException('标题不能为空');
			}
			const text = readFileSync(diskPath, 'utf8');
			let root: unknown;
			try {
				root = text ? JSON.parse(text) : null;
			} catch {
				throw new BadRequestException('无法解析为合法 JSON');
			}
			const data =
				await this.englishLearningService.saveImportedVocabularyLibraryFromPackJson(
					userId,
					title,
					root,
				);
			return { success: true, data };
		} finally {
			if (diskPath) {
				try {
					await unlink(diskPath);
				} catch {
					// 临时文件删除失败不阻塞成功响应
				}
			}
		}
	}

	/** 将导入页 JSON 解析后的单词包保存到「单词库」表（每包一行，小包体可用 JSON body） */
	@Post('vocabulary-library')
	async saveVocabularyLibrary(
		@Req() req: AuthedRequest,
		@Body() dto: SaveVocabularyLibraryDto,
	) {
		const userId = req.user?.userId;
		if (userId == null) {
			throw new UnauthorizedException('未授权');
		}
		const data =
			await this.englishLearningService.saveImportedVocabularyLibrary(
				userId,
				dto,
			);
		return { success: true, data };
	}

	/** 分页列出当前用户的经典语句库（包） */
	@Get('classic-quotes-libraries')
	async listClassicQuotesLibraries(
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
		const data = await this.englishLearningService.listClassicQuotesLibraries(
			userId,
			{ limit, offset },
		);
		return { success: true, data };
	}

	/** 删除经典语句库（含库内全部语句，数据库级联删除） */
	@Delete('classic-quotes-libraries/:libraryId')
	async deleteClassicQuotesLibrary(
		@Req() req: AuthedRequest,
		@Param('libraryId') libraryId: string,
	) {
		const userId = req.user?.userId;
		if (userId == null) {
			throw new UnauthorizedException('未授权');
		}
		const data = await this.englishLearningService.deleteClassicQuotesLibrary(
			userId,
			libraryId,
		);
		return { success: true, data };
	}

	/** 分页列出某经典语句库内的语句（按导入顺序 sort_order 升序） */
	@Get('classic-quotes-libraries/:libraryId/items')
	async listClassicQuotesLibraryItems(
		@Req() req: AuthedRequest,
		@Param('libraryId') libraryId: string,
		@Query('limit') limitStr?: string,
		@Query('offset') offsetStr?: string,
	) {
		const userId = req.user?.userId;
		if (userId == null) {
			throw new UnauthorizedException('未授权');
		}
		const limit = Math.min(
			200,
			Math.max(1, Number.parseInt(limitStr ?? '50', 10) || 50),
		);
		const offset = Math.max(0, Number.parseInt(offsetStr ?? '0', 10) || 0);
		const data =
			await this.englishLearningService.listClassicQuotesLibraryItems(
				userId,
				libraryId,
				{ limit, offset },
			);
		return { success: true, data };
	}

	/**
	 * multipart 上传 JSON 文件（字段 `file` + `title`），服务端读取、解析、落库后删除临时文件。
	 */
	@Post('classic-quotes-library/upload')
	@UseInterceptors(
		FileInterceptor('file', vocabularyLibraryJsonUploadMulterOptions()),
	)
	async saveClassicQuotesLibraryUpload(
		@Req() req: AuthedRequest,
		@UploadedFile() file: Express.Multer.File,
		@Body('title') titleRaw?: string,
	) {
		const userId = req.user?.userId;
		if (userId == null) {
			throw new UnauthorizedException('未授权');
		}
		const diskPath = file?.path;
		try {
			if (!diskPath) {
				throw new BadRequestException('请上传 JSON 文件');
			}
			const title = typeof titleRaw === 'string' ? titleRaw.trim() : '';
			if (!title) {
				throw new BadRequestException('标题不能为空');
			}
			const text = readFileSync(diskPath, 'utf8');
			let root: unknown;
			try {
				root = text ? JSON.parse(text) : null;
			} catch {
				throw new BadRequestException('无法解析为合法 JSON');
			}
			const data =
				await this.englishLearningService.saveImportedClassicQuotesLibraryFromPackJson(
					userId,
					title,
					root,
				);
			return { success: true, data };
		} finally {
			if (diskPath) {
				try {
					await unlink(diskPath);
				} catch {
					// 临时文件删除失败不阻塞成功响应
				}
			}
		}
	}

	/** 将导入页 JSON 解析后的经典语句包保存到「语句库」表（小包体可用 JSON body） */
	@Post('classic-quotes-library')
	async saveClassicQuotesLibrary(
		@Req() req: AuthedRequest,
		@Body() dto: SaveClassicQuotesLibraryDto,
	) {
		const userId = req.user?.userId;
		if (userId == null) {
			throw new UnauthorizedException('未授权');
		}
		const data =
			await this.englishLearningService.saveImportedClassicQuotesLibrary(
				userId,
				dto,
			);
		return { success: true, data };
	}

	/** 分页列出当前用户收藏的单词（按收藏时间倒序） */
	@Get('vocabulary-favorites')
	async listVocabularyFavoritesPaginated(
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
		const data = await this.englishLearningService.listVocabularyFavoritesPage(
			userId,
			{ limit, offset },
		);
		return { success: true, data };
	}

	/** 导出当前用户单词收藏为 DOCX（服务端拉全量至多 3000 条，与列表分页无关） */
	@Get('vocabulary-favorites/export-docx')
	async exportVocabularyFavoritesDocx(
		@Req() req: AuthedRequest,
		@Res() res: Response,
	): Promise<void> {
		const userId = req.user?.userId;
		if (userId == null) {
			throw new UnauthorizedException('未授权');
		}
		const buf =
			await this.englishLearningService.exportVocabularyFavoritesDocxBuffer(
				userId,
			);
		res.setHeader(
			'Content-Type',
			'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
		);
		res.setHeader(
			'Content-Disposition',
			'attachment; filename="english-vocabulary-favorites.docx"',
		);
		res.setHeader('Content-Length', String(buf.length));
		res.end(buf);
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
			const stopKeepalive = startEnglishPackSseKeepalive(emit, {
				eventPrefix: 'vocab',
				streamId,
				target,
			});
			void (async () => {
				let servedFromDatabase = false;
				try {
					const items =
						await this.englishLearningService.runVocabularyGeneration(
							dto,
							async (p) => {
								if (p.fromDatabase) servedFromDatabase = true;
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
										...(p.fromDatabase ? { fromDatabase: true } : {}),
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
					emit(
						buildEnglishPackCompleteSsePayload({
							eventPrefix: 'vocab',
							streamId,
							items,
							requested: target,
							servedFromDatabase,
						}),
					);
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
					stopKeepalive();
					this.streamAbortRegistry.unregister(streamId);
					detachSseAbort();
					subscriber.complete();
				}
			})();
			return () => {
				stopKeepalive();
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

	@Get('classic-quotes-history/:streamId/items')
	async listClassicQuotesPackItems(
		@Req() req: AuthedRequest,
		@Param('streamId') streamId: string,
		@Query('limit') limitStr?: string,
		@Query('offset') offsetStr?: string,
	) {
		const userId = req.user?.userId;
		if (userId == null) {
			throw new UnauthorizedException('未授权');
		}
		const limit = Math.max(1, Number.parseInt(limitStr ?? '100', 10) || 100);
		const offset = Math.max(0, Number.parseInt(offsetStr ?? '0', 10) || 0);
		const data = await this.englishLearningService.listClassicQuotesPackItems(
			userId,
			streamId,
			{ limit, offset },
		);
		return { success: true, data };
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

	/** 删除经典句拉取历史（含 pack_item 明细） */
	@Delete('classic-quotes-history/:streamId')
	async deleteClassicQuotesPackHistory(
		@Req() req: AuthedRequest,
		@Param('streamId') streamId: string,
	) {
		const userId = req.user?.userId;
		if (userId == null) {
			throw new UnauthorizedException('未授权');
		}
		const data =
			await this.englishLearningService.deleteClassicQuotesPackHistory(
				userId,
				streamId,
			);
		return { success: true, data };
	}

	/** 分页列出当前用户收藏的经典句（按收藏时间倒序） */
	@Get('classic-quotes-favorites')
	async listClassicQuoteFavoritesPaginated(
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
		const data =
			await this.englishLearningService.listClassicQuoteFavoritesPage(userId, {
				limit,
				offset,
			});
		return { success: true, data };
	}

	/** 导出当前用户经典句收藏为 DOCX（服务端拉全量至多 3000 条） */
	@Get('classic-quotes-favorites/export-docx')
	async exportClassicQuoteFavoritesDocx(
		@Req() req: AuthedRequest,
		@Res() res: Response,
	): Promise<void> {
		const userId = req.user?.userId;
		if (userId == null) {
			throw new UnauthorizedException('未授权');
		}
		const buf =
			await this.englishLearningService.exportClassicQuoteFavoritesDocxBuffer(
				userId,
			);
		res.setHeader(
			'Content-Type',
			'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
		);
		res.setHeader(
			'Content-Disposition',
			'attachment; filename="english-classic-quote-favorites.docx"',
		);
		res.setHeader('Content-Length', String(buf.length));
		res.end(buf);
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
			const stopKeepalive = startEnglishPackSseKeepalive(emit, {
				eventPrefix: 'classic',
				streamId,
				target,
			});
			void (async () => {
				let servedFromDatabase = false;
				try {
					const items =
						await this.englishLearningService.runClassicQuotesGeneration(
							dto,
							async (p) => {
								if (p.fromDatabase) servedFromDatabase = true;
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
										...(p.fromDatabase ? { fromDatabase: true } : {}),
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
					emit(
						buildEnglishPackCompleteSsePayload({
							eventPrefix: 'classic',
							streamId,
							items,
							requested: target,
							servedFromDatabase,
						}),
					);
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
					stopKeepalive();
					this.streamAbortRegistry.unregister(streamId);
					detachSseAbort();
					subscriber.complete();
				}
			})();
			return () => {
				stopKeepalive();
				detachSseAbort();
				this.streamAbortRegistry.unregister(streamId);
			};
		});
	}
}
