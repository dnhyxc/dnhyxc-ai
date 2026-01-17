import { applyDecorators } from '@nestjs/common';
import {
	ApiBearerAuth,
	ApiBody,
	ApiOperation,
	ApiParam,
	ApiQuery,
	ApiResponse,
} from '@nestjs/swagger';

// 用户相关操作的 Swagger 装饰器，生成 api docs 参数及响应等信息
export function SwaggerAddUser() {
	return applyDecorators(
		ApiOperation({ summary: '新增用户', description: '新增用户接口' }),
		ApiResponse({
			status: 200,
			description: '创建用户成功',
			schema: {
				default: {
					id: 1,
					username: 'admin',
					roles: [{ id: 2, name: 'admin' }],
				},
			},
		}),
	);
}

export function SwaggerGetUsers() {
	return applyDecorators(
		ApiOperation({ summary: '获取用户列表', description: '获取用户列表接口' }),
		ApiQuery({
			name: 'page',
			description: '页码',
			required: false,
		}),
		ApiQuery({
			name: 'limit',
			description: '每页数量',
			required: false,
		}),
		ApiQuery({
			name: 'username',
			description: '用户名称',
			required: false,
		}),
		ApiQuery({
			name: 'role',
			description: '角色id',
			required: false,
		}),
		ApiQuery({
			name: 'gender',
			description: '用户性别',
			required: false,
		}),
		ApiResponse({
			status: 200,
			description: '获取用户列表成功',
			schema: {
				default: [
					{
						id: 1,
						username: 'admin',
						roles: [{ id: 2, name: 'admin' }],
						profile: {
							id: 1,
							photo: 'photo.png',
							gender: '1',
							address: 'address',
						},
					},
				],
			},
		}),
	);
}

export function SwaggerGetUserById() {
	return applyDecorators(
		ApiOperation({
			summary: '根据id查询用户信息',
			description: '根据id查询用户信息接口',
		}),
		ApiParam({
			name: 'id',
			description: '用户id',
			required: true,
		}),
		ApiResponse({
			status: 200,
			description: '获取用户信息成功',
			schema: {
				default: {
					id: 1,
					username: 'admin',
					profile: {
						id: 1,
						photo: 'photo.png',
						gender: '1',
						address: 'address',
					},
				},
			},
		}),
	);
}

export function SwaggerUpdateUser() {
	return applyDecorators(
		ApiOperation({ summary: '更新用户信息', description: '更新用户信息接口' }),
		ApiBody({
			schema: {
				default: {
					id: 1,
					username: 'admin',
					roles: [2],
					profile: {
						photo: 'photo.png',
						gender: '1',
						address: 'address',
					},
				},
			},
		}),
		ApiResponse({
			status: 200,
			description: '请求成功',
			schema: {
				default: {
					id: 1,
					username: 'admin',
					roles: [{ id: 2, name: 'user' }],
					profile: {
						id: 1,
						photo: 'photo.png',
						gender: '1',
						address: 'address',
					},
				},
			},
		}),
	);
}

export function SwaggerDeleteUser() {
	return applyDecorators(
		ApiOperation({ summary: '删除用户', description: '删除用户接口' }),
		ApiParam({
			name: 'id',
			description: '用户id',
			required: true,
		}),
		ApiResponse({
			status: 200,
			description: '删除用户成功',
			schema: {
				default: {
					id: 1,
				},
			},
		}),
	);
}

export function SwaggerGetUserProfile() {
	return applyDecorators(
		ApiOperation({
			summary: '获取用户信息',
			description: '获取用户信息接口',
		}),
		ApiQuery({
			name: 'id',
			description: '用户id',
			required: true,
		}),
		ApiResponse({
			status: 200,
			description: '获取用户信息成功',
			schema: {
				default: {
					id: 1,
					username: 'admin',
					profile: {
						id: 1,
						photo: 'photo.png',
						gender: '1',
						address: 'address',
					},
				},
			},
		}),
	);
}

export function SwaggerGetUserLogs() {
	return applyDecorators(
		ApiOperation({
			summary: '获取用户日志信息',
			description: '获取用户日志信息接口',
		}),
		ApiParam({
			name: 'id',
			description: '用户id',
			required: true,
		}),
	);
}

export function SwaggerGetLogsByGroup() {
	return applyDecorators(
		ApiOperation({
			summary: '获取用户日志分组信息',
			description: '获取用户日志分组信息接口',
		}),
		ApiParam({
			name: 'id',
			description: '用户id',
			required: true,
		}),
	);
}

// 控制器级别的装饰器
export function SwaggerController() {
	return applyDecorators(ApiBearerAuth());
}
