import {
	Body,
	Controller,
	Delete,
	Get,
	Param,
	Patch,
	Post,
	UseInterceptors,
} from '@nestjs/common';
import { ResponseInterceptor } from '../interceptors/response.interceptor';
import { CreatePromptDto } from './dto/create-prompt.dto';
import { UpdatePromptDto } from './dto/update-prompt.dto';
import { PromptService } from './prompt.service';

@Controller('prompt')
@UseInterceptors(ResponseInterceptor)
export class PromptController {
	constructor(private readonly promptService: PromptService) {}

	@Post('/create')
	create(@Body() createPromptDto: CreatePromptDto) {
		return this.promptService.create(createPromptDto);
	}

	@Get('/list')
	findAll() {
		return this.promptService.findAll();
	}

	@Get('/detail/:id')
	findOne(@Param('id') id: string) {
		return this.promptService.findOne(+id);
	}

	@Patch('/update/:id')
	update(@Param('id') id: string, @Body() updatePromptDto: UpdatePromptDto) {
		return this.promptService.update(+id, updatePromptDto);
	}

	@Delete('/delete/:id')
	remove(@Param('id') id: string) {
		return this.promptService.remove(+id);
	}
}
