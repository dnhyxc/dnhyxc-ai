**Tauri 签名环境**：请将 `TAURI_SIGNING_PRIVATE_KEY`、`TAURI_SIGNING_PRIVATE_KEY_PASSWORD` 写入 **`apps/frontend/.env`**，在仓库根构建前使用 `eval $(pnpm -C apps/frontend exec release-kit print-tauri-signing-env)`（由 `@dnhyxc-ai/release-kit` 读取并输出，与原先本包内 `export.sh --print` 等价）。本目录下的 `export.sh` 仍可作本地兼容，新流程以 `release-kit` 为准。

---

## 创建 github token

1. 进入 github，点击右侧用户头像，在出现的弹窗中选择 `Settings` 选项。

2. 进入 `Settings` 选项之后，选择最下方的 [Developer settings](https://github.com/settings/apps) 选项。

3. 进入后，点开 `Personal access tokens` 下拉菜单，之后点击 [Tokens（classic）](https://github.com/settings/tokens) 选项。

4. 进入后，点击 `Generate new token` 选项创建 token。
