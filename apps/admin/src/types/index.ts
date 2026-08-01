/**
 * 后端用户实体 (user.entity.ts)
 */
export interface User {
	id: number;
	username: string;
	email: string;
	createTime: string;
	isMember: boolean;
	membershipType: string;
	memberExpiresAt: string | null;
	roles?: Role[];
	profile?: Profile;
	logs?: SystemLog[];
}

export interface Profile {
	gender?: string;
	photo?: string;
	address?: string;
}

/**
 * 后端角色实体 (roles.entity.ts)
 */
export interface Role {
	id: number;
	name: string;
	description: string;
	users?: User[];
	menus?: Menu[];
}

/**
 * 后端菜单实体 (menus.entity.ts)
 */
export interface Menu {
	id: number;
	name: string;
	path: string;
	order: number;
	acl: string;
	roles?: Role[];
}

/**
 * 后端日志实体 (logs.entity.ts)
 */
export interface SystemLog {
	id: number;
	path: string;
	method: string;
	data: string;
	result: number;
	user?: User;
}

/**
 * 登录请求 DTO (LoginUserDTO)
 */
export interface LoginRequest {
	username: string;
	password: string;
	captchaText: string;
	captchaId: string;
}

/**
 * 登录响应（auth.service.ts login 方法返回）
 */
export interface LoginResponse {
	access_token: string;
	id: number;
	username: string;
	email: string;
	createTime: string;
	isMember: boolean;
	membershipType: string;
	memberExpiresAt: string | null;
	roles?: Role[];
	profile?: Profile;
}

/**
 * 验证码响应（auth.service.ts createVerifyCode 方法返回）
 */
export interface CaptchaResponse {
	captcha: string;
	captchaId: string;
}

/**
 * 后端统一响应格式（ResponseInterceptor）
 */
export interface ApiResponse<T> {
	data: T;
	code: number;
	message: string;
	success: boolean;
}

/**
 * 分页查询参数 (GetUserDto)
 */
export interface PaginationParams {
	pageNo?: number;
	pageSize?: number;
	username?: string;
	role?: number;
	[key: string]: unknown;
}

/**
 * 创建用户 DTO (CreateUserDTO)
 */
export interface CreateUserPayload {
	username: string;
	password: string;
	roles?: number[];
}

/**
 * 更新用户 DTO (UpdateUserDTO)
 */
export interface UpdateUserPayload {
	id: number;
	username?: string;
	password?: string;
	roles?: number[];
	profile?: Profile;
}

/**
 * 创建角色 DTO (CreateRoleDto)
 */
export interface CreateRolePayload {
	name: string;
	description?: string;
	menuIds?: number[];
}

/**
 * 更新角色 DTO (UpdateRoleDto)
 */
export interface UpdateRolePayload {
	id: number;
	name?: string;
	description?: string;
	menuIds?: number[];
}

/**
 * 创建菜单 DTO (CreateMenuDto)
 */
export interface CreateMenuPayload {
	name: string;
	path: string;
	order?: number;
	acl?: string;
}

/**
 * 更新菜单 DTO (UpdateMenuDto)
 */
export type UpdateMenuPayload = Partial<CreateMenuPayload>;

/**
 * 书籍信息（基于 ebook-book.entity.ts）
 */
export interface Ebook {
	id: string;
	title: string;
	author?: string;
	cover?: string;
	categoryId?: string;
	category?: { id: string; name: string };
	fileSize?: number;
	totalChapters?: number;
	userId?: number;
	isPublic?: boolean;
	status?: string;
	createTime?: string;
	updateTime?: string;
}

/**
 * 对话会话（基于 chat.entity.ts / session.entity.ts）
 */
export interface ChatSession {
	id: string;
	title: string;
	userId?: number;
	user?: User;
	type?: string;
	messageCount?: number;
	lastMessageAt?: string;
	createTime?: string;
	updateTime?: string;
}

/**
 * 知识库（基于 knowledge.entity.ts）
 */
export interface Knowledge {
	id: string;
	title: string;
	description?: string;
	userId?: number;
	user?: User;
	docCount?: number;
	chunkCount?: number;
	isPublic?: boolean;
	createTime?: string;
	updateTime?: string;
}

/**
 * 仪表盘统计数据
 */
export interface DashboardStats {
	totalUsers: number;
	activeUsersToday: number;
	totalEbooks: number;
	totalChats: number;
	totalRevenue: number;
	newUsersThisWeek: number;
	usersGrowth: { date: string; count: number }[];
	moduleUsage: { name: string; count: number }[];
	membershipDistribution: { name: string; value: number }[];
}

/**
 * 会员订单
 */
export interface MembershipOrder {
	id: number;
	orderNo: string;
	userId: number;
	user?: User;
	plan: string;
	amount: number;
	paymentMethod: string;
	status: string;
	paidAt?: string;
	expireAt?: string;
	createTime: string;
}
