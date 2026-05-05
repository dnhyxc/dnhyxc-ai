import { requirePath } from '../../config/resolve.js';
import type { ResolvedReleaseKit } from '../../config/types.js';
import {
	exitIfMissingEnv,
	logDotenvConfigurationHint,
} from '../../lib/required-env.js';
import { pushMarkdownToWiki } from '../../wiki/wiki-push.js';

export function runWikiSyncUpdateInfo(ctx: ResolvedReleaseKit): number {
	if (
		process.env.SKIP_WIKI_SYNC === '1' ||
		process.env.SKIP_WIKI_SYNC === 'true'
	) {
		console.log('⏭️  已设置 SKIP_WIKI_SYNC，跳过 Wiki 同步');
		return 0;
	}

	exitIfMissingEnv(
		ctx,
		['GITHUB_TOKEN'],
		'未设置 GITHUB_TOKEN，无法推送 Wiki。',
	);
	const TOKEN = process.env.GITHUB_TOKEN!;

	const source = requirePath(
		'wikiUpdateSourceMd',
		ctx.paths.wikiUpdateSourceMd,
		'请配置 paths.wikiUpdateSourceMd 或使用 --wiki-update-md',
	);

	const cfg = ctx.config.wiki?.updateInfo ?? {};
	const OWNER = process.env.WIKI_OWNER ?? process.env.OWNER ?? cfg.owner ?? '';
	const REPO = process.env.WIKI_REPO ?? process.env.APP_REPO ?? cfg.repo ?? '';
	const pageFile =
		process.env.WIKI_UPDATE_INFO_FILE ?? cfg.pageFile ?? 'Update-Info.md';

	if (!OWNER || !REPO) {
		console.error(
			'❌ 缺少 Wiki 目标仓库：请在配置 wiki.updateInfo.owner/repo 或设置 WIKI_OWNER、WIKI_REPO（或 OWNER、APP_REPO）',
		);
		logDotenvConfigurationHint(ctx);
		return 1;
	}

	return pushMarkdownToWiki({
		token: TOKEN,
		owner: OWNER,
		repo: REPO,
		pageFile,
		sourceMdPath: source,
		commitMessage: 'docs: sync update info (release-kit)',
		logTitle: '同步 Wiki：更新说明文档',
	});
}
