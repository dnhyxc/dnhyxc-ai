#!/usr/bin/env node
import { runPrintTauriSigningEnv } from '../commands/env/print-tauri-signing-env.js';
import { runUpdateLatest } from '../commands/release/update-latest.js';
import { runUploadDmg } from '../commands/release/upload-dmg.js';
import { runUploadRelease } from '../commands/release/upload-release.js';
import { runBumpVersion } from '../commands/version/bump-version.js';
import { runWikiSyncGuide } from '../commands/wiki/wiki-sync-guide.js';
import { runWikiSyncUpdateInfo } from '../commands/wiki/wiki-sync-update-info.js';
import { loadKitDotenv, resolveDotenvPath } from '../config/dotenv.js';
import {
	loadResolvedReleaseKit,
	parseGlobalArgv,
	splitCommandArgv,
} from '../config/resolve.js';

function printHelp(): void {
	console.log(`
release-kit — 通用 Tauri / GitHub Release 辅助 CLI

用法:
  release-kit [全局选项...] <子命令> [子命令参数...]

全局选项（可出现于子命令之前或之后）:
  --config <path>           配置文件（默认向上查找 release-kit.config.json）
  --root <path>             工程根目录
  --tauri-config <path>     tauri.conf.json
  --latest-json <path>      updater 用的 latest.json
  --macos-tar-gz <path>     macOS .tar.gz 更新包
  --macos-sig <path>        签名文件（可选）
  --dmg-bundle-dir <dir>    dmg 输出目录
  --wiki-update-md <path>   Wiki 更新说明源 Markdown
  --wiki-guide-md <path>    Wiki 教程源 Markdown
  --dotenv <path>           .env 路径（默认 <root>/.env）

子命令:
  bump-version [patch|minor|major]
  print-tauri-signing-env   从 .env 读取 TAURI_SIGNING_*，向 stdout 输出可 eval 的 export 行（供 tauri build 前注入）
  update-latest
  upload-release [--file <path>]...
  upload-dmg [dmg路径]
  wiki-sync-update-info
  wiki-sync-guide

环境变量（示例）:
  Tauri 签名（写入 <root>/.env，与 print-tauri-signing-env / tauri build 共用）:
    TAURI_SIGNING_PRIVATE_KEY, TAURI_SIGNING_PRIVATE_KEY_PASSWORD
  上传 GitHub Release:
    GITHUB_TOKEN, OWNER, APP_REPO, APP_TAG（默认 latest）

详见 README 与 release-kit.config.example.json
`);
}

async function main(): Promise<void> {
	const cwd = process.cwd();
	const raw = process.argv.slice(2);

	if (raw.length === 0 || raw[0] === '-h' || raw[0] === '--help') {
		printHelp();
		process.exit(raw.length === 0 ? 1 : 0);
	}

	const { globalArgv, command, commandArgs } = splitCommandArgv(raw);

	if (!command) {
		const { rest } = parseGlobalArgv(globalArgv);
		if (rest.length > 0 && rest[0] !== '-h' && rest[0] !== '--help') {
			console.error(`无法识别子命令，剩余参数: ${rest.join(' ')}`);
		}
		printHelp();
		process.exit(1);
	}

	if (command === 'help') {
		printHelp();
		process.exit(0);
	}

	const { flags, rest } = parseGlobalArgv(globalArgv);
	if (rest.length > 0) {
		console.error(`未知全局参数: ${rest.join(' ')}`);
		process.exit(1);
	}

	let ctx: ReturnType<typeof loadResolvedReleaseKit>;
	try {
		ctx = loadResolvedReleaseKit(cwd, flags);
	} catch (e) {
		console.error(e instanceof Error ? e.message : e);
		process.exit(1);
		return;
	}

	const dotenvPath = resolveDotenvPath(cwd, ctx.root, flags.dotenvPath);
	ctx.dotenvPath = dotenvPath;
	loadKitDotenv(dotenvPath);

	let exitCode = 0;

	switch (command) {
		case 'bump-version':
			runBumpVersion(ctx, commandArgs);
			break;
		case 'print-tauri-signing-env':
			runPrintTauriSigningEnv(ctx);
			break;
		case 'update-latest':
			runUpdateLatest(ctx);
			break;
		case 'upload-release':
			await runUploadRelease(cwd, ctx, commandArgs);
			break;
		case 'upload-dmg':
			await runUploadDmg(cwd, ctx, commandArgs);
			break;
		case 'wiki-sync-update-info':
			exitCode = runWikiSyncUpdateInfo(ctx);
			break;
		case 'wiki-sync-guide':
			exitCode = runWikiSyncGuide(ctx);
			break;
		default:
			console.error(`未知子命令: ${command}`);
			printHelp();
			process.exit(1);
	}

	process.exit(exitCode);
}

main().catch((e) => {
	console.error(e);
	process.exit(1);
});
