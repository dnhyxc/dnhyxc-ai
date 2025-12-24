import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Logs } from '../logs/logs.entity';
import { Roles } from '../roles/roles.entity';
import { RolesService } from '../roles/roles.service';
import { Profile } from './profile.entity';
import { UserController } from './user.controller';
import { User } from './user.entity';
import { UserService } from './user.service';

// 将 UserModule 设置为全局的，其他模块就不需要在 Module 中 imports 中单独引入了
@Global()
@Module({
	// 引入 User 数据库模块，利于在 Service 中使用，否则 Service 将无法使用 User 数据库的实例
	imports: [TypeOrmModule.forFeature([User, Roles, Logs, Profile])],
	providers: [UserService, RolesService],
	controllers: [UserController],
	// 导出 UserService，便于在其他模块中引用
	exports: [UserService],
})
export class UserModule {}
