# @dnhyxc-ai/release-kit

通用 **Tauri / GitHub Release** 流水线 CLI：SemVer 递增、`latest.json`、GitHub Release 资源上传、可选 Wiki Markdown 推送。路径通过 **`release-kit.config.json`** 配置；若无配置文件，可通过 **命令行全局参数** 逐项传入。

## 安装

```bash
pnpm add -D @dnhyxc-ai/release-kit
# 或
npm install -D @dnhyxc-ai/release-kit
```

安装后可在 `package.json` 的 `scripts` 中调用 **`release-kit`**（见下方示例）。

## 配置文件

在仓库根目录（或任意上级目录）放置 **`release-kit.config.json`**，CLI 会从当前工作目录 **向上查找** 该文件。

- **`root`**：解析 `paths` 内相对路径的基准目录；默认取配置文件所在目录。
- **`paths`**：各产物与文档的相对路径（相对于 `root`）。
- **`latestJsonPlatformKey`**：写入 `latest.json` → `platforms` 的键，默认 `darwin-aarch64`。
- **`wiki`**：`wiki-sync-update-info` / `wiki-sync-guide` 的默认 `owner` / `repo` / `pageFile`（可被环境变量覆盖）。
- **`upload.extraFiles`**：`upload-release` 时除 `.tar.gz` 与 `latest.json` 外额外上传的文件。

完整字段示例见仓库内 **`release-kit.config.example.json`**。

## 命令行覆盖路径

以下参数可在 **子命令前或后** 出现（二者等价），优先级高于配置文件：

| 参数                      | 说明                              |
| ------------------------- | --------------------------------- |
| `--config <path>`         | 指定配置文件                      |
| `--root <path>`           | 工程根目录                        |
| `--tauri-config <path>`   | `tauri.conf.json`                 |
| `--latest-json <path>`    | `latest.json`                     |
| `--macos-tar-gz <path>`   | macOS 更新包 `.tar.gz`            |
| `--macos-sig <path>`      | 签名文件                          |
| `--dmg-bundle-dir <dir>`  | dmg 输出目录                      |
| `--wiki-update-md <path>` | Wiki 更新说明源 Markdown          |
| `--wiki-guide-md <path>`  | Wiki 教程源 Markdown              |
| `--dotenv <path>`         | `.env` 路径（默认 `<root>/.env`） |

## 子命令

```bash
release-kit bump-version [patch|minor|major]
release-kit print-tauri-signing-env
release-kit update-latest
release-kit upload-release [--file <path>]...
release-kit upload-dmg [dmg文件路径]
release-kit wiki-sync-update-info
release-kit wiki-sync-guide
```

### `.env` 与缺省提示

CLI 会在解析 `release-kit.config.json` 后加载 **`<root>/.env`**（或通过 **`--dotenv <path>`** 指定）。各子命令在缺少所需变量时会 **退出并列出变量名**，同时提示应配置的 **`.env` 绝对路径**（若文件不存在也会说明）。

### Tauri 增量签名（替代原 `export.sh --print`）

将以下变量写入 **发布工程根目录** 的 `.env`（本仓库为 `apps/frontend/.env`）：

- **`TAURI_SIGNING_PRIVATE_KEY`**
- **`TAURI_SIGNING_PRIVATE_KEY_PASSWORD`**

在运行 **`tauri build`** 的同一 shell 中先注入环境变量，例如：

```bash
eval $(pnpm exec release-kit print-tauri-signing-env)
pnpm exec tauri build
```

`print-tauri-signing-env` 仅向 **stdout** 输出两行 `export ...`（与原先 `export.sh --print` 行为一致），错误信息在 **stderr**，便于 `eval $(...)`。

### 上传与 Wiki

上传 GitHub Release 需要：**`GITHUB_TOKEN`**、**`OWNER`**、**`APP_REPO`**、**`APP_TAG`**（默认 `latest`）。Wiki 子命令需要 **`GITHUB_TOKEN`**，以及配置或环境变量中的仓库坐标（见配置文件中 `wiki` 段说明）。

## 发布到 npm

```bash
cd packages/release-kit
pnpm run build
pnpm publish --access public
```

（`prepublishOnly` 已配置为自动执行 `build`。）

## 在业务仓库中的 `package.json` 示例

```json
{
	"scripts": {
		"release:bump": "release-kit bump-version patch",
		"release:latest": "release-kit update-latest",
		"release:upload": "release-kit upload-release"
	}
}
```

## 程序化使用

```ts
import {
	loadResolvedReleaseKit,
	parseGlobalArgv,
	splitCommandArgv,
} from "@dnhyxc-ai/release-kit";
```

## release-kit.config.json 配置示例

```json
{
	"root": ".",
	"paths": {
		"tauriConfig": "apps/frontend/src-tauri/tauri.conf.json",
		"latestJson": "apps/frontend/latest.json",
		"macosTarGz": "apps/frontend/src-tauri/target/release/bundle/macos/your-app.app.tar.gz",
		"macosSig": "apps/frontend/src-tauri/target/release/bundle/macos/your-app.app.tar.gz.sig",
		"dmgBundleDir": "apps/frontend/src-tauri/target/release/bundle/dmg",
		"wikiUpdateSourceMd": "docs/project-update-info.md",
		"wikiGuideSourceMd": "docs/project-guide.md"
	},
	"latestJsonPlatformKey": "darwin-aarch64",
	"wiki": {
		"updateInfo": {
			"owner": "your-org",
			"repo": "your-repo",
			"pageFile": "Update-Info.md"
		},
		"guide": {
			"owner": "your-org",
			"repo": "your-product-repo",
			"pageFile": "Product-Guide.md"
		}
	}
}
```

## 许可证

MIT
