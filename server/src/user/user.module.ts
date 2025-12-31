import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Logs } from '../logs/logs.entity';
import { Menus } from '../menus/menus.entity';
import { Roles } from '../roles/roles.entity';
import { RolesService } from '../roles/roles.service';
import { Profile } from './profile.entity';
import { UserController } from './user.controller';
import { User } from './user.entity';
import { UserService } from './user.service';

// Global 将 UserModule 设置为全局的，其他模块就不需要在 Module 中 imports 中单独引入了
@Global()
@Module({
	// 引入 User Roles 等数据库模块，利于在 Service 中使用，否则将无法在 service 注入使用 User Roles 等数据库的实例
	imports: [TypeOrmModule.forFeature([User, Roles, Logs, Profile, Menus])],
	// providers 数组用于声明当前模块中可以被注入（依赖注入）的提供者（服务、工厂、值等）。
	// 这里将 UserService 和 RolesService 注册为提供者，使得它们可以在 UserModule 内部或其他引入该模块的地方通过构造函数注入使用。
	providers: [UserService, RolesService],
	controllers: [UserController],
	// 导出 UserService，便于在其他模块中引用，这里即使使用 Global 设置为了全局模块，也需要将 UserService 添加到 exports 中
	exports: [UserService],
})
export class UserModule {}
