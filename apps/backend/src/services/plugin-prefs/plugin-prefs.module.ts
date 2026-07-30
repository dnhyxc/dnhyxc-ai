import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PluginPrefsController } from './plugin-prefs.controller';
import { PluginPrefsService } from './plugin-prefs.service';
import { PluginUserPrefs } from './plugin-user-prefs.entity';

@Module({
	imports: [TypeOrmModule.forFeature([PluginUserPrefs])],
	controllers: [PluginPrefsController],
	providers: [PluginPrefsService],
	exports: [PluginPrefsService],
})
export class PluginPrefsModule {}
