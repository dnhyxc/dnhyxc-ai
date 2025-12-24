import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RolesController } from './roles.controller';
import { Roles } from './roles.entity';
import { RolesService } from './roles.service';

@Module({
	// 引入数据库模块，注册 Roles 表
	imports: [TypeOrmModule.forFeature([Roles])],
	controllers: [RolesController],
	providers: [RolesService],
})
export class RolesModule {}
