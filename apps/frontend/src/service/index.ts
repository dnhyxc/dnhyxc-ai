import { http } from '@/utils/fetch';
import {
	CREATE_VERIFY_CODE,
	DOWNLOAD_FILE,
	DOWNLOAD_ZIP_FILE,
	GET_UPLOAD_TOKEN,
	GET_USER_PROFILE,
	GET_USERS,
	IMAGE_OCR,
	LOGIN,
	LOGIN_BY_EMAIL,
	REGISTER,
	RESET_PASSWORD,
	SEND_EMAIL,
	SEND_RESET_PWD_EMAIL,
	STOP_SSE,
	UPDATE_EMAIL,
	UPDATE_USER,
	UPLOAD_FILE,
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

// 图片分析
export const imageOcr = async (url?: string, prompt?: string) => {
	return await http.post(IMAGE_OCR, {
		url,
		prompt,
	});
};

// 停止大模型调用
export const stopSse = async (sessionId: string) => {
	console.log(sessionId, 'sessionId');
	return await http.post(STOP_SSE, {
		sessionId,
	});
};
