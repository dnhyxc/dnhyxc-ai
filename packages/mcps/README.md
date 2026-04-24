# @dnhyxc-ai/mcps — 组件目录 MCP

基于 `catalog/components.json` 的 **本地 stdio MCP（Model Context Protocol，模型上下文协议）**，为 AI 编程提供：

| 工具名 | 作用 |
| --- | --- |
| `list_component_ids` | 返回组件 `ids` 列表，并附带 `items` 摘要（`id` / `title` / `description` / `group` / `category` / `source`）；支持 `group` / `category` / `tag` / `limit` 过滤，便于后续用 id 调 `get_component_details` / `resolve_component_import` |
| `list_components` | 列出组件摘要，支持 `group` / `category` / `tag` / `limit` 过滤 |
| `search_components` | 关键词检索（多词空格分隔，简单打分排序） |
| `get_component_details` | 按 `id` 或 `slug`+`group` 取完整 props、examples、relatedSources，并返回 `usageExample`（可直接复制的 import + JSX 示例） |
| `resolve_component_import` | 生成推荐 `import` 与 `modulePath`；返回 `importKind`（default 或 named）、`binding`；对 design 下常见 default 入口做了 slug 映射（如 Monaco→MarkdownEditor） |

## 构建

```bash
pnpm --filter @dnhyxc-ai/mcps run build
```

产物：`dist/server.js`。`components.json` 位于包内 `catalog/`（构建不打包进单文件，运行时按相对路径读取）。

## 环境变量

| 变量 | 说明 |
| --- | --- |
| `DNHYXC_COMPONENT_CATALOG_PATH` | 可选，指向自定义 `components.json` 绝对路径 |

## 在 Cursor 中使用

官方说明见：[MCP integrations（Cursor 文档）](https://cursor.com/docs/context/mcp)。

### 1. 先构建 MCP

在仓库根目录执行：

```bash
pnpm --filter @dnhyxc-ai/mcps run build
```

确认存在：`packages/mcps/dist/server.js` 与 `packages/mcps/catalog/components.json`。

### 2. 写入 MCP 配置

Cursor 会读取 **`mcp.json`**（可与其它 MCP 合并）：

| 范围 | 路径 |
| --- | --- |
| **仅当前项目** | 仓库根目录下 `.cursor/mcp.json`（可提交到 Git 供团队共用） |
| **本机全局** | `~/.cursor/mcp.json` |

按 [Cursor MCP 文档](https://cursor.com/docs/context/mcp)，stdio 类服务建议写 **`type": "stdio"`**（与 `command` / `args` 同级）。

**推荐（项目内 `.cursor/mcp.json`）**：用 `${workspaceFolder}` 指向仓库根目录，避免每人机器路径不同：

```json
{
  "mcpServers": {
    "dnhyxc-component-catalog": {
      "type": "stdio",
      "command": "node",
      "args": ["${workspaceFolder}/packages/mcps/dist/server.js"]
    }
  }
}
```

也可把 `args` 写成**本机绝对路径**（全局 `~/.cursor/mcp.json` 时常用）。

可选：自定义 catalog 路径时增加 `env`（不要写进 `command` 字符串里）：

```json
{
  "mcpServers": {
    "dnhyxc-component-catalog": {
      "type": "stdio",
      "command": "node",
      "args": ["${workspaceFolder}/packages/mcps/dist/server.js"],
      "env": {
        "DNHYXC_COMPONENT_CATALOG_PATH": "${workspaceFolder}/packages/mcps/catalog/components.json"
      }
    }
  }
}
```

### 3. 在 Cursor 里启用并验证

1. 保存 `mcp.json` 后，打开 **Cursor Settings → MCP**（或 **Features → MCP**），确认列表中出现 `dnhyxc-component-catalog` 且状态为已连接。
2. 若未出现，可 **完全退出并重启 Cursor** 再试。
3. 在 **Agent / Chat** 里让模型使用 MCP 工具时，可直接说：「用组件目录 MCP 搜一下 Button」；模型应能调用 `search_components` / `get_component_details` / `resolve_component_import`。

### 4. 开发时用 tsx 跑源码（可选）

无需每次 `build` 时，可把 `args` 改为（路径同样改为本机绝对路径）：

```json
{
  "mcpServers": {
    "dnhyxc-component-catalog": {
      "type": "stdio",
      "command": "node",
      "args": [
        "${workspaceFolder}/node_modules/tsx/dist/cli.mjs",
        "${workspaceFolder}/packages/mcps/src/server.ts"
      ]
    }
  }
}
```

## 与前端协作约定

- `source` 字段形如 `@/components/ui/button.tsx`，与 `apps/frontend` 中 Vite/TS 路径别名一致。
- `resolve_component_import` 默认按 catalog 的 `name` 生成具名导入；若源码为多个 export，请以 `get_component_details` 中的 `source` 打开文件核对。
