# packages 发布（Changesets）

Monorepo 使用 [Changesets](https://github.com/changesets/changesets) 管理 **`packages/`** 内可发布包的版本与 changelog。

## 前置条件

- 已在仓库根目录安装 `@changesets/cli`（根目录 `package.json` 的 `devDependencies`）。
- npm 已登录且对 `@dnhyxc-ai` scope 有发布权限：`npm login`。
- 发布前各包需已构建（例如 `@dnhyxc-ai/release-kit` 的 `dist`、`@dnhyxc-ai/markdown-kit` 的 `dist`）；对应包内通常已有 `prepublishOnly` / `prepack`。

## 常用命令（在仓库根目录执行）

| 命令                     | 说明                                                      |
| ------------------------ | --------------------------------------------------------- |
| `pnpm changeset`         | 交互式添加变更集（选择包、bump 类型、写说明）             |
| `pnpm changeset:version` | 消费变更集：更新包版本、生成/更新 CHANGELOG、更新依赖引用 |
| `pnpm changeset:publish` | 执行构建后发布到 npm（见根目录脚本定义）                  |

## 配置位置

- **`.changeset/config.json`**：`access`、`baseBranch`、`ignore` 等。
- 建议将 **`@dnhyxc-ai/release-run`**（仓库内发布辅助脚本包，不面向 npm）加入 **`ignore`**，避免被 Changesets 误纳入版本与发布。  
  已在 **`package.json`** 中标记 **`private: true`** 的包（如 `@dnhyxc-ai/mcps`、`@dnhyxc-ai/ci`）Changesets 也不会发布。

若默认分支不是 `main`，请修改 `.changeset/config.json` 中的 **`baseBranch`**。

## 建议发布流程

1. 开发完成后：`pnpm changeset`，提交生成的 `.changeset/*.md`。
2. 合并到发布分支后：`pnpm changeset:version`，提交版本与 changelog 变更。
3. `pnpm changeset:publish`（或 CI 中等价步骤）完成 npm 发布。

**说明**：根目录脚本 **`pnpm version`** / **`pnpm version:patch`** 等仍用于 **Tauri 应用**（`release-kit` 写 `tauri.conf.json`），与 Changesets 的 **`pnpm changeset:version`** 不同，请勿混淆。

## npm 发布说明

目前发布 npm 包需要创建具有“绕过 2FA”权限的 Granular Access Token。

使用这种令牌，你可以将其配置在 GitHub Actions 或本地环境变量中，实现无需手动输验证码就能自动发布。

### 在 npm 网站生成专用令牌

1. 登录 npmjs.com。

2. 点击右上角你的头像 -> Access Tokens。

3. 点击 Generate New Token -> 选择 Granular Access Token（细粒度访问令牌）。

4. 配置令牌：

- Token name: 随便起个名字，比如 github-actions-publish 或 local-publish。
- Expiration: 选择一个合适的过期时间（推荐 90 天或 1 年，按需选择）。
- Packages and scopes:
  - 选择 Read and write。
  - 在下面的 Select packages 中，选择 **Only select packages and scopes**，然后输入你的包名前缀 **@dnhyxc-ai**。
- Organizations: 不用管。

5. 点击 Generate token。⚠️ 立即复制并保存这个 token（以 npm\_ 开头），离开页面后将无法再看到！

### 在本地配置该令牌

你可以在项目根目录下创建一个 .npmrc 文件（如果已经有就不需要新建），将令牌配置到你的 scoped 包下：

```bash
# 在项目根目录执行，将下面的 YOUR_TOKEN 替换为你刚才复制的 token
echo "//registry.npmjs.org/:_authToken=YOUR_TOKEN" >> .npmrc
```

**注意**：请务必将 `.npmrc` 加入你的 .gitignore 中，千万不要将带有 token 的文件提交到 Git 仓库！
