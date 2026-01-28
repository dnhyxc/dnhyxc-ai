import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';
import { CreateOcrDto } from './dto/create-ocr.dto';
import { OcrService } from './ocr.service';

@Controller('ocr')
export class OcrController {
	constructor(private readonly ocrService: OcrService) {}

	@Post('/ocrByUrl')
	async ocrByUrl(@Body() dto: CreateOcrDto): Promise<any> {
		return await this.ocrService.ocrByUrl(dto);
	}

	@Get()
	findAll() {
		return this.ocrService.findAll();
	}

	@Get(':id')
	findOne(@Param('id') id: string) {
		return this.ocrService.findOne(+id);
	}

	@Delete(':id')
	remove(@Param('id') id: string) {
		return this.ocrService.remove(+id);
	}
}
