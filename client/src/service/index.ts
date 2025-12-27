import axios from '@/utils/axios';
import { GET_USER_PROFILE, GET_VERIFY_CODE, LOGIN, REGISTER } from './api';

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

export const getVerifyCode = async () => {
	return await axios.post(GET_VERIFY_CODE);
};

export const getUserProfile = async (id: number): Promise<any> => {
	return await axios.get(GET_USER_PROFILE, {
		params: {
			id,
		},
	});
};
