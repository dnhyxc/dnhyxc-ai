import axios from '@/utils/axios';
import { CREATE_VERIFY_CODE, GET_USER_PROFILE, LOGIN, REGISTER } from './api';

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
}): Promise<{ access_token: string }> => {
	return await axios.post(LOGIN, {
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
	return await axios.post(REGISTER, {
		username,
		password,
	});
};

export const createVerifyCode = async () => {
	return await axios.post(CREATE_VERIFY_CODE);
};

export const getUserProfile = async (id: number): Promise<any> => {
	// get 请求传递 param 格式参数
	// return await axios.get(`${GET_USER_PROFILE}/${id}`);
	// get 请求传递 query 格式参数
	return await axios.get(GET_USER_PROFILE, {
		params: {
			id,
		},
	});
};
