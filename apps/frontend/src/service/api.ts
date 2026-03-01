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

// 获取七牛云上传token
export const GET_UPLOAD_TOKEN = '/upload/getUploadToken';

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

// 获取 session 对话历史
export const GET_SESSION = '/chat/getSession';

// 获取 session 对话历史列表
export const GET_SESSION_LIST = '/chat/getSessionList';
