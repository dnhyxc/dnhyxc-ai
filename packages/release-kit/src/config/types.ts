/** release-kit.config.json 结构与内存合并结果 */

export type ReleaseKitWikiTarget = {
	owner?: string;
	repo?: string;
	pageFile?: string;
};

export type ReleaseKitConfigFile = {
	root?: string;
	paths?: {
		tauriConfig?: string;
		latestJson?: string;
		macosTarGz?: string;
		macosSig?: string;
		dmgBundleDir?: string;
		wikiUpdateSourceMd?: string;
		wikiGuideSourceMd?: string;
	};
	/** Tauri updater：写入 latest.json 内 platforms 的键，默认 darwin-aarch64 */
	latestJsonPlatformKey?: string;
	wiki?: {
		updateInfo?: ReleaseKitWikiTarget;
		guide?: ReleaseKitWikiTarget;
	};
	upload?: {
		/** 除默认列表外额外上传的制品（相对 root） */
		extraFiles?: string[];
	};
};

export type CliGlobalFlags = {
	configPath?: string;
	root?: string;
	tauriConfig?: string;
	latestJson?: string;
	macosTarGz?: string;
	macosSig?: string;
	dmgBundleDir?: string;
	wikiUpdateSourceMd?: string;
	wikiGuideSourceMd?: string;
	dotenvPath?: string;
};

/** 绝对路径上下文（供各子命令使用） */
export type ResolvedReleaseKit = {
	/** 工程根目录（解析相对路径的基准） */
	root: string;
	configPath: string | null;
	config: ReleaseKitConfigFile;
	paths: {
		tauriConfig?: string;
		latestJson?: string;
		macosTarGz?: string;
		macosSig?: string;
		dmgBundleDir?: string;
		wikiUpdateSourceMd?: string;
		wikiGuideSourceMd?: string;
	};
	latestJsonPlatformKey: string;
	uploadExtraFiles: string[];
};
