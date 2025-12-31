import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Menus } from '../menus/menus.entity';
import { RolesController } from './roles.controller';
import { Roles } from './roles.entity';
import { RolesService } from './roles.service';

@Module({
	// 引入数据库模块，注册 Roles 表，利于在 service 中注入使用 Roles 模块的实例进行数据库操作
	imports: [TypeOrmModule.forFeature([Roles, Menus])],
	controllers: [RolesController],
	// 注意如果需要在 RolesService 中使用 MenusService，需要通过 providers 将 MenusService 设置为提供者，否则，无法在 service 中实例化
	providers: [RolesService],
})
export class RolesModule {}
