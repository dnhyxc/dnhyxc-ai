import http from '@/utils/axios';
import { GET_SHARE } from './api';

// 获取会话分享数据
export const getShare = async <T>(shareId: string) => {
	const res = await http.get<T>(`${GET_SHARE}/${shareId}`);
	return res;
};
