import { Injectable } from '@nestjs/common';

@Injectable()
export class PromptService {
	getPrompt(): string {
		return 'This action returns all prompt';
	}

	addPrompt(prompt: string) {
		return {
			code: 200,
			data: prompt,
			message: '添加成功',
		};
	}
}
