import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserController } from './user.controller';
import { User } from './user.entity';
import { UserService } from './user.service';

@Module({
	// 引入 User 数据库模块，利于在 Service 中使用，否则 Service 将无法使用 User 数据库的实例
	imports: [TypeOrmModule.forFeature([User])],
	providers: [UserService],
	controllers: [UserController],
})
export class UserModule {}
