# 大模型接入

路径前缀：`apps/backend/src/services/`（chat、assistant、agent、settings）。

| 文档 | 说明 |
|------|------|
| [create-llm.md](./create-llm.md) | `createLlm` 工厂、preset、排查 400 |
| [membership-per-user-llm.md](./membership-per-user-llm.md) | **按用户**设置页配置、会员默认硅基 / 非会员 GLM |
| [llm-runtime-settings.md](./llm-runtime-settings.md) | 设置页 Key/URL/模型持久化（初版；singleton 已废弃） |
| [siliconflow-chat-unification.md](./siliconflow-chat-unification.md) | 主对话 / 助手硅基接入总览 |
| [agent-create-llm-unify.md](./agent-create-llm-unify.md) | 英语学习 Agent 接 `createLlm` |
| [llm-setting-ui-presets.md](./llm-setting-ui-presets.md) | 设置页预设联动、Combobox、API Key 前端 env 默认 |
| [llm-setting-save-flow.md](./llm-setting-save-flow.md) | **保存即启用**、底部四态提示、恢复默认 |

知识库向量与 RAG 见 [../knowledge/README.md](../knowledge/README.md)。

上级：[../README.md](../README.md)
