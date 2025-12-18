import { Controller, Get, Post } from '@nestjs/common';
import { PromptService } from './prompt.service';

@Controller('prompt')
export class PromptController {
	constructor(private promptService: PromptService) {}
	@Get()
	getPrompt() {
		return this.promptService.getPrompt();
	}
	@Post()
	addPrompt(prompt: string) {
		console.log(prompt, 'prompt');
		return this.promptService.addPrompt(prompt);
	}
}
