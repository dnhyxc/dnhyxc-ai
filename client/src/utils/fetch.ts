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
}

// HTTP 请求类
class HttpClient {
	private baseURL: string;
	private defaultConfig: RequestConfig;

	constructor(
		baseURL: string = 'http://101.34.214.188:9112/api',
		config: RequestConfig = {},
	) {
		this.baseURL = baseURL;
		this.defaultConfig = {
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Bearer ${getStorage('token')}`,
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
		console.log(paramPath, 'paramPath', `${url}/${paramPath}`);
		return `${url}/${paramPath}`;
	}

	// 处理 URL 参数
	private handleUrlQuerys(
		url: string,
		querys?: Record<string, any>, // query 参数
	): string {
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

	// 错误处理
	private handleError(error: any): RequestError {
		if (error && typeof error === 'object') {
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

		try {
			// 发送请求
			const response: Response = await fetch(finalUrl, requestOptions);

			// 检查响应状态
			if (!response.ok) {
				throw {
					status: response.status,
					message: `HTTP ${response.status}: ${response.statusText}`,
				};
			}

			// 解析响应数据
			const contentType = response.headers.get('content-type') || '';
			let data: any;

			if (contentType.includes('application/json')) {
				data = await response.json();
			} else if (contentType.includes('text/')) {
				data = await response.text();
			} else {
				data = await response.arrayBuffer();
			}

			console.log(data, 'data--------data', response);

			// 返回标准化响应
			return {
				code: response.status,
				data: (data.data || data) as T,
				success: (data.data || data).success || true,
				message: (data.data || data).message || '请求成功',
			};
		} catch (error) {
			console.log(error, 'error-catch-request');
			// 错误处理
			const requestError = this.handleError(error);
			console.log(requestError, 'requestError');
			Toast({
				type: 'error',
				title: requestError.message,
			});
			throw new Error(requestError.message);
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

// 用法示例
/*
// 1. 使用默认实例
http.get('/api/users', { params: { page: 1, limit: 10 } })
  .then(response => console.log(response.data))
  .catch(error => console.error(error))

// 2. 创建带基础 URL 的实例
const api = createHttpClient('https://api.example.com')

// 3. GET 请求带参数
api.get('/users', {
  params: {
    page: 1,
    limit: 20,
    sort: 'createdAt'
  }
})

// 4. POST 请求
api.post('/users', {
  name: 'John',
  email: 'john@example.com'
}, {
  headers: {
    'X-Custom-Header': 'value'
  }
})

// 5. PUT 请求
api.put('/users/1', {
  name: 'John Updated'
})

// 6. DELETE 请求
api.delete('/users/1')

// 7. 设置认证 token
api.setAuthToken('your-jwt-token')

// 8. 上传文件
const fileInput = document.getElementById('file') as HTMLInputElement
const file = fileInput.files?.[0]

api.post('/upload', { file }, {
  headers: {
    'Content-Type': 'multipart/form-data'
  }
})

// 9. 错误处理
try {
  const response = await api.get('/some-endpoint')
  // 处理响应
} catch (error) {
  console.error(`错误代码: ${error.code}, 错误信息: ${error.message}`)
}
*/

export default HttpClient;
