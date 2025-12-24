import axios from '@/utils/axios';
import { GET_USER_PROFILE, LOGIN, REGISTER } from './api';

export const login = async ({
	username,
	password,
}: {
	username: string;
	password: string;
}): Promise<{ access_token: string }> => {
	return await axios.post(LOGIN, {
		username,
		password,
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

export const getUserProfile = async (id: number): Promise<any> => {
	return await axios.get(GET_USER_PROFILE, {
		params: {
			id,
		},
	});
};
