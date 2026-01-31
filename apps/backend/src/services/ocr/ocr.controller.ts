import {
	Body,
	ClassSerializerInterceptor,
	Controller,
	Delete,
	Get,
	Param,
	Post,
	Sse,
	UseGuards,
	UseInterceptors,
} from '@nestjs/common';
import {
	catchError,
	concat,
	defer,
	from,
	map,
	mergeMap,
	Observable,
	of,
} from 'rxjs';
import { JwtGuard } from 'src/guards/jwt.guard';
import { SwaggerController } from '../user/user.swagger';
import { CreateOcrDto } from './dto/create-ocr.dto';
import { OcrService } from './ocr.service';

@Controller('ocr')
@SwaggerController()
@UseGuards(JwtGuard)
@UseInterceptors(ClassSerializerInterceptor)
export class OcrController {
	constructor(private readonly ocrService: OcrService) {}

	@Post('/imageOcr')
	@Sse()
	imageOcr(@Body() dto: CreateOcrDto): Observable<any> {
		// 使用 defer 延迟执行
		return defer(() => this.ocrService.imageOcrStream(dto)).pipe(
			mergeMap((stream) => {
				// 将流转换为 Observable
				const dataStream = from(stream).pipe(
					map((chunk) => ({
						data: {
							content: chunk,
							done: false,
						},
					})),
				);

				// 完成标识
				const doneStream = of({
					data: {
						done: true,
					},
				});

				// 合并流
				return concat(dataStream, doneStream);
			}),
			catchError((error) => {
				// 错误处理
				return of({
					data: {
						error: error.message || '处理失败',
						done: true,
					},
				});
			}),
		);
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
