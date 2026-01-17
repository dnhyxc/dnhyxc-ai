import { SetMetadata } from '@nestjs/common';
import { Role } from '../enum/roles.enum';

export const ROLES_KEY = 'roles';

/**
 * 使用 @SetMetadata 将传入的角色数组附加到路由处理器的元数据中。
 * 在守卫中可以通过 Reflector 取出该元数据，用于角色鉴权。
 */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
