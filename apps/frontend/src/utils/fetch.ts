import { Toast } from '@ui/sonner';
import { BASE_URL } from '@/constant';
import { notifyUnauthorized } from '@/router/authSession';
import { isTauriRuntime } from './runtime';

type UnknownErrorMessage =
	| string
	| string[]
	| { message?: unknown }
	| Array<{ message?: unknown }>
	| null
	| undefined;

function normalizeErrorMessage(input: UnknownErrorMessage): string | null {
	if (typeof input === 'string') {
		const t = input.trim();
		return t ? t : null;
	}
	if (Array.isArray(input)) {
		const flat = input
			.map((x) => {
				if (typeof x === 'string') return x;
				if (x && typeof x === 'object' && 'message' in x) {
					const m = (x as { message?: unknown }).message;
					return typeof m === 'string' ? m : null;
				}
				return null;
			})
			.filter(Boolean) as string[];
		if (flat.length === 0) return null;
		// 避免 Toast 过长：最多展示前三条
		return flat.slice(0, 3).join('；');
	}
	if (input && typeof input === 'object' && 'message' in input) {
		const m = (input as { message?: unknown }).message;
		return typeof m === 'string' ? m : null;
	}
	return null;
}

function readAuthTokenFromLocal(): string {
	if (typeof window === 'undefined') {
		return '';
	}
	return localStorage.getItem('token') || '';
}

let cachedPlatformFetch: typeof globalThis.fetch | null = null;

/** Tauri 下使用 HTTP 插件，浏览器下使用原生 fetch */
export async function getPlatformFetch(): Promise<typeof globalThis.fetch> {
	if (cachedPlatformFetch) {
		return cachedPlatformFetch;
	}
	if (!isTauriRuntime()) {
		cachedPlatformFetch = globalThis.fetch.bind(globalThis);
		return cachedPlatformFetch;
	}
	const mod = await import('@tauri-apps/plugin-http');
	cachedPlatformFetch = mod.fetch as typeof globalThis.fetch;
	return cachedPlatformFetch;
}

// 定义自定义的 HTTP 选项类型
interface CustomHttpOptions {
	method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'HEAD' | 'OPTIONS';
	headers?: Record<string, string>;
	body?: string | FormData | Blob | ArrayBuffer | URLSearchParams;
	timeout?: number;
}

// 请求配置接口
export interface RequestConfig
	extends Omit<CustomHttpOptions, 'method' | 'body'> {
	params?: any[];
	querys?: Record<string, any>;
	data?: any;
	timeout?: number;
	headers?: Record<string, string>;
	onUploadProgress?: (progress: number) => void; // 上传进度回调
}

// 响应数据接口
export interface ResponseData<T = any> {
	code: number;
	data: T;
	success: boolean;
	message: string;
}

// 请求错误接口
export interface RequestError {
	code: number;
	message: string;
	data?: any;
	error?: string;
	success?: boolean;
}

// HTTP 请求类
class HttpClient {
	private baseURL: string;
	private defaultConfig: RequestConfig;

	constructor(
		baseURL: string = BASE_URL,
		config: RequestConfig = {},
		token: string = readAuthTokenFromLocal(),
	) {
		this.baseURL = baseURL;
		this.defaultConfig = {
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Bearer ${token}`,
				...config.headers,
			},
			timeout: 50000,
			...config,
		};
	}

	// 设置默认配置
	public setDefaultConfig(config: Partial<RequestConfig>): void {
		this.defaultConfig = { ...this.defaultConfig, ...config };
	}

	// 设置基础 URL
	public setBaseURL(url: string): void {
		this.baseURL = url;
	}

	// 设置认证 token
	public setAuthToken(token: string): void {
		if (this.defaultConfig.headers) {
			this.defaultConfig.headers.Authorization = `Bearer ${token}`;
		}
	}

	// 处理 GET Param URL 参数
	private handleUrlParams(url: string, params?: any[]): string {
		if (!params || params.length === 0) {
			return url;
		}
		const paramPath = params.join('/');
		return `${url}/${paramPath}`;
	}

	// 处理 URL 参数
	private handleUrlQuerys(url: string, querys?: Record<string, any>): string {
		if (!querys || Object.keys(querys).length === 0) {
			return url;
		}

		const queryString = Object.entries(querys)
			.filter(([_, value]) => value !== undefined && value !== null)
			.map(([key, value]) => {
				if (Array.isArray(value)) {
					return value
						.map((v) => `${encodeURIComponent(key)}=${encodeURIComponent(v)}`)
						.join('&');
				}
				return `${encodeURIComponent(key)}=${encodeURIComponent(value)}`;
			})
			.join('&');

		return `${url}${url.includes('?') ? '&' : '?'}${queryString}`;
	}

	// 异步构建 FormData，避免阻塞主线程
	private async buildFormDataAsync(
		data: any,
		onProgress?: (progress: number) => void,
	): Promise<FormData> {
		const formData = new FormData();

		// 计算总文件大小（用于进度计算）
		let totalSize = 0;
		let processedSize = 0;

		// 先计算总大小
		const calculateSize = (value: any): number => {
			if (value instanceof File) {
				return value.size;
			} else if (Array.isArray(value)) {
				return value.reduce((sum, item) => sum + calculateSize(item), 0);
			} else if (value && typeof value === 'object') {
				return Object.values(value).reduce(
					(sum: number, val) => sum + calculateSize(val),
					0,
				);
			}
			return 0;
		};

		totalSize = calculateSize(data);

		const updateProgress = () => {
			if (onProgress && totalSize > 0) {
				const progress = (processedSize / totalSize) * 100;
				onProgress(Math.min(progress, 99));
			}
		};

		const appendValue = (key: string, value: any) => {
			if (value instanceof File) {
				formData.append(key, value);
				processedSize += value.size;
				updateProgress();
			} else if (value !== undefined && value !== null) {
				formData.append(key, String(value));
			}
		};

		// 让出主线程的辅助函数
		const yieldToMain = () => new Promise((resolve) => setTimeout(resolve, 0));

		if (Array.isArray(data)) {
			// 异步处理数组中的文件
			for (let i = 0; i < data.length; i++) {
				const item = data[i];
				if (item instanceof File) {
					formData.append('files', item);
					processedSize += item.size;
					updateProgress();

					// 每处理一个文件，让出主线程
					await yieldToMain();
				} else {
					appendValue('files', item);
				}
			}
		} else if (data && typeof data === 'object') {
			const entries = Object.entries(data);
			for (let i = 0; i < entries.length; i++) {
				const [key, value] = entries[i];

				if (value instanceof File) {
					formData.append(key, value);
					processedSize += value.size;
					updateProgress();

					// 遇到文件时让出主线程
					await yieldToMain();
				} else if (Array.isArray(value)) {
					// 处理数组类型的值
					for (let j = 0; j < value.length; j++) {
						const item = value[j];
						if (item instanceof File) {
							formData.append(key, item);
							processedSize += item.size;
							updateProgress();

							// 每处理 2 个文件让出一次主线程
							if (j % 2 === 1) {
								await yieldToMain();
							}
						} else {
							appendValue(key, item);
						}
					}
				} else if (value && typeof value === 'object') {
					// 处理嵌套对象
					Object.entries(value).forEach(([subKey, subValue]) => {
						appendValue(`${key}[${subKey}]`, subValue);
					});
				} else {
					appendValue(key, value);
				}

				// 每处理 5 个字段让出一次主线程
				if (i % 5 === 4) {
					await yieldToMain();
				}
			}
		}

		if (onProgress) {
			onProgress(100);
		}

		return formData;
	}

	// 解析响应体
	private async parseResponseBody(response: Response): Promise<any> {
		const contentType = response.headers.get('content-type') || '';

		try {
			if (contentType.includes('application/json')) {
				return await response.json();
			} else if (contentType.includes('text/')) {
				return await response.text();
			} else if (contentType.includes('multipart/form-data')) {
				return await response.formData();
			} else {
				return await response.arrayBuffer();
			}
		} catch (_error) {
			return null;
		}
	}

	// 错误处理
	private async handleErrorResponse(
		response: Response,
		error?: any,
	): Promise<RequestError> {
		try {
			const responseBody = await this.parseResponseBody(response);

			if (responseBody && typeof responseBody === 'object') {
				return {
					code: responseBody.code || response.status || 500,
					message:
						responseBody.message ||
						responseBody.error ||
						response.statusText ||
						'请求失败',
					data: responseBody,
					error: responseBody.error,
					success: responseBody.success,
				};
			} else if (responseBody && typeof responseBody === 'string') {
				return {
					code: response.status || 500,
					message: responseBody || response.statusText || '请求失败',
					data: responseBody,
				};
			}
		} catch (parseError) {
			console.warn('Failed to parse error response:', parseError);
		}

		return {
			code: response.status || 500,
			message: response.statusText || '请求失败',
			data: error,
		};
	}

	// 处理网络错误等其他错误
	private handleNetworkError(error: any): RequestError {
		if (error && typeof error === 'object') {
			if ('code' in error && 'message' in error) {
				return error as RequestError;
			}

			return {
				code: error.status || 500,
				message: error.message || '请求失败',
				data: error.data || error,
			};
		}

		return {
			code: 500,
			message: String(error) || '未知错误',
		};
	}

	// 核心请求方法
	private async request<T>(
		method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'HEAD' | 'OPTIONS',
		url: string,
		config: RequestConfig = {},
	): Promise<ResponseData<T>> {
		const finalConfig: RequestConfig = {
			...this.defaultConfig,
			...config,
			headers: {
				...this.defaultConfig.headers,
				...config.headers,
			},
		};

		// 处理 URL 和参数
		const fullUrl = `${this.baseURL}${url}`;
		const paramUrl = this.handleUrlParams(fullUrl, finalConfig.params);
		const finalUrl = this.handleUrlQuerys(paramUrl, finalConfig.querys);

		// 处理请求体
		let body: any;
		const contentType = finalConfig.headers?.['Content-Type'] || '';

		// 判断是否为 FormData 上传
		const isFormData =
			contentType.includes('multipart/form-data') && finalConfig.data;

		if (isFormData) {
			// 异步构建 FormData，避免阻塞主线程
			body = await this.buildFormDataAsync(
				finalConfig.data,
				finalConfig.onUploadProgress,
			);
			// 删除 Content-Type，让浏览器自动设置 boundary
			delete finalConfig.headers?.['Content-Type'];
		} else if (contentType.includes('application/json') && finalConfig.data) {
			body = JSON.stringify(finalConfig.data);
		} else if (
			contentType.includes('application/x-www-form-urlencoded') &&
			finalConfig.data
		) {
			body = new URLSearchParams(finalConfig.data).toString();
		} else {
			body = finalConfig.data;
		}

		// 构建请求选项
		const requestOptions: CustomHttpOptions = {
			method,
			headers: finalConfig.headers,
			timeout: finalConfig.timeout,
			body: method === 'GET' || method === 'HEAD' ? undefined : body,
		};

		let response: Response | null = null;

		try {
			// 让出主线程，确保 UI 有机会更新
			await new Promise((resolve) => setTimeout(resolve, 0));

			// 发送请求
			const platformFetch = await getPlatformFetch();
			response = await platformFetch(finalUrl, requestOptions);

			// 解析响应数据
			const responseData = await this.parseResponseBody(response);

			// 检查响应状态
			if (!response.ok) {
				const errorInfo = await this.handleErrorResponse(
					response,
					responseData,
				);
				throw errorInfo;
			}

			// 返回标准化响应
			if (responseData && typeof responseData === 'object') {
				return {
					code: responseData.code || response.status,
					data: (responseData.data || responseData) as T,
					success:
						responseData.success !== undefined ? responseData.success : true,
					message: responseData.message || '请求成功',
				};
			}

			return {
				code: response.status,
				data: responseData as T,
				success: true,
				message: '请求成功',
			};
		} catch (error) {
			// 错误处理
			let requestError: RequestError;

			if (response) {
				requestError = await this.handleErrorResponse(response, error);
			} else if (
				error &&
				typeof error === 'object' &&
				'code' in error &&
				'message' in error
			) {
				requestError = error as RequestError;
			} else {
				requestError = this.handleNetworkError(error);
			}

			const isUnauthorized =
				response?.status === 401 || requestError.code === 401;

			if (isUnauthorized) {
				this.setAuthToken('');
				notifyUnauthorized();
			} else {
				console.log('requestError', requestError);
				const title =
					normalizeErrorMessage(
						requestError?.data?.data?.error?.message as UnknownErrorMessage,
					) ||
					normalizeErrorMessage(
						requestError?.data?.data?.message as UnknownErrorMessage,
					) ||
					normalizeErrorMessage(requestError.message) ||
					'请求接口异常';
				Toast({
					type: 'error',
					title,
				});
			}

			// 抛出错误
			throw requestError.data?.data || requestError;
		}
	}

	// GET 请求
	public get<T = any>(
		url: string,
		config: RequestConfig = {},
	): Promise<ResponseData<T>> {
		return this.request<T>('GET', url, config);
	}

	// POST 请求
	public post<T = any>(
		url: string,
		data?: any,
		config: RequestConfig = {},
	): Promise<ResponseData<T>> {
		return this.request<T>('POST', url, { ...config, data });
	}

	// PUT 请求
	public put<T = any>(
		url: string,
		data?: any,
		config: RequestConfig = {},
	): Promise<ResponseData<T>> {
		return this.request<T>('PUT', url, { ...config, data });
	}

	// DELETE 请求
	public delete<T = any>(
		url: string,
		config: RequestConfig = {},
	): Promise<ResponseData<T>> {
		return this.request<T>('DELETE', url, config);
	}

	// PATCH 请求
	public patch<T = any>(
		url: string,
		data?: any,
		config: RequestConfig = {},
	): Promise<ResponseData<T>> {
		return this.request<T>('PATCH', url, { ...config, data });
	}
}

// 创建默认实例
export const http = new HttpClient();

// 创建带有基础 URL 的实例
export const createHttpClient = (
	baseURL: string,
	config: RequestConfig = {},
) => {
	return new HttpClient(baseURL, config);
};

export default HttpClient;
