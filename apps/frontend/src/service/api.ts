// 登录
export const LOGIN = '/auth/login';

// 登录
export const LOGIN_BY_EMAIL = '/auth/loginByEmail';

// 发送邮件获取验证码
export const SEND_EMAIL = '/auth/sendEmail';

// 注册
export const REGISTER = '/auth/register';

// 生成验证码
export const CREATE_VERIFY_CODE = '/auth/createVerifyCode';

// 获取用户信息
export const GET_USERS = '/user/getUsers';

// 获取用户信息
export const GET_USER_PROFILE = '/user/profile';

// 修改用户信息
export const UPDATE_USER = '/user/updateUser';

// 修改用户邮件
export const UPDATE_EMAIL = '/user/updateEmail';

// 发送重置密码邮件
export const SEND_RESET_PWD_EMAIL = '/auth/sendResetPwdEmail';

// 修改用户密码
export const RESET_PASSWORD = '/auth/resetPassword';

// 上传文件到腾讯云 COS
export const UPLOAD_COS = '/upload/uploadCos';
/** 聊天附件批量上传 COS（前缀 chat/） */
export const UPLOAD_COS_CHAT_FILES = '/upload/uploadCosChatFiles';

// 上传文件
export const UPLOAD_FILE = '/upload/uploadFile';

// 批量上传文件
export const UPLOAD_FILES = '/upload/uploadFiles';

// 删除文件
export const DELETE_FILE = '/upload/deleteFile';

// 下载文件
export const DOWNLOAD_FILE = '/upload/download';

// 下载 zip 文件
export const DOWNLOAD_ZIP_FILE = '/upload/downloadZip';

// 图片分析
export const IMAGE_OCR = '/ocr/imageOcr';

// 停止模型调用
export const STOP_SSE = '/chat/stopSse';

/** 语音转写：录音上传 → 硅基流动 ASR（与 chat 路由解耦） */
export const SPEECH_TRANSCRIPTION = '/speech-transcription/transcription';
/** 云端文本转语音（硅基流动，需 SILICONFLOW_API_KEY） */
export const SPEECH_TTS = '/speech-transcription/speech';

// 创建会话
export const CREATE_SESSION = '/chat/createSession';

// 获取 session 对话历史
export const GET_SESSION = '/chat/getSession';

// 删除 session 对话
export const DELETE_SESSION = '/chat/delSession';

// 获取 session 对话历史列表
export const GET_SESSION_LIST = '/chat/getSessionList';

// 更新会话
export const UPDATE_SESSION = '/chat/updateSession';

// 创建 Chat 分享
export const CREATE_SHARE = '/share/create';

// 获取 Chat 分享
export const GET_SHARE = '/share/get';

// Stripe：创建 Checkout 会话（需登录）
export const CREATE_CHECKOUT_SESSION = '/pay/createCheckoutSession';

// 知识库（与 knowledge.controller 路径一致，全局前缀 api 由 BASE_URL 侧拼接）
export const KNOWLEDGE_SAVE = '/knowledge/save';
export const KNOWLEDGE_LIST = '/knowledge/list';
export const KNOWLEDGE_DETAIL = '/knowledge/detail';
export const KNOWLEDGE_UPDATE = '/knowledge/update';
export const KNOWLEDGE_DELETE = '/knowledge/delete';
// 知识库回收站
export const KNOWLEDGE_TRASH_LIST = '/knowledge/trash/list';
export const KNOWLEDGE_TRASH_DETAIL = '/knowledge/trash/detail';
export const KNOWLEDGE_TRASH_DELETE = '/knowledge/trash/delete';
export const KNOWLEDGE_TRASH_DELETE_BATCH = '/knowledge/trash/delete-batch';

/** 通用助手（智谱 GLM，多轮 session） 获取助手会话详情与消息（时间正序）*/
/** 实例级大模型运行时配置（覆盖 createLlm env 回退链） */
export const SETTINGS_LLM = '/settings/llm';
export const SETTINGS_LLM_DEFAULTS = '/settings/llm/defaults';

export const ASSISTANT_SESSION = '/assistant/session';
/** 按知识条目标识拉取该文章下全部会话（历史记录） */
export const ASSISTANT_SESSIONS_FOR_KNOWLEDGE =
	'/assistant/sessions/for-knowledge';
/** 草稿对话迁入已保存知识条目 */
export const ASSISTANT_SESSION_IMPORT_TRANSCRIPT =
	'/assistant/session/import-transcript';
export const ASSISTANT_SSE = '/assistant/sse';
export const ASSISTANT_STOP = '/assistant/stop';

/** LangChain Agent（工具调用 + SSE） */
export const AGENT_SESSION = '/agent/session';
export const AGENT_SESSIONS = '/agent/sessions';
export const AGENT_SSE = '/agent/sse';
export const AGENT_STOP = '/agent/stop';

/** 英语学习：按主题生成结构化单词包（IPA + 释义 + 例句） */
export const ENGLISH_LEARNING_VOCABULARY_PACK =
	'/english-learning/vocabulary-pack';
/** 同上，SSE 进度 + 最终 items（大批量避免短超时） */
export const ENGLISH_LEARNING_VOCABULARY_PACK_STREAM =
	'/english-learning/vocabulary-pack/stream';
/** 显式中止正在进行的单词包/经典句流式生成（与 progress 中的 streamId 一致） */
export const ENGLISH_LEARNING_STREAM_CANCEL = '/english-learning/stream/cancel';
/** 当前用户历史拉取的单词包会话列表（分页） */
export const ENGLISH_LEARNING_VOCABULARY_HISTORY =
	'/english-learning/vocabulary-history';
/** 将导入页解析后的单词包保存到「单词库」表（JSON body，大包易触默认 body 限制） */
export const ENGLISH_LEARNING_VOCABULARY_LIBRARY =
	'/english-learning/vocabulary-library';
/** 以 multipart 上传 JSON 文件，服务端解析后写入单词库（适合大包） */
export const ENGLISH_LEARNING_VOCABULARY_LIBRARY_UPLOAD =
	'/english-learning/vocabulary-library/upload';
/** 单词库（包）列表与库内词条分页 */
export const ENGLISH_LEARNING_VOCABULARY_LIBRARIES =
	'/english-learning/vocabulary-libraries';
/** 将导入页解析后的经典语句包保存到「语句库」表 */
export const ENGLISH_LEARNING_CLASSIC_QUOTES_LIBRARY =
	'/english-learning/classic-quotes-library';
/** 以 multipart 上传 JSON 文件，服务端解析后写入经典语句库 */
export const ENGLISH_LEARNING_CLASSIC_QUOTES_LIBRARY_UPLOAD =
	'/english-learning/classic-quotes-library/upload';
/** 经典语句库（包）列表与库内语句分页 */
export const ENGLISH_LEARNING_CLASSIC_QUOTES_LIBRARIES =
	'/english-learning/classic-quotes-libraries';
/** 单词收藏：新增、取消、批量查询已收藏词形 */
export const ENGLISH_LEARNING_VOCABULARY_FAVORITES =
	'/english-learning/vocabulary-favorites';
/** 导出当前用户单词收藏为 Word（DOCX） */
export const ENGLISH_LEARNING_VOCABULARY_FAVORITES_EXPORT_DOCX =
	'/english-learning/vocabulary-favorites/export-docx';
/** 单词错题集：批量加入、分页列表、删除 */
export const ENGLISH_LEARNING_VOCABULARY_MISTAKES =
	'/english-learning/vocabulary-mistakes';

/** 英语学习：按主题生成经典语句（译文 + 出处 + 赏析） */
export const ENGLISH_LEARNING_CLASSIC_QUOTES =
	'/english-learning/classic-quotes';
/** 同上，SSE 进度 + items */
export const ENGLISH_LEARNING_CLASSIC_QUOTES_STREAM =
	'/english-learning/classic-quotes/stream';
/** 经典语句历史会话列表（分页） */
export const ENGLISH_LEARNING_CLASSIC_QUOTES_HISTORY =
	'/english-learning/classic-quotes-history';
/** 经典句收藏：新增、取消、批量查询已收藏内容键（SHA256 hex） */
export const ENGLISH_LEARNING_CLASSIC_QUOTES_FAVORITES =
	'/english-learning/classic-quotes-favorites';
/** 导出当前用户经典句收藏为 Word（DOCX） */
export const ENGLISH_LEARNING_CLASSIC_QUOTES_FAVORITES_EXPORT_DOCX =
	'/english-learning/classic-quotes-favorites/export-docx';
