import axios, { type AxiosInstance, type AxiosRequestConfig } from 'axios';
import { toast } from 'sonner';
import { authStore } from '@/store';
import type { ApiResponse } from '@/types';

const BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

const request: AxiosInstance = axios.create({
	baseURL: BASE_URL,
	timeout: 30000,
	headers: {
		'Content-Type': 'application/json',
	},
});

request.interceptors.request.use(
	(config) => {
		const token = authStore.accessToken;
		if (token) {
			config.headers.Authorization = `Bearer ${token}`;
		}
		return config;
	},
	(error) => Promise.reject(error),
);

request.interceptors.response.use(
	(response) => {
		// 后端 ResponseInterceptor 包装格式：{ data, code, message, success }
		const res = response.data as ApiResponse<unknown>;

		// 如果不是标准响应格式（如二进制流），直接返回
		if (res === null || typeof res !== 'object' || !('code' in res)) {
			return response.data;
		}

		// HTTP 状态码非 200 或 success 为 false
		if (res.code !== 200 && res.code !== 0) {
			toast.error(res.message || '请求失败');
			return Promise.reject(new Error(res.message || '请求失败'));
		}

		// 返回 res.data（业务数据部分）
		return res.data;
	},
	(error) => {
		if (error.response?.status === 401) {
			authStore.logout();
			window.location.href = '/login';
		} else {
			const msg =
				error.response?.data?.message ||
				error.response?.data?.message ||
				error.message ||
				'网络错误';
			toast.error(msg);
		}
		return Promise.reject(error);
	},
);

export async function apiGet<T>(
	url: string,
	config?: AxiosRequestConfig,
): Promise<T> {
	return request.get(url, config);
}

export async function apiPost<T>(
	url: string,
	data?: unknown,
	config?: AxiosRequestConfig,
): Promise<T> {
	return request.post(url, data, config);
}

export async function apiPut<T>(
	url: string,
	data?: unknown,
	config?: AxiosRequestConfig,
): Promise<T> {
	return request.put(url, data, config);
}

export async function apiDelete<T>(
	url: string,
	config?: AxiosRequestConfig,
): Promise<T> {
	return request.delete(url, config);
}

export async function apiPatch<T>(
	url: string,
	data?: unknown,
	config?: AxiosRequestConfig,
): Promise<T> {
	return request.patch(url, data, config);
}

export { request };
