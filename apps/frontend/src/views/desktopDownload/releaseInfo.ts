import bundledLatest from '../../../latest.json';

/** 与 Tauri updater 使用的 GitHub Release 资源根路径一致时可省略 env */
const DEFAULT_RELEASE_BASE =
	'https://github.com/dnhyxc/dnhyxc-ai-app/releases/download/latest';

const DEFAULT_GITHUB_REPO_RELEASES =
	'https://github.com/dnhyxc/dnhyxc-ai-app/releases';
const DEFAULT_GITHUB_LATEST_TAG_PAGE =
	'https://github.com/dnhyxc/dnhyxc-ai-app/releases/tag/latest';

/** GitHub Releases 列表（含各历史版本的 dmg 等附件） */
export function getDesktopGithubReleasesPageUrl(): string {
	return (
		import.meta.env.VITE_DESKTOP_GITHUB_RELEASES_PAGE_URL?.trim() ||
		DEFAULT_GITHUB_REPO_RELEASES
	);
}

/** GitHub 上 `latest` 标签发行页（滚动最新构建） */
export function getDesktopGithubLatestTagPageUrl(): string {
	return (
		import.meta.env.VITE_DESKTOP_GITHUB_LATEST_TAG_PAGE_URL?.trim() ||
		DEFAULT_GITHUB_LATEST_TAG_PAGE
	);
}

export type BundledDesktopRelease = {
	version: string;
	pubDate: string | undefined;
	/** 自动更新用的 macOS arm64 压缩包（与 updater 一致） */
	macAarch64TarGzUrl: string | undefined;
	/** 面向用户的 dmg 直链（发布脚本命名约定） */
	macAarch64DmgUrl: string;
};

/** 读取构建时打入的 latest.json，拼接 dmg 等下载地址；发版前请先更新该 manifest 再构建前端。 */
export function getBundledDesktopRelease(): BundledDesktopRelease {
	const raw = bundledLatest as {
		version?: string;
		pub_date?: string;
		platforms?: Record<string, { url?: string }>;
	};
	const version = raw.version ?? '0.0.0';
	const platform = raw.platforms?.['darwin-aarch64'];
	const base =
		(
			import.meta.env.VITE_DESKTOP_GITHUB_RELEASE_BASE_URL as string | undefined
		)?.trim() || DEFAULT_RELEASE_BASE;
	const dmgOverride = (
		import.meta.env.VITE_DESKTOP_MACOS_AARCH64_DMG_URL as string | undefined
	)?.trim();
	const dmgUrl =
		dmgOverride ||
		`${base.replace(/\/$/, '')}/dnhyxc-ai_${version}_aarch64.dmg`;

	return {
		version,
		pubDate: raw.pub_date,
		macAarch64TarGzUrl: platform?.url,
		macAarch64DmgUrl: dmgUrl,
	};
}
