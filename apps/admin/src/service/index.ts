import type {
	CaptchaResponse,
	ChatSession,
	CreateMenuPayload,
	CreateRolePayload,
	CreateUserPayload,
	DashboardStats,
	Ebook,
	Knowledge,
	LoginRequest,
	LoginResponse,
	MembershipOrder,
	Menu,
	PaginationParams,
	Role,
	SystemLog,
	UpdateMenuPayload,
	UpdateRolePayload,
	UpdateUserPayload,
	User,
} from '@/types';
import { apiDelete, apiGet, apiPatch, apiPost, apiPut } from './api';

/**
 * 认证 API
 * 后端路由前缀：/api/auth
 */
export const authApi = {
	/** 用户名密码登录（需图形验证码） POST /api/auth/login */
	login: (data: LoginRequest) => apiPost<LoginResponse>('/auth/login', data),
	/** 获取图形验证码 POST /api/auth/createVerifyCode */
	createVerifyCode: () => apiPost<CaptchaResponse>('/auth/createVerifyCode'),
	/** 邮箱验证码登录 POST /api/auth/loginByEmail */
	loginByEmail: (data: {
		email: string;
		verifyCode: number;
		verifyCodeKey: string;
	}) => apiPost<LoginResponse>('/auth/loginByEmail', data),
	/** 发送邮箱验证码 POST /api/auth/sendEmail */
	sendEmail: (
		email: string,
		options?: { key?: string; subject?: string; title?: string },
	) => apiPost<{ key: string }>('/auth/sendEmail', { email, options }),
	/** 注册 POST /api/auth/register */
	register: (data: {
		username: string;
		password: string;
		email: string;
		verifyCode: number;
		verifyCodeKey: string;
	}) => apiPost<User>('/auth/register', data),
	/** 退出登录（前端清除本地状态即可，后端无 logout 接口） */
	logout: () => Promise.resolve(),
};

/**
 * 用户管理 API
 * 后端路由前缀：/api/user（类级 JwtGuard）
 */
export const userApi = {
	/** 分页查询用户列表 GET /api/user/getUsers，返回 { list, total } */
	getList: (params?: PaginationParams) =>
		apiGet<{ list: User[]; total: number }>('/user/getUsers', { params }),
	/** 根据 ID 查询用户 GET /api/user/getUserById/:id */
	getById: (id: number) => apiGet<User>(`/user/getUserById/${id}`),
	/** 创建用户 POST /api/user/addUser */
	create: (data: CreateUserPayload) => apiPost<User>('/user/addUser', data),
	/** 更新用户 POST /api/user/updateUser */
	update: (data: UpdateUserPayload) => apiPost<User>('/user/updateUser', data),
	/** 删除用户 DELETE /api/user/deleteUser/:id */
	delete: (id: number) => apiDelete<void>(`/user/deleteUser/${id}`),
	/** 获取用户资料 GET /api/user/profile?id=xxx */
	getProfile: (id: number) => apiGet<User>('/user/profile', { params: { id } }),
	/** 获取用户日志 GET /api/user/getLogs/:id */
	getUserLogs: (id: number) => apiGet<unknown>(`/user/getLogs/${id}`),
};

/**
 * 角色管理 API
 * 后端路由前缀：/api/roles（类级 JwtGuard + RoleGuard）
 */
export const roleApi = {
	/** 获取所有角色 GET /api/roles/getRoles */
	getList: () => apiGet<Role[]>('/roles/getRoles'),
	/** 根据 ID 查询角色 GET /api/roles/getRoleById/:id */
	getById: (id: number) => apiGet<Role>(`/roles/getRoleById/${id}`),
	/** 创建角色 POST /api/roles/createRole */
	create: (data: CreateRolePayload) => apiPost<Role>('/roles/createRole', data),
	/** 更新角色 POST /api/roles/updateRole */
	update: (data: UpdateRolePayload) => apiPost<Role>('/roles/updateRole', data),
	/** 删除角色 DELETE /api/roles/deleteRoleById/:id */
	delete: (id: number) => apiDelete<void>(`/roles/deleteRoleById/${id}`),
};

/**
 * 菜单管理 API
 * 后端路由前缀：/api/menus（类级 JwtGuard + RoleGuard）
 */
export const menuApi = {
	/** 获取所有菜单 GET /api/menus/getMenus */
	getList: () => apiGet<Menu[]>('/menus/getMenus'),
	/** 根据 ID 查询菜单 GET /api/menus/getMenuById/:id */
	getById: (id: number) => apiGet<Menu>(`/menus/getMenuById/${id}`),
	/** 创建菜单 POST /api/menus/createMenu */
	create: (data: CreateMenuPayload) => apiPost<Menu>('/menus/createMenu', data),
	/** 更新菜单 PATCH /api/menus/updateMenu/:id */
	update: (id: number, data: UpdateMenuPayload) =>
		apiPatch<Menu>(`/menus/updateMenu/${id}`, data),
	/** 删除菜单 DELETE /api/menus/deleteMenuById/:id */
	delete: (id: number) => apiDelete<void>(`/menus/deleteMenuById/${id}`),
};

/**
 * 书籍管理 API
 * 后端路由前缀：/api/ebook（类级 JwtGuard）
 * 注意：后端 ebook 接口面向当前登录用户，无全量管理接口；
 * 后台管理可通过 shelf 接口获取当前管理员的书架列表。
 */
export const ebookApi = {
	/** 获取书架列表 GET /api/ebook/shelf */
	getShelf: (params?: Record<string, unknown>) =>
		apiGet<unknown>('/ebook/shelf', { params }),
	/** 删除书籍 DELETE /api/ebook/delete/:id */
	delete: (id: string) => apiDelete<void>(`/ebook/delete/${id}`),
	/** 更新书籍标题 PUT /api/ebook/title */
	updateTitle: (data: { bookId: string; title: string }) =>
		apiPut<void>('/ebook/title', data),
	/** 设置书籍可见性 PUT /api/ebook/book/:id/visibility */
	setVisibility: (id: string, isPublic: boolean) =>
		apiPut<void>(`/ebook/book/${id}/visibility`, { isPublic }),
};

/**
 * 对话管理 API
 * 后端路由前缀：/api/chat（类级 JwtGuard）
 */
export const chatApi = {
	/** 获取会话列表 GET /api/chat/getSessionList */
	getSessionList: (params?: { pageNo?: number; pageSize?: number }) =>
		apiGet<unknown>('/chat/getSessionList', { params }),
	/** 删除会话 DELETE /api/chat/delSession/:id */
	deleteSession: (id: string) => apiDelete<void>(`/chat/delSession/${id}`),
};

/**
 * 知识库管理 API
 * 后端路由前缀：/api/knowledge（类级 JwtGuard）
 */
export const knowledgeApi = {
	/** 获取知识库列表 GET /api/knowledge/list */
	getList: (params?: Record<string, unknown>) =>
		apiGet<unknown>('/knowledge/list', { params }),
	/** 获取知识库详情 GET /api/knowledge/detail/:id */
	getById: (id: string) => apiGet<Knowledge>(`/knowledge/detail/${id}`),
	/** 删除知识库 DELETE /api/knowledge/delete/:id */
	delete: (id: string) => apiDelete<void>(`/knowledge/delete/${id}`),
};

/**
 * 日志 API
 * 后端路由前缀：/api/logs（类级 JwtGuard + AdminGuard + CaslGuard）
 * 注意：后端 LogsService 当前为空实现，接口可能返回空数据。
 */
export const logApi = {
	/** 获取日志列表 */
	getList: (params?: Record<string, unknown>) =>
		apiGet<SystemLog[]>('/logs', { params }),
};

/**
 * 仪表盘统计 API
 * 后端目前无专门的统计接口，此处通过组合已有接口实现。
 */
export const dashboardApi = {
	/** 获取统计数据（组合调用） */
	getStats: async (): Promise<DashboardStats> => {
		// 后端无专门统计接口，通过 userApi.getList 获取用户总数等基础数据
		// 各接口并行调用，任一失败不影响整体
		const [usersRes, rolesRes, menusRes] = await Promise.allSettled([
			userApi.getList({ pageNo: 1, pageSize: 1 }),
			roleApi.getList(),
			menuApi.getList(),
		]);

		const totalUsers =
			usersRes.status === 'fulfilled' ? usersRes.value.total : 0;
		const totalRoles =
			rolesRes.status === 'fulfilled' ? rolesRes.value.length : 0;
		const totalMenus =
			menusRes.status === 'fulfilled' ? menusRes.value.length : 0;

		return {
			totalUsers,
			activeUsersToday: 0,
			totalEbooks: 0,
			totalChats: 0,
			totalRevenue: 0,
			newUsersThisWeek: 0,
			usersGrowth: [],
			moduleUsage: [],
			membershipDistribution: [],
		};
	},
};

/**
 * 会员/支付 API
 * 后端路由前缀：/api/pay
 * 注意：后端支付接口仅支持创建 Stripe Checkout 和完成会员，
 * 无订单列表查询接口。会员信息存储在 User 实体的 isMember/membershipType/memberExpiresAt 字段。
 */
export const membershipApi = {
	/** 创建支付会话 POST /api/pay/createCheckoutSession */
	createCheckoutSession: (data: { plan: string }) =>
		apiPost<unknown>('/pay/createCheckoutSession', data),
	/** 完成会员 POST /api/pay/completeMembership */
	completeMembership: (data: { sessionId: string }) =>
		apiPost<unknown>('/pay/completeMembership', data),
};
