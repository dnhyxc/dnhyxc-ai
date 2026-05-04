import { requirePath } from '../../config/resolve.js';
import type { ResolvedReleaseKit } from '../../config/types.js';
import { pushMarkdownToWiki } from '../../wiki/wiki-push.js';

export function runWikiSyncGuide(ctx: ResolvedReleaseKit): number {
	if (
		process.env.SKIP_WIKI_APP_SYNC === '1' ||
		process.env.SKIP_WIKI_APP_SYNC === 'true'
	) {
		console.log('⏭️  已设置 SKIP_WIKI_APP_SYNC，跳过 Wiki 同步');
		return 0;
	}

	const TOKEN = process.env.GITHUB_TOKEN;
	if (!TOKEN) {
		console.error('❌ 未设置 GITHUB_TOKEN，无法推送 Wiki');
		return 1;
	}

	const source = requirePath(
		'wikiGuideSourceMd',
		ctx.paths.wikiGuideSourceMd,
		'请配置 paths.wikiGuideSourceMd 或使用 --wiki-guide-md',
	);

	const cfg = ctx.config.wiki?.guide ?? {};
	const OWNER = process.env.WIKI_APP_OWNER ?? cfg.owner ?? '';
	const REPO = process.env.WIKI_APP_REPO ?? cfg.repo ?? '';
	const pageFile =
		process.env.WIKI_APP_INTRO_FILE ?? cfg.pageFile ?? 'Guide.md';

	if (!OWNER || !REPO) {
		console.error(
			'❌ 缺少 Wiki 目标仓库：请在配置 wiki.guide.owner/repo 或设置 WIKI_APP_OWNER、WIKI_APP_REPO',
		);
		return 1;
	}

	return pushMarkdownToWiki({
		token: TOKEN,
		owner: OWNER,
		repo: REPO,
		pageFile,
		sourceMdPath: source,
		commitMessage: 'docs: sync product guide (release-kit)',
		logTitle: '同步 Wiki：产品/教程文档',
	});
}
