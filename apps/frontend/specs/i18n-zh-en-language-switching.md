### 多语言切换（中文/英文）SPEC（面向实现）

> **目标**：在不破坏现有项目架构（React + react-router + Tailwind + Tauri 可选运行时）的前提下，为整个前端提供**中文/英文**两种语言切换能力，并保证**启动即生效**、可持久化、可被分享链接还原。
>
> **术语**：
> - **i18n（internationalization，国际化）**：让应用具备适配多语言的能力。
> - **locale（区域/语言标识）**：如 `zh-CN`、`en-US`。
> - **fallback（回退）**：当某 key 缺失时回退到默认语言或 key 本身。

---

### 1. 目标与范围

#### 1.1 目标

- **全局语言切换**：支持 `中文` 与 `English`。
- **启动即生效**：应用刚启动（首屏渲染前后均可）语言正确，不需要用户手动点一次。
- **持久化**：用户选择可保存，下次启动自动恢复。
- **分享链接还原**：当页面通过分享链接在浏览器打开时，若带 `?lang=` 参数，可按链接语言还原 UI 文案。
- **最小侵入式改造**：先覆盖核心页面/组件（导航、设置、登录、首页、知识库/聊天等），允许逐步迁移，避免“一次性替换全仓库文案”导致大面积冲突。

#### 1.2 范围（包含）

- 语言状态管理（hook/store）与持久化策略
- `t()` 翻译函数（含插值、复数/数量可选、fallback）
- UI：设置页语言切换入口、顶部/侧边栏快捷入口（可选）
- 路由/分享页（`/share`）语言对齐策略
- 工程化：字典文件结构、key 命名规范、lint/测试约束

#### 1.3 非目标（明确不做）

- 不做第三语言
- 不做服务端下发语言包
- 不做完整 ICU MessageFormat（后续可升级）

---

### 2. 产品行为（User Story）

#### 2.1 启动行为

- **默认语言**：`zh-CN`（中文）。
- 初始化优先级（从高到低）：
  1. URL 查询参数：`?lang=en-US` / `?lang=zh-CN`
  2. 本地持久化（Tauri store 或 localStorage bootstrap）
  3. 浏览器 `navigator.language`（可选；仅在未持久化时生效）
  4. 回退到默认 `zh-CN`

#### 2.2 切换行为

- 用户在设置页选择语言后：
  - 立刻更新当前页面所有文案（无需刷新）
  - 写入持久化
  - 同步写入“首屏 bootstrap key”，降低刷新时闪烁
  -（可选）触发事件总线通知其它模块

#### 2.3 分享链接行为

- 对外分享的 URL 在生成时应携带 `lang` 参数（类似主题的 query 追加策略）。
- `share` 页面应在渲染前读取 `lang` 并应用（避免分享页文案与主题一样“需要触发一次才生效”）。

---

### 3. 技术方案（建议）

#### 3.1 方案选择

本项目建议采用**轻量自研 i18n**（不引入 i18next），原因：

- 现有项目已有类似 `useTheme` 的“启动 bootstrap + store 持久化 + URL 优先”套路，可复用；
- 需求仅 `zh-CN/en-US` 两种语言；
- 能更贴合现有工程（Tauri store / localStorage / 事件 onEmit）。

> 若后续需要多语言规模化（命名空间、懒加载、复杂复数规则），可再迁移到 i18next；本 SPEC 先保证可快速 vib coding 落地。

#### 3.2 目录与文件

- `apps/frontend/src/hooks/i18n.ts`
  - `useI18n()`：提供 `locale`, `setLocale()`, `t()`, `formatNumber()`, `formatDate()`（可选）
- `apps/frontend/src/i18n/locales/zh-CN.ts`
- `apps/frontend/src/i18n/locales/en-US.ts`
- `apps/frontend/src/i18n/index.ts`
  - 合并导出字典与类型
- `apps/frontend/src/views/setting/system/` 或 `apps/frontend/src/views/setting/language/`
  - 语言设置 UI（与现有 setting 结构保持一致）

#### 3.3 数据模型

```ts
type Locale = 'zh-CN' | 'en-US';

type Dict = Record<string, string | ((params: Record<string, unknown>) => string)>;
```

#### 3.4 存储与 bootstrap

- **Bootstrap key**：`dnhyxc_locale_bootstrap`
  - 存在 `localStorage`，用于首屏同步读取
- **持久化 key**（Tauri store）：`locale`
  - 通过现有 `getValue/setValue` 读写（与主题一致）

初始化顺序需与主题一致：**先同步读取 bootstrap 作为 state 初值，再异步读取 store 覆盖**。

#### 3.5 翻译函数 `t()`

- `t(key: string, params?: Record<string, any>): string`
- 行为：
  - 先在当前语言字典找 key
  - 缺失则 fallback 到默认语言字典
  - 仍缺失则返回 `key`（并在 dev 下 `console.warn` 可选）
  - 支持简单插值：`"Hello, {name}"` → 用 params 替换

#### 3.6 Key 命名规范

- **统一小写点分层**：`nav.home`、`settings.language.title`、`auth.login.submit`
- **禁止写中文 key**
- **新增文案必须入字典**：避免散落硬编码

---

### 4. UI/交互规范

#### 4.1 设置页入口

- 菜单项：`语言 Language`
- 内容：
  - 当前语言展示（中文/English）
  - 两个选项按钮或 RadioGroup：
    - `中文（简体）`
    - `English`

#### 4.2 Header 快捷切换（必须）

- **位置**：放在 Header 组件中，且位于“主题切换”控件**之前**。
- **形态**：点击即可在 `zh-CN` 与 `en-US` 之间切换（不需要打开设置页）。
- **文案/展示**（二选一即可，保持简洁）：
  - 方案 A：显示当前语言短标识：`中` / `EN`
  - 方案 B：显示图标 + Tooltip：`语言 Language`
- **行为**：
  - 点击后立即生效（全局文案更新）
  - 写入持久化（Tauri store `locale`）
  - 写入 bootstrap（`dnhyxc_locale_bootstrap`）
  - 若当前 URL 存在 `lang=`，切换后可选择：
    - 直接覆盖当前 URL 的 `lang` 参数（推荐：保持分享/刷新一致）
    - 或仅更新内部状态（实现更简单，但刷新/复制链接会丢语言）

#### 4.3 侧边栏/设置页入口（可选）

- 设置页仍保留语言项作为“可发现入口”，Header 作为快速切换入口。

---

### 5. 渐进式迁移策略

#### 5.1 阶段 1（最小可用）

- 完成 `useI18n` + 字典文件 + 设置页切换
- 覆盖以下区域：
  - 侧边栏菜单文案
  - 登录页/注册页
  - 设置页主标题与菜单
  - 首页关键 CTA

#### 5.2 阶段 2（全局化）

- 覆盖 Knowledge/Chat/Share 等复杂页面
- 对“错误提示/Toast”逐步替换为 `t()` key

---

### 6. 验收标准（Acceptance Criteria）

- **AC1**：首次启动未设置过语言时，默认显示中文（`zh-CN`）。
- **AC2**：在设置页切换到英文后，立即生效且刷新后仍保持英文。
- **AC3**：打开 `?lang=en-US` 的分享链接时，无需任何交互即可显示英文。
- **AC4**：当字典缺失 key 时，不会崩溃；至少能 fallback 返回默认语言或 key。
- **AC5**：与主题系统不冲突（两者 bootstrap key 共存，互不覆盖）。

---

### 7. 测试用例（建议）

- **E2E/手测**
  - 清空本地存储 → 启动 → 中文
  - 切英文 → 立即生效 → 刷新仍英文
  - URL 覆盖：中文环境下打开 `?lang=en-US` → 英文优先
- **单测（可选）**
  - `t()` 插值、fallback、缺失 key 行为

