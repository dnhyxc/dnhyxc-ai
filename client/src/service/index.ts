import { http } from '@/utils/fetch';
import {
	CREATE_VERIFY_CODE,
	GET_UPLOAD_TOKEN,
	GET_USER_PROFILE,
	GET_USERS,
	LOGIN,
	REGISTER,
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

export const register = async ({
	username,
	password,
}: {
	username: string;
	password: string;
}): Promise<any> => {
	return await http.post(REGISTER, {
		username,
		password,
	});
};

export const createVerifyCode = async () => {
	return await http.post(CREATE_VERIFY_CODE);
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
