# 仓库调研清单（动笔前）

完成调研后再写 §3「现状与复用」。每项至少快速检索一次；无结果写「无，需新增」。

## 1. 入口与路由

- [ ] 用户从哪进入？（侧栏、顶栏、右键、URL）
- [ ] 路由 / 页面文件（`apps/frontend/src/views/...`）
- [ ] 是否需登录 / 会员守卫

## 2. 同类功能

- [ ] 产品内 **最相似** 的 1～2 个功能（复制交互模式）
- [ ] 对应 Hook、Store、Service 路径
- [ ] 文档：`docs/<功能域>/` 是否已有专题

## 3. UI 与组件

- [ ] `@/components/design` / `@ui` 可复用组件（可用 component-catalog MCP）
- [ ] 现有 PopBar、Dialog、Split 布局模式

## 4. 数据与 API

- [ ] 后端 route / service（`apps/backend/src/...`）
- [ ] 表结构或 DTO（Grep 实体名）
- [ ] 前端 `api/` 或 fetch 封装

## 5. 横切 concern

- [ ] i18n key 惯例（`zh-CN.ts` / `en-US.ts`）
- [ ] 错误提示与 Toast 模式
- [ ] Tauri vs Web 分支（若有）

## 6. 互斥与影响

- [ ] 与哪些功能 **不能同时** 运行
- [ ] 是否影响 DOM 批注层、SSE、MobX 树
- [ ] `docs/Influence-point/` 是否已有影响面文

## 7. 输出格式

调研结果填入文档表格：

| 能力 | 已有位置 | 本需求用法 |
|------|----------|------------|

「本需求用法」只允许：**直接复用 / 扩展 / 新建 / 不适用** 四选一 + 半句说明。
