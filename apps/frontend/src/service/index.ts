import CryptoJS from 'crypto-js';
import {
	type KnowledgeListItem,
	type KnowledgeRecord,
	ShareInfo,
} from '@/types';
import type { SearchOrganicItem } from '@/types/chat';
import type { EnglishPackWebSearchRoundDto } from '@/utils/englishPackWebSearchMerge';
import { http } from '@/utils/fetch';
import {
	AGENT_SESSION,
	AGENT_SESSIONS,
	AGENT_STOP,
	ASSISTANT_SESSION,
	ASSISTANT_SESSION_IMPORT_TRANSCRIPT,
	ASSISTANT_SESSIONS_FOR_KNOWLEDGE,
	ASSISTANT_STOP,
	CREATE_CHECKOUT_SESSION,
	CREATE_SESSION,
	CREATE_SHARE,
	CREATE_VERIFY_CODE,
	DELETE_FILE,
	DELETE_SESSION,
	DOWNLOAD_FILE,
	DOWNLOAD_ZIP_FILE,
	ENGLISH_LEARNING_CLASSIC_QUOTES_FAVORITES,
	ENGLISH_LEARNING_CLASSIC_QUOTES_HISTORY,
	ENGLISH_LEARNING_STREAM_CANCEL,
	ENGLISH_LEARNING_VOCABULARY_FAVORITES,
	ENGLISH_LEARNING_VOCABULARY_HISTORY,
	ENGLISH_LEARNING_VOCABULARY_PACK,
	GET_SESSION,
	GET_SESSION_LIST,
	GET_SHARE,
	GET_UPLOAD_TOKEN,
	GET_USER_PROFILE,
	GET_USERS,
	IMAGE_OCR,
	KNOWLEDGE_DELETE,
	KNOWLEDGE_DETAIL,
	KNOWLEDGE_LIST,
	KNOWLEDGE_SAVE,
	KNOWLEDGE_TRASH_DELETE,
	KNOWLEDGE_TRASH_DELETE_BATCH,
	KNOWLEDGE_TRASH_DETAIL,
	KNOWLEDGE_TRASH_LIST,
	KNOWLEDGE_UPDATE,
	LOGIN,
	LOGIN_BY_EMAIL,
	REGISTER,
	RESET_PASSWORD,
	SEND_EMAIL,
	SEND_RESET_PWD_EMAIL,
	SPEECH_TRANSCRIPTION,
	STOP_SSE,
	UPDATE_EMAIL,
	UPDATE_SESSION,
	UPDATE_USER,
	UPLOAD_FILE,
	UPLOAD_FILES,
} from './api';

export const login = async ({
	username,
	password,
	captchaText,
	captchaId,
}: {
	username: string;
	password: string;
	captchaText: string;
	captchaId: string;
}) => {
	return await http.post(LOGIN, {
		username,
		password,
		captchaText,
		captchaId,
	});
};

export const loginByEmail = async ({
	email,
	verifyCodeKey,
	verifyCode,
}: {
	email: string;
	verifyCodeKey: string;
	verifyCode: string;
}): Promise<any> => {
	return await http.post(LOGIN_BY_EMAIL, {
		email,
		verifyCodeKey,
		verifyCode: Number(verifyCode),
	});
};

export const sendEmail = async (
	email: string,
	options?: { key: string; timeout?: number; subject?: string; title?: string },
): Promise<any> => {
	return await http.post(SEND_EMAIL, {
		email,
		options,
	});
};

export const register = async ({
	username,
	password,
	email,
	verifyCodeKey,
	verifyCode,
}: {
	username: string;
	password: string;
	email: string;
	verifyCodeKey: string;
	verifyCode: string;
}): Promise<any> => {
	return await http.post(REGISTER, {
		username,
		password,
		email,
		verifyCodeKey,
		verifyCode: Number(verifyCode),
	});
};

export const createVerifyCode = async () => {
	return await http.post(CREATE_VERIFY_CODE);
};

export const updateUser = async (id: number, params: object): Promise<any> => {
	// get 请求传递 param 格式参数
	// return await axios.get(`${GET_USER_PROFILE}/${id}`);
	// get 请求传递 query 格式参数
	return await http.post(UPDATE_USER, {
		id,
		...params,
	});
};

export const updateEmail = async (params: {
	id: number;
	email: string;
	oldVerifyCode: string;
	newVerifyCode: string;
	oldVerifyCodeKey: string;
	newVerifyCodeKey: string;
}): Promise<any> => {
	return await http.post(UPDATE_EMAIL, params);
};

export const sendResetPasswordEmail = async (params: {
	username: string;
	email: string;
}): Promise<any> => {
	return await http.post(SEND_RESET_PWD_EMAIL, params);
};

export const resetPassword = async (params: {
	username: string;
	password: string;
	email: string;
	verifyCode: string;
	verifyCodeKey: string;
}): Promise<any> => {
	return await http.post(RESET_PASSWORD, params);
};

export const getUserProfile = async (id: number): Promise<any> => {
	// get 请求传递 param 格式参数
	// return await axios.get(`${GET_USER_PROFILE}/${id}`);
	// get 请求传递 query 格式参数
	return await http.get(GET_USER_PROFILE, {
		querys: { id },
	});
};

// 获取用户列表
export const getUsers = async () => {
	return await http.get(GET_USERS);
};

// 获取七牛云上传token
export const getUploadToken = async () => {
	return await http.get(GET_UPLOAD_TOKEN);
};

// 上传文件
export const uploadFile = async (file: File) => {
	return await http.post(
		UPLOAD_FILE,
		{ file },
		{
			headers: {
				'Content-Type': 'multipart/form-data',
			},
		},
	);
};

// 上传多个文件
export const uploadFiles = async (files: File[]) => {
	return await http.post(UPLOAD_FILES, files, {
		headers: {
			'Content-Type': 'multipart/form-data',
		},
	});
};

// 下载文件
export const downloadFile = async (filename: string): Promise<any> => {
	return await http.get(DOWNLOAD_FILE, {
		querys: { filename },
	});
};

// 下载zip文件
export const downloadZip = async (filename: string): Promise<any> => {
	return await http.get(DOWNLOAD_ZIP_FILE, {
		querys: { filename },
	});
};

export const deleteFile = async (filename: string): Promise<any> => {
	return await http.delete(DELETE_FILE, {
		querys: { filename },
	});
};

// 图片分析
export const imageOcr = async (url?: string, prompt?: string) => {
	return await http.post(IMAGE_OCR, {
		url,
		prompt,
	});
};

// 创建 session
export const createSession = async (sessionId?: string) => {
	return await http.post(CREATE_SESSION, {
		sessionId,
	});
};

// 停止大模型调用
export const stopSse = async (sessionId: string) => {
	return await http.post(STOP_SSE, {
		sessionId,
	});
};

/** 语音转写：上传录音，返回识别文本（后端 speech-transcription 模块） */
export const transcribeSpeechAudio = async (blob: Blob, filename: string) => {
	const file = new File([blob], filename, {
		type: blob.type || 'audio/webm',
	});
	return await http.post<{ text: string }>(
		SPEECH_TRANSCRIPTION,
		{ file },
		{
			headers: { 'Content-Type': 'multipart/form-data' },
			timeout: 120000,
		},
	);
};

/** 助手会话详情（与 getAssistantSessionDetail / 按知识条目查询 结构一致） */
export type AssistantSessionDetailPayload = {
	/** 会话已删除（如删除知识时级联清理）时为 null，此时 messages 为空数组 */
	session: {
		sessionId: string;
		title: string | null;
		createdAt: string;
		updatedAt: string;
	} | null;
	messages: Array<{
		id: string;
		turnId: string | null;
		role: string;
		content: string;
		createdAt: string;
	}>;
};

/** 创建助手会话（空会话，多轮传 sessionId）；可传 knowledgeArticleId 与知识条目绑定并复用已有会话 */
export const createAssistantSession = async (payload?: {
	title?: string;
	knowledgeArticleId?: string;
	/** true：强制新建（用于「新对话」）；false/不传：复用该文章最近会话（兼容旧行为） */
	forceNew?: boolean;
}) => {
	return await http.post<{ sessionId: string; title: string | null }>(
		ASSISTANT_SESSION,
		payload ?? {},
	);
};

export type AssistantSessionListItem = {
	sessionId: string;
	title: string | null;
	createdAt: string;
	updatedAt: string;
};

/** 按知识条目标识拉取该文章下的会话列表（按 updatedAt 倒序） */
export const getAssistantSessionsByKnowledgeArticle = async (
	knowledgeArticleId: string,
	params?: { pageNo?: number; pageSize?: number },
) => {
	return await http.get<{
		knowledgeArticleId: string;
		list: AssistantSessionListItem[];
		total?: number;
		pageNo?: number;
		pageSize?: number;
	}>(ASSISTANT_SESSIONS_FOR_KNOWLEDGE, {
		querys: { knowledgeArticleId, ...(params ?? {}) },
	});
};

/** 拉取助手会话详情与消息（时间正序） */
export const getAssistantSessionDetail = async (sessionId: string) => {
	return await http.get<AssistantSessionDetailPayload>(ASSISTANT_SESSION, {
		params: [sessionId],
	});
};

/** 按知识条目标识拉取最近绑定的会话及消息（无则 data 为 null） */
export const getAssistantSessionByKnowledgeArticle = async (
	knowledgeArticleId: string,
) => {
	return await http.get<AssistantSessionDetailPayload | null>(
		`${ASSISTANT_SESSION}/for-knowledge`,
		{ querys: { knowledgeArticleId } },
	);
};

/** 将会话改绑到新的知识条目标识（如草稿保存后 id 变更） */
export const patchAssistantSessionKnowledgeArticle = async (
	sessionId: string,
	body: { knowledgeArticleId: string },
) => {
	return await http.patch<{
		sessionId: string;
		knowledgeArticleId: string;
	}>(`${ASSISTANT_SESSION}/${sessionId}/knowledge-article`, body);
};

/** 删除助手会话（会同时删除该会话下消息） */
export const deleteAssistantSession = async (sessionId: string) => {
	return await http.delete<{ sessionId: string }>(ASSISTANT_SESSION, {
		params: [sessionId],
	});
};

/** 首次保存后将草稿阶段助手对话迁入数据库（与后端 import-transcript 对齐；`lines` 最多 200 条，超长由 store 截最近 200 条） */
export const importAssistantTranscript = async (body: {
	knowledgeArticleId: string;
	/** 可选：指定导入到哪个会话（用于多会话场景）；不传则兼容旧行为导入到最近会话 */
	sessionId?: string;
	lines: Array<{ role: 'user' | 'assistant'; content: string }>;
}) => {
	return await http.post<{ sessionId: string; inserted: number }>(
		ASSISTANT_SESSION_IMPORT_TRANSCRIPT,
		body,
	);
};

/** 停止助手当前会话的流式生成 */
export const stopAssistantStream = async (payload: {
	sessionId?: string;
	streamId?: string;
}) => {
	return await http.post<{ success: boolean; message: string }>(
		ASSISTANT_STOP,
		payload,
	);
};

/** ---------- LangChain Agent（英语学习等专项模式共用）---------- */

export type AgentSessionDetailPayload = {
	session: {
		sessionId: string;
		title: string | null;
		createdAt: string;
		updatedAt: string;
	} | null;
	messages: Array<{
		id: string;
		turnId: string | null;
		role: string;
		content: string;
		searchOrganic?: SearchOrganicItem[] | null;
		createdAt: string;
	}>;
};

/** 创建空 Agent 会话 */
export const createAgentSession = async (body?: { title?: string }) => {
	return await http.post<{ sessionId: string; title: string | null }>(
		AGENT_SESSION,
		body ?? {},
	);
};

/** 拉取 Agent 会话与消息（时间正序） */
export const getAgentSessionDetail = async (sessionId: string) => {
	return await http.get<AgentSessionDetailPayload>(AGENT_SESSION, {
		params: [sessionId],
	});
};

export type AgentSessionListRow = {
	sessionId: string;
	title: string | null;
	createdAt: string;
	updatedAt: string;
};

/** 分页列出当前用户的 Agent 会话（按更新时间倒序） */
export const listAgentSessions = async (params: {
	pageNo?: number;
	pageSize?: number;
}) => {
	return await http.get<{
		list: AgentSessionListRow[];
		pageNo: number;
		pageSize: number;
		total: number;
	}>(AGENT_SESSIONS, {
		querys: {
			pageNo: params.pageNo ?? 1,
			pageSize: params.pageSize ?? 20,
		},
	});
};

/** 删除 Agent 会话 */
export const deleteAgentSession = async (sessionId: string) => {
	return await http.delete<{ sessionId: string }>(AGENT_SESSION, {
		params: [sessionId],
	});
};

/** 停止 Agent 当前轮次流式输出 */
export const stopAgentStream = async (body: { sessionId: string }) => {
	return await http.post<{ success: boolean; message: string }>(
		AGENT_STOP,
		body,
	);
};

/** ---------- 英语学习：结构化单词包（IPA + 释义 + 例句）---------- */

export type EnglishVocabularyItem = {
	word: string;
	ipa: string;
	translationZh: string;
	example: string;
};

export const generateEnglishVocabularyPack = async (params: {
	topic: string;
	count?: number;
}) => {
	return await http.post<{ items: EnglishVocabularyItem[] }>(
		ENGLISH_LEARNING_VOCABULARY_PACK,
		params,
	);
};

/**
 * 显式中止正在进行的单词包/经典句 SSE 生成（与 progress 中的 streamId 一致）。
 * 使用 `http.post` + `silent`，失败时不弹 Toast（任务已结束等属预期情况）。
 */
export async function postEnglishLearningStreamCancel(
	streamId: string,
): Promise<void> {
	try {
		await http.post<{ success: boolean; cancelled: boolean }>(
			ENGLISH_LEARNING_STREAM_CANCEL,
			{ streamId },
			{ silent: true },
		);
	} catch {
		// 流已结束或网络失败时不阻塞本地 abort
	}
}

/** 单次「拉取单词包」会话摘要（与后端 VocabularyHistoryListItem 一致） */
export type EnglishVocabularyHistoryEntry = {
	streamId: string;
	topic: string;
	targetCount: number;
	wordCount: number;
	createdAt: string;
	updatedAt: string;
	/** 本会话已落库的联网检索轮数 */
	webSearchRoundCount: number;
};

/** 分页列出当前用户历史拉取的单词包会话 */
export const listEnglishVocabularyHistory = async (options?: {
	limit?: number;
	offset?: number;
}) => {
	return await http.get<EnglishVocabularyHistoryEntry[]>(
		ENGLISH_LEARNING_VOCABULARY_HISTORY,
		{
			querys: {
				limit: options?.limit ?? 20,
				offset: options?.offset ?? 0,
			},
		},
	);
};

/** 获取某次会话的完整单词列表（含 IPA / 释义 / 例句） */
export const getEnglishVocabularyHistoryDetail = async (streamId: string) => {
	return await http.get<{
		streamId: string;
		topic: string;
		targetCount: number;
		items: EnglishVocabularyItem[];
		createdAt: string;
		webSearchRounds: EnglishPackWebSearchRoundDto[];
	}>(ENGLISH_LEARNING_VOCABULARY_HISTORY, {
		params: [streamId],
	});
};

/** 与后端收藏去重规则一致：trim + 小写（规范化词形） */
export function normalizeEnglishVocabWordKey(word: string): string {
	return word.trim().toLowerCase();
}

/** 收藏单词：服务端对同一规范化词形不重复插入 */
export const addEnglishVocabularyFavorite = async (
	item: EnglishVocabularyItem,
) => {
	return await http.post<{ created: boolean; id: string | null }>(
		ENGLISH_LEARNING_VOCABULARY_FAVORITES,
		item,
	);
};

export const removeEnglishVocabularyFavorite = async (word: string) => {
	return await http.post<{ removed: boolean }>(
		`${ENGLISH_LEARNING_VOCABULARY_FAVORITES}/remove`,
		{ word },
	);
};

/** 查询当前列表中哪些词已收藏（返回规范化词形） */
export const fetchEnglishVocabularyFavoriteStatus = async (words: string[]) => {
	return await http.post<{ favoritedWordKeys: string[] }>(
		`${ENGLISH_LEARNING_VOCABULARY_FAVORITES}/status`,
		{ words },
	);
};

/** 单词收藏分页列表项（GET 收藏记录） */
export type EnglishVocabularyFavoriteListEntry = {
	id: string;
	word: string;
	ipa: string;
	translationZh: string;
	example: string;
	createdAt: string;
};

export const listEnglishVocabularyFavorites = async (options?: {
	limit?: number;
	offset?: number;
}) => {
	return await http.get<EnglishVocabularyFavoriteListEntry[]>(
		ENGLISH_LEARNING_VOCABULARY_FAVORITES,
		{
			querys: {
				limit: options?.limit ?? 20,
				offset: options?.offset ?? 0,
			},
		},
	);
};

/** ---------- 英语学习：经典语句包 ---------- */

export type EnglishClassicQuoteItem = {
	english: string;
	translationZh: string;
	source: string;
	noteZh: string;
};

export type EnglishClassicQuoteHistoryEntry = {
	streamId: string;
	topic: string;
	targetCount: number;
	quoteCount: number;
	createdAt: string;
	updatedAt: string;
	webSearchRoundCount: number;
};

export const listEnglishClassicQuotesHistory = async (options?: {
	limit?: number;
	offset?: number;
}) => {
	return await http.get<EnglishClassicQuoteHistoryEntry[]>(
		ENGLISH_LEARNING_CLASSIC_QUOTES_HISTORY,
		{
			querys: {
				limit: options?.limit ?? 20,
				offset: options?.offset ?? 0,
			},
		},
	);
};

export const getEnglishClassicQuotesHistoryDetail = async (
	streamId: string,
) => {
	return await http.get<{
		streamId: string;
		topic: string;
		targetCount: number;
		items: EnglishClassicQuoteItem[];
		createdAt: string;
		webSearchRounds: EnglishPackWebSearchRoundDto[];
	}>(ENGLISH_LEARNING_CLASSIC_QUOTES_HISTORY, {
		params: [streamId],
	});
};

/** 与后端 `classicQuoteFavoriteContentKey` 一致：trim + 小写 + SHA256(hex) */
export function classicQuoteFavoriteContentKey(english: string): string {
	const n = english.trim().toLowerCase();
	if (!n) return '';
	return CryptoJS.SHA256(n).toString(CryptoJS.enc.Hex);
}

export const addEnglishClassicQuoteFavorite = async (
	item: EnglishClassicQuoteItem,
) => {
	return await http.post<{ created: boolean; id: string | null }>(
		ENGLISH_LEARNING_CLASSIC_QUOTES_FAVORITES,
		item,
	);
};

export const removeEnglishClassicQuoteFavorite = async (english: string) => {
	return await http.post<{ removed: boolean }>(
		`${ENGLISH_LEARNING_CLASSIC_QUOTES_FAVORITES}/remove`,
		{ english },
	);
};

export const fetchEnglishClassicQuoteFavoriteStatus = async (
	englishes: string[],
) => {
	return await http.post<{ favoritedContentKeys: string[] }>(
		`${ENGLISH_LEARNING_CLASSIC_QUOTES_FAVORITES}/status`,
		{ englishes },
	);
};

/** 经典句收藏分页列表项（GET 收藏记录） */
export type EnglishClassicQuoteFavoriteListEntry = {
	id: string;
	english: string;
	translationZh: string;
	source: string;
	noteZh: string;
	createdAt: string;
};

export const listEnglishClassicQuoteFavorites = async (options?: {
	limit?: number;
	offset?: number;
}) => {
	return await http.get<EnglishClassicQuoteFavoriteListEntry[]>(
		ENGLISH_LEARNING_CLASSIC_QUOTES_FAVORITES,
		{
			querys: {
				limit: options?.limit ?? 20,
				offset: options?.offset ?? 0,
			},
		},
	);
};

export const getSession = async (sessionId: string) => {
	return await http.get(GET_SESSION, {
		querys: { sessionId },
	});
};

export const getSessionList = async (options?: {
	pageSize?: number;
	pageNo?: number;
	userId?: string;
}) => {
	return await http.get(GET_SESSION_LIST, {
		querys: {
			pageSize: options?.pageSize ?? 20,
			pageNo: options?.pageNo ?? 1,
			userId: options?.userId ?? '',
		},
	});
};

// 删除会话
export const deleteSession = async (id: string): Promise<any> => {
	return await http.delete(DELETE_SESSION, {
		params: [id],
	});
};

// 更新会话
export const updateSession = async (
	sessionId: string,
	title: string,
): Promise<any> => {
	return await http.post(UPDATE_SESSION, {
		sessionId,
		title,
	});
};

/** Stripe Checkout：创建支付会话（需已登录，后端需配置 STRIPE_SECRET_KEY） */
export const createCheckoutSession = async (params: {
	amount: number;
	currency: string;
	productName?: string;
	/** true：内嵌收银台（完成后不整页跳转）；false/不传：跳转托管页 */
	embedded?: boolean;
	successUrl?: string;
	/** 仅托管跳转模式需要；embedded 模式勿传 */
	cancelUrl?: string;
}) => {
	return await http.post<{
		url: string | null;
		sessionId: string;
		clientSecret: string | null;
	}>(CREATE_CHECKOUT_SESSION, params);
};

// 创建会话分享
export const createShare = async (params: {
	chatSessionId: string;
	messageIds?: string[] | undefined;
	baseUrl?: string;
	sessionType?: 'chat' | 'assistant' | 'agent';
	/** session=会话分享（默认）；knowledge=知识文章分享 */
	shareType?: 'session' | 'knowledge';
}) => {
	return await http.post<ShareInfo>(CREATE_SHARE, {
		chatSessionId: params.chatSessionId,
		sessionType: params.sessionType,
		messageIds: params.messageIds,
		baseUrl: params.baseUrl,
		shareType: params.shareType,
	});
};

// 获取会话分享数据
export const getShare = async <T>(shareId: string) => {
	const res = await http.get<T>(`${GET_SHARE}/${shareId}`);
	return res;
};

// ---------- 知识库（knowledge.controller）----------

/** POST /knowledge/save：新建 */
export const saveKnowledge = async (params: Omit<KnowledgeRecord, 'id'>) => {
	return await http.post<{ id: string }>(KNOWLEDGE_SAVE, {
		title: params.title,
		content: params.content,
		author: params.author,
		authorId: params.authorId,
	});
};

/** GET /knowledge/list：分页列表 */
export const getKnowledgeList = async (params?: {
	pageNo?: number;
	pageSize?: number;
	title?: string;
	authorId?: number;
}) => {
	return await http.get<{ list: KnowledgeListItem[]; total: number }>(
		KNOWLEDGE_LIST,
		{
			querys: {
				pageNo: params?.pageNo,
				pageSize: params?.pageSize,
				title: params?.title,
				authorId: params?.authorId,
			},
		},
	);
};

/** GET /knowledge/detail/:id：单条含正文 */
export const getKnowledgeDetail = async (id: string) => {
	return await http.get<KnowledgeRecord>(KNOWLEDGE_DETAIL, {
		params: [id],
	});
};

/** PUT /knowledge/update/:id（body 含 id，与后端 UpdateKnowledgeDto 一致） */
export const updateKnowledge = async (
	id: string,
	body: Partial<
		Pick<KnowledgeRecord, 'title' | 'content' | 'author' | 'authorId'>
	>,
) => {
	return await http.put<KnowledgeRecord>(
		KNOWLEDGE_UPDATE,
		{ id, ...body },
		{ params: [id] },
	);
};

/** DELETE /knowledge/delete/:id */
export const deleteKnowledge = async (id: string) => {
	return await http.delete<{ id: string }>(KNOWLEDGE_DELETE, {
		params: [id],
	});
};

// ---------- 知识库回收站（knowledge.controller）----------

export type KnowledgeTrashListItem = {
	id: string;
	originalId: string;
	title: string | null;
	author: string | null;
	authorId: number | null;
	deletedAt?: string;
};

export type KnowledgeTrashRecord = KnowledgeTrashListItem & {
	content: string | null;
	sourceCreatedAt?: string | null;
	sourceUpdatedAt?: string | null;
};

/** GET /knowledge/trash/list：分页列表 */
export const getKnowledgeTrashList = async (params?: {
	pageNo?: number;
	pageSize?: number;
	title?: string;
	authorId?: number;
}) => {
	return await http.get<{ list: KnowledgeTrashListItem[]; total: number }>(
		KNOWLEDGE_TRASH_LIST,
		{
			querys: {
				pageNo: params?.pageNo,
				pageSize: params?.pageSize,
				title: params?.title,
				authorId: params?.authorId,
			},
		},
	);
};

/** GET /knowledge/trash/detail/:id */
export const getKnowledgeTrashDetail = async (id: string) => {
	return await http.get<KnowledgeTrashRecord>(KNOWLEDGE_TRASH_DETAIL, {
		params: [id],
	});
};

/** DELETE /knowledge/trash/delete/:id */
export const deleteKnowledgeTrash = async (id: string) => {
	return await http.delete<{ id: string }>(KNOWLEDGE_TRASH_DELETE, {
		params: [id],
	});
};

/** POST /knowledge/trash/delete-batch */
export const deleteKnowledgeTrashBatch = async (ids: string[]) => {
	return await http.post<{ affected: number }>(KNOWLEDGE_TRASH_DELETE_BATCH, {
		ids,
	});
};
