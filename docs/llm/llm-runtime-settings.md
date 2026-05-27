# 设置页大模型运行时配置（实例级覆盖 `createLlm`）

> **文档角色**：本轮在设置中新增「大模型」页，服务端持久化 API Key / Base URL / 模型名，并在 `createLlm` 解析时优先于 `.env` preset 回退链。  
> **延伸阅读**：[create-llm.md](./create-llm.md)（工厂与 preset）、[siliconflow-chat-unification.md](./siliconflow-chat-unification.md)（硅基接入背景）。

若与仓库最新源码不一致，**以源码为准**。

---

## 1. 背景与目标

### 1.1 问题

运维与自托管用户希望**不改服务器 `.env`、不重启**即可在 UI 中切换硅基（或其它 OpenAI 兼容）凭证；且主站对话、知识库助手、RAG、英语学习、Agent 等应**共用一套**三元组，避免各模块 env 回退链不一致。

### 1.2 目标

- 登录用户通过 **`/setting/llm`** 配置并持久化。
- **未开启**或三字段未齐：行为与改前完全一致（仍走 `siliconFlowResolvePresets` + env）。
- **已开启且齐全**：所有 `createLlm` / `getAssistantSiliconFlowModelName` 注入处统一使用 DB 配置。
- API Key 加密落库；设置页可回显完整 Key（需 HTTPS），支持显示/隐藏切换。

---

## 2. 改动范围

| 路径 | 说明 |
|------|------|
| `apps/backend/src/services/llm-config/*` | Entity、加解密、`LlmConfigService`、Controller、全局 `LlmConfigModule` |
| `apps/backend/src/services/llm-config/llm-runtime-snapshot.store.ts` | 进程内共享快照（避免多 Provider 实例 `this.snapshot` 不同步） |
| `apps/backend/src/migrations/1780200000000-llm-runtime-config.ts` | 表 `llm_runtime_config`（singleton `id=1`） |
| `apps/backend/src/utils/create-llm.ts` | 可选第三参 `LlmCredentialResolver`；导出 `LlmCredentialResolver` 类型 |
| `apps/backend/src/app.module.ts` | `LlmConfigModule` 置于 `TypeOrmModule.forRootAsync` 之后 |
| `chat` / `assistant` / `knowledge-qa` / `english-learning` / `agent` 各 Service | 注入 `LlmConfigService` 并传入 `createLlm` |
| `apps/frontend/src/views/setting/llm/index.tsx` | 设置子页 UI |
| `apps/frontend/src/service/llmSettings.ts` | API 封装 |
| `apps/frontend/src/views/setting/menu.tsx`、`router/routes.ts` | 菜单与路由 |
| `apps/frontend/src/views/setting/theme/index.tsx` | 主题页顶距与色块网格布局（与设置页版式对齐，无功能耦合） |
| `apps/frontend/src/i18n/locales/zh-CN.ts`、`en-US.ts` | 文案 |

---

## 3. 实现思路

### 3.1 持久化与加密

- 表 **`llm_runtime_config`** 单行：`enabled`、`base_url`、`model_name`、`api_key_enc`（AES-256-GCM）。
- 加密密钥：`LLM_CONFIG_ENCRYPTION_KEY`，否则回退 `SECRET`（开发缺省有占位，生产应配置独立密钥）。
- `GET /api/settings/llm` 返回完整 `apiKey`（仅 JWT 登录可读）、`active`（是否已对 `createLlm` 生效）、`apiKeyMask`（可选展示）。

### 3.2 运行时快照优先级

```text
createLlm(config, options, llmConfigService?)
  → llmConfigService.resolveSiliconFlowCredentials(config, preset)
       → getLlmRuntimeSnapshot() 且 enabled+三字段齐全 → 返回 DB 三元组
       → 否则 → resolveEnvSiliconFlowCredentials(preset 对应 env 回退链)
```

- **不按 preset 分套 UI 配置**：开启后 Chat / Assistant / knowledgeQa / englishLearning 共用同一套 Key、Base URL、Model。
- 各业务传入的 `options.modelName` **覆盖**仍保留（如英语学习 JSON 子模型）。

### 3.3 进程内共享 store

保存配置时 `setLlmRuntimeSnapshot(activeSnap)`；解析时 `getLlmRuntimeSnapshot()`。避免「PUT 请求所在 Service 实例已更新、Chat 请求实例仍为 null」的问题。

### 3.4 前端交互要点

- 保存：须开启自定义且 **apiKey、baseUrl、modelName** 均非空，否则保存按钮禁用。
- 未改 Key 再保存：前端比对 `savedApiKey`，相同则不提交 `apiKey` 字段，后端保留密文。
- API Key 输入框默认 `password`，右侧 **Eye / EyeOff** 切换明文；加载后回填服务端 `apiKey`。
- 底部左侧展示「当前自定义配置已生效」/ 不完整提示，与保存、恢复按钮同一行。

---

## 4. 关键代码与注释

### 4.1 快照提交与解析

**来源**：`apps/backend/src/services/llm-config/llm-config.service.ts`（约 L95–L123）

```typescript
// 说明：reloadSnapshot 从 DB 解密后写入进程级 store，不依赖单个 Service 实例字段
private commitSnapshot(snap: LlmRuntimeSnapshot | null): void {
	const active = this.isSnapshotActive(snap) ? snap : null;
	setLlmRuntimeSnapshot(active);
}

resolveSiliconFlowCredentials(config, preset) {
	const snapshot = getLlmRuntimeSnapshot();
	if (this.isSnapshotActive(snapshot)) {
		return {
			apiKey: snapshot.apiKey,
			baseURL: snapshot.baseUrl,
			modelName: snapshot.modelName,
		};
	}
	return resolveEnvSiliconFlowCredentials(
		config,
		siliconFlowResolvePresetsForPreset(preset)(config),
	);
}
```

### 4.2 `createLlm` 接入覆盖层

**来源**：`apps/backend/src/utils/create-llm.ts`（约 L254–L259）

```typescript
// 说明：第三参为 LlmConfigService 时走运行时覆盖；省略则与历史行为一致
const credentials = resolver
	? resolver.resolveSiliconFlowCredentials(config, preset)
	: resolveSiliconFlowCredentials(
			config,
			siliconFlowResolvePresets[preset](config),
		);
```

### 4.3 HTTP API

**来源**：`apps/backend/src/services/llm-config/llm-config.controller.ts`（全文）

```typescript
// 说明：均需 JwtGuard；路径前缀为全局 /api
// GET    /settings/llm
// GET    /settings/llm/defaults   → 默认 baseUrl 提示
// PUT    /settings/llm            → UpsertLlmConfigDto
// DELETE /settings/llm            → 清空并恢复仅 env
```

### 4.4 前端保存条件

**来源**：`apps/frontend/src/views/setting/llm/index.tsx`（约 L62–L75、底部按钮区）

```typescript
// 说明：未开启自定义或任一必填为空则不可保存
const canSave = useMemo(() => {
	if (!enabled) return false;
	return (
		apiKey.trim().length > 0 &&
		baseUrl.trim().length > 0 &&
		modelName.trim().length > 0
	);
}, [enabled, apiKey, baseUrl, modelName]);

// 说明：Key 未变时不 PUT apiKey，避免用脱敏串覆盖密文
const keyUnchanged = trimmedKey === savedApiKey.trim();
await updateLlmSettings({
	enabled,
	baseUrl: baseUrl.trim(),
	modelName: modelName.trim(),
	...(!keyUnchanged && trimmedKey ? { apiKey: trimmedKey } : {}),
});
```

---

## 5. 行为变化与兼容性

| 场景 | 行为 |
|------|------|
| 未配置 / `enabled=false` | 与改前一致，各 preset 各自 env 回退链 |
| `enabled=true` 且三字段齐全 | 全站 LLM 调用统一用 DB 配置 |
| 关闭 UI 覆盖 | `DELETE` 或 `enabled:false` 清空生效配置，回退 env |
| Assistant token 预算 | `getAssistantSiliconFlowModelName` 同样传入 `llmConfigService` |

---

## 6. 测试与回归建议

1. 迁移：执行 `1780200000000-llm-runtime-config`（或团队等价 migration），确认表存在。
2. 设置页保存后，`GET` 返回 `active: true`；发起主站对话应使用自定义模型（可故意填无效 Key 验证 401）。
3. 重启后端进程后无需再保存，启动 `onModuleInit` 应 `reloadSnapshot` 生效。
4. 「恢复环境变量」后对话应恢复 `.env` 行为。
5. 知识库助手、英语学习拉包、Agent 各抽一条路径验证。

---

## 7. 相关文档与代码索引

| 说明 | 路径 |
|------|------|
| createLlm 工厂 | [create-llm.md](./create-llm.md) |
| 设置路由（需登录） | `apps/frontend/src/router/routes.ts` |
| 产品向更新说明 | [../project-update-info.md](../project-update-info.md) §9 |
| 产品向使用指南 | [../project-guide.md](../project-guide.md) §8.3 |
