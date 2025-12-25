import { Module } from '@nestjs/common';
import { MenusController } from './menus.controller';
import { MenusService } from './menus.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Menus } from './menus.entity';

@Module({
	imports: [TypeOrmModule.forFeature([Menus])],
	controllers: [MenusController],
	providers: [MenusService],
})
export class MenusModule {}
