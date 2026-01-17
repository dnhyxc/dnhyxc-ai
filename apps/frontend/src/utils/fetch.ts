import { fetch } from '@tauri-apps/plugin-http';
import { Toast } from '@ui/sonner';
import { getStorage } from '.';

// 定义自定义的 HTTP 选项类型
interface CustomHttpOptions {
	method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'HEAD' | 'OPTIONS';
	headers?: Record<string, string>;
	body?: string | FormData | Blob | ArrayBuffer | URLSearchParams;
	timeout?: number;
	// 添加其他需要的选项
}

// 请求配置接口
export interface RequestConfig
	extends Omit<CustomHttpOptions, 'method' | 'body'> {
	params?: any[];
	querys?: Record<string, any>;
	data?: any;
	timeout?: number;
	headers?: Record<string, string>;
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
		baseURL: string = import.meta.env.PROD
			? 'http://101.34.214.188:9112/api'
			: 'http://localhost:9112/api',
		config: RequestConfig = {},
		token: string = getStorage('token') || '',
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
		// 按照数组索引顺序拼接路径参数
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

	// 处理请求体
	private handleRequestBody(data: any, headers: Record<string, string>): any {
		const contentType = headers['Content-Type'] || '';

		if (contentType.includes('application/json') && data) {
			return JSON.stringify(data);
		}

		if (contentType.includes('application/x-www-form-urlencoded') && data) {
			return new URLSearchParams(data).toString();
		}

		if (contentType.includes('multipart/form-data') && data) {
			const formData = new FormData();
			Object.entries(data).forEach(([key, value]) => {
				if (value instanceof File) {
					formData.append(key, value);
				} else if (Array.isArray(value)) {
					for (const v of value) {
						formData.append(key, v);
					}
				} else {
					formData.append(key, String(value));
				}
			});
			return formData;
		}

		return data;
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

	// 错误处理 - 现在可以接收服务器返回的详细错误信息
	private async handleErrorResponse(
		response: Response,
		error?: any,
	): Promise<RequestError> {
		try {
			// 首先尝试解析服务器的响应体
			const responseBody = await this.parseResponseBody(response);

			if (responseBody && typeof responseBody === 'object') {
				// 根据您的服务器响应结构，提取错误信息
				// 您的服务器返回格式示例：{ error: '验证码错误', success: false, code: 500, message: '验证码错误' }
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

		// 如果无法解析响应体，返回通用的错误信息
		return {
			code: response.status || 500,
			message: response.statusText || '请求失败',
			data: error,
		};
	}

	// 处理网络错误等其他错误
	private handleNetworkError(error: any): RequestError {
		if (error && typeof error === 'object') {
			// 如果错误对象已经有我们需要的结构，直接返回
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
		const body = this.handleRequestBody(
			finalConfig.data,
			finalConfig.headers || {},
		);

		// 构建请求选项
		const requestOptions: CustomHttpOptions = {
			method,
			...finalConfig,
			body: method === 'GET' || method === 'HEAD' ? undefined : body,
		};

		let response: Response | null = null;

		try {
			// 发送请求
			response = await fetch(finalUrl, requestOptions);

			// 解析响应数据（无论成功还是失败都需要解析）
			const responseData = await this.parseResponseBody(response);

			// 检查响应状态
			if (!response.ok) {
				// 服务器返回了错误状态码，获取详细的错误信息
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
				// 有响应但状态码不是2xx
				requestError = await this.handleErrorResponse(response, error);
			} else if (
				error &&
				typeof error === 'object' &&
				'code' in error &&
				'message' in error
			) {
				// 如果是我们抛出的错误（已经包含了服务器错误信息），直接使用
				requestError = error as RequestError;
			} else {
				// 网络错误等其他错误
				requestError = this.handleNetworkError(error);
			}

			// 显示错误提示
			Toast({
				type: 'error',
				title:
					requestError?.data?.data?.error?.message ||
					requestError?.data?.data?.message ||
					requestError.message,
			});

			// 抛出错误，让调用者可以继续处理
			throw requestError.data.data || requestError;
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

// 使用示例：
/*
// 1. 基本使用
async function login(credentials) {
	try {
		const response = await http.post('/auth/login', credentials);
		if (response.success) {
			console.log('登录成功:', response.data);
			return response.data;
		} else {
			console.warn('登录失败:', response.message);
			return null;
		}
	} catch (error) {
		console.error('请求错误详情:', {
			状态码: error.code,
			错误信息: error.message,
			详细错误: error.error,
			是否成功: error.success
		});
		
		// 可以根据具体错误类型做不同处理
		if (error.error === '验证码错误') {
			// 刷新验证码
			refreshCaptcha();
		}
		
		return null;
	}
}

// 2. GET 请求示例
http.get('/users/1', {
	querys: { include: 'profile' }
})
	.then(response => console.log(response.data))
	.catch(error => console.error(error));

// 3. POST 请求示例
http.post('/users', {
	name: '张三',
	email: 'zhangsan@example.com'
}, {
	headers: {
		'X-Custom-Header': 'value'
	}
});

// 4. 上传文件
const formData = new FormData();
formData.append('file', file);
formData.append('name', '文件名');

http.post('/upload', formData, {
	headers: {
		'Content-Type': 'multipart/form-data'
	}
});

// 5. 设置认证 token
http.setAuthToken('your-jwt-token-here');

// 6. 创建特定实例
const apiClient = createHttpClient('https://api.example.com', {
	headers: {
		'X-API-Key': 'your-api-key'
	}
});
*/

export default HttpClient;
