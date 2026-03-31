import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { Injectable } from '@nestjs/common';

/** 将标题转为安全的 .md 文件名（不含路径） */
function toSafeBasename(title: string): string {
	const base = title.trim() || `未命名-${Date.now()}`;
	const safe = base
		.replace(/[/\\?%*:|"<>]/g, '-')
		.replace(/\s+/g, '_')
		.slice(0, 120);
	return `${safe}.md`;
}

@Injectable()
export class KnowledgeService {
	/** 知识库目录：KNOWLEDGE_DIR 优先；否则为 monorepo 根下 knowledge（自 apps/backend 启动时 cwd 为 backend） */
	getKnowledgeDir(): string {
		const envDir = process.env.KNOWLEDGE_DIR?.trim();
		if (envDir) {
			return envDir;
		}
		return join(process.cwd(), '..', '..', 'knowledge');
	}

	async saveMarkdown(title: string | undefined, content: string) {
		const dir = this.getKnowledgeDir();
		await mkdir(dir, { recursive: true });
		const filename = toSafeBasename(title ?? '');
		const filePath = join(dir, filename);
		await writeFile(filePath, content, 'utf8');
		return { filePath, filename };
	}
}
