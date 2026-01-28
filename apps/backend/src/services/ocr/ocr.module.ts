import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OcrController } from './ocr.controller';
import { Ocr } from './ocr.entity';
import { OcrService } from './ocr.service';

@Module({
	imports: [TypeOrmModule.forFeature([Ocr])],
	controllers: [OcrController],
	providers: [OcrService],
})
export class OcrModule {}
