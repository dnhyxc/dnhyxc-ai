import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MenusController } from './menus.controller';
import { Menus } from './menus.entity';
import { MenusService } from './menus.service';

@Module({
	imports: [TypeOrmModule.forFeature([Menus])],
	controllers: [MenusController],
	providers: [MenusService],
	exports: [MenusService],
})
export class MenusModule {}
