import axios from 'axios';

const instance = axios.create({
	baseURL: '/api',
	timeout: 60000,
});

// 请求拦截器
instance.interceptors.request.use(
	// 在发送请求之前做些什么
	function (config) {
		return config;
	},
	// 对请求错误做些什么
	function (error) {
		return Promise.reject(error);
	},
);

// 响应拦截器
instance.interceptors.response.use(
	function (response) {
		if (response.status === 200) {
			return response.data;
		}
		return response;
	},
	// 超出 2xx 范围内的状态码都会触发该函数。
	function (error) {
		return Promise.reject(error);
	},
);

export default instance;
