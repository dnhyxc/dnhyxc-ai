import fs from 'node:fs';
import path from 'node:path';
import type {
	CliGlobalFlags,
	ReleaseKitConfigFile,
	ResolvedReleaseKit,
} from './types.js';

const DEFAULT_CONFIG_NAMES = ['release-kit.config.json'] as const;

/** 与 parseGlobalArgv 配合：先定位子命令，再解析其前的全局参数 */
export const SUBCOMMANDS = new Set([
	'bump-version',
	'update-latest',
	'upload-release',
	'upload-dmg',
	'wiki-sync-update-info',
	'wiki-sync-guide',
	'help',
]);

/** 可从子命令之后出现的全局参数（与其取值） */
const GLOBAL_FLAGS_WITH_VALUE = new Set([
	'--config',
	'--root',
	'--tauri-config',
	'--latest-json',
	'--macos-tar-gz',
	'--macos-sig',
	'--dmg-bundle-dir',
	'--wiki-update-md',
	'--wiki-guide-md',
	'--dotenv',
]);

function partitionAfterSubcommand(after: string[]): {
	globals: string[];
	commandArgs: string[];
} {
	const globals: string[] = [];
	const rest: string[] = [];
	let i = 0;
	while (i < after.length) {
		const a = after[i];
		if (GLOBAL_FLAGS_WITH_VALUE.has(a)) {
			globals.push(a);
			const next = after[i + 1];
			if (next !== undefined && !next.startsWith('--')) {
				globals.push(next);
				i += 2;
				continue;
			}
			i += 1;
			continue;
		}
		rest.push(a);
		i += 1;
	}
	return { globals, commandArgs: rest };
}

export function splitCommandArgv(argv: string[]): {
	globalArgv: string[];
	command: string;
	commandArgs: string[];
} {
	const idx = argv.findIndex((a) => SUBCOMMANDS.has(a));
	if (idx === -1) {
		return { globalArgv: argv, command: '', commandArgs: [] };
	}
	const before = argv.slice(0, idx);
	const after = argv.slice(idx + 1);
	const { globals, commandArgs } = partitionAfterSubcommand(after);
	return {
		globalArgv: [...before, ...globals],
		command: argv[idx],
		commandArgs,
	};
}

function tryReadJson(filePath: string): ReleaseKitConfigFile | null {
	if (!fs.existsSync(filePath)) return null;
	const raw = fs.readFileSync(filePath, 'utf-8');
	try {
		return JSON.parse(raw) as ReleaseKitConfigFile;
	} catch {
		throw new Error(`配置文件 JSON 解析失败: ${filePath}`);
	}
}

function findDefaultConfig(startDir: string): string | null {
	let dir = path.resolve(startDir);
	const root = path.parse(dir).root;
	while (true) {
		for (const name of DEFAULT_CONFIG_NAMES) {
			const p = path.join(dir, name);
			if (fs.existsSync(p)) return p;
		}
		if (dir === root) break;
		dir = path.dirname(dir);
	}
	return null;
}

function resolveUserPath(base: string, p: string): string {
	if (path.isAbsolute(p)) return path.normalize(p);
	return path.resolve(base, p);
}

/**
 * 解析 CLI 全局参数（不含子命令及其位置参数）。
 */
export function parseGlobalArgv(argv: string[]): {
	flags: CliGlobalFlags;
	rest: string[];
} {
	const flags: CliGlobalFlags = {};
	const rest: string[] = [];
	for (let i = 0; i < argv.length; i++) {
		const a = argv[i];
		if (a === '--config') {
			flags.configPath = argv[++i];
			continue;
		}
		if (a === '--root') {
			flags.root = argv[++i];
			continue;
		}
		if (a === '--tauri-config') {
			flags.tauriConfig = argv[++i];
			continue;
		}
		if (a === '--latest-json') {
			flags.latestJson = argv[++i];
			continue;
		}
		if (a === '--macos-tar-gz') {
			flags.macosTarGz = argv[++i];
			continue;
		}
		if (a === '--macos-sig') {
			flags.macosSig = argv[++i];
			continue;
		}
		if (a === '--dmg-bundle-dir') {
			flags.dmgBundleDir = argv[++i];
			continue;
		}
		if (a === '--wiki-update-md') {
			flags.wikiUpdateSourceMd = argv[++i];
			continue;
		}
		if (a === '--wiki-guide-md') {
			flags.wikiGuideSourceMd = argv[++i];
			continue;
		}
		if (a === '--dotenv') {
			flags.dotenvPath = argv[++i];
			continue;
		}
		if (a.startsWith('--')) {
			throw new Error(`未知全局参数: ${a}`);
		}
		rest.push(a);
	}
	return { flags, rest };
}

export function loadResolvedReleaseKit(
	cwd: string,
	flags: CliGlobalFlags,
): ResolvedReleaseKit {
	const configPath = flags.configPath
		? resolveUserPath(cwd, flags.configPath)
		: findDefaultConfig(cwd);

	const fileConfig: ReleaseKitConfigFile = configPath
		? (tryReadJson(configPath) ?? {})
		: {};

	const configDir = configPath ? path.dirname(configPath) : cwd;
	const rootFromConfig = fileConfig.root
		? resolveUserPath(configDir, fileConfig.root)
		: configDir;
	const root = flags.root ? resolveUserPath(cwd, flags.root) : rootFromConfig;

	const p = fileConfig.paths ?? {};

	const paths = {
		tauriConfig: flags.tauriConfig
			? resolveUserPath(cwd, flags.tauriConfig)
			: p.tauriConfig
				? resolveUserPath(root, p.tauriConfig)
				: undefined,
		latestJson: flags.latestJson
			? resolveUserPath(cwd, flags.latestJson)
			: p.latestJson
				? resolveUserPath(root, p.latestJson)
				: undefined,
		macosTarGz: flags.macosTarGz
			? resolveUserPath(cwd, flags.macosTarGz)
			: p.macosTarGz
				? resolveUserPath(root, p.macosTarGz)
				: undefined,
		macosSig: flags.macosSig
			? resolveUserPath(cwd, flags.macosSig)
			: p.macosSig
				? resolveUserPath(root, p.macosSig)
				: undefined,
		dmgBundleDir: flags.dmgBundleDir
			? resolveUserPath(cwd, flags.dmgBundleDir)
			: p.dmgBundleDir
				? resolveUserPath(root, p.dmgBundleDir)
				: undefined,
		wikiUpdateSourceMd: flags.wikiUpdateSourceMd
			? resolveUserPath(cwd, flags.wikiUpdateSourceMd)
			: p.wikiUpdateSourceMd
				? resolveUserPath(root, p.wikiUpdateSourceMd)
				: undefined,
		wikiGuideSourceMd: flags.wikiGuideSourceMd
			? resolveUserPath(cwd, flags.wikiGuideSourceMd)
			: p.wikiGuideSourceMd
				? resolveUserPath(root, p.wikiGuideSourceMd)
				: undefined,
	};

	const uploadExtraFiles = (fileConfig.upload?.extraFiles ?? []).map((rel) =>
		resolveUserPath(root, rel),
	);

	return {
		root,
		configPath: configPath ? path.normalize(configPath) : null,
		config: fileConfig,
		paths,
		latestJsonPlatformKey: fileConfig.latestJsonPlatformKey ?? 'darwin-aarch64',
		uploadExtraFiles,
	};
}

export function requirePath(
	label: string,
	value: string | undefined,
	hint: string,
): string {
	if (!value) {
		console.error(`❌ 缺少路径配置: ${label}`);
		console.error(`   ${hint}`);
		process.exit(1);
	}
	return value;
}
