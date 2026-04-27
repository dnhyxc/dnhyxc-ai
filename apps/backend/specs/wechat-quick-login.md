### 微信快捷登录（WeChat Quick Login，微信一键登录）后端接入 SPEC（基于 `apps/backend/src/services`）

> 目标：在现有 NestJS + Passport(JWT) + TypeORM 的鉴权体系中，新增“微信快捷登录”能力，与现有 `/auth/login`、`/auth/loginByEmail` 并存，统一签发 `access_token`（JWT）。

---

### 1. 目标与范围

- **目标**
  - 在后端提供“微信快捷登录”接口：前端拿到微信 `code` 后，后端向微信服务端换取 `openid/unionid`，完成登录或自动注册，并签发与现有登录一致的 JWT。
  - 支持“绑定/解绑微信”与“登录后补全资料（如绑定邮箱）”的闭环，适配当前 `User.email` 必填且唯一的约束。
  - 提供可审计的日志、可控的风控（限流/重放防护/状态校验）与可验收的测试清单。

- **范围**
  - 后端：`apps/backend/src/services/auth/*`、`apps/backend/src/services/user/*`、新增 `apps/backend/src/services/auth/wechat/*` 或 `apps/backend/src/services/wechat/*`（建议在 `auth` 下以“登录域”为边界）。
  - 数据：新增微信身份映射（推荐独立表 `user_wechat`），或对 `User` 增加微信字段（二选一，见下文）。
  - 配置：新增微信 AppID/Secret 等环境变量及 `ConfigEnum` 扩展。

- **非目标**
  - 不实现微信支付、消息推送、客服等其它微信生态能力。
  - 不在本 Spec 中约束前端 UI 细节（仅提供前端需要传的参数与回调契约）。

---

### 2. 目录结构与关键入口（现状基线）

- **鉴权入口**
  - `apps/backend/src/services/auth/auth.controller.ts`
    - `POST /auth/login`：用户名+密码+图形验证码
    - `POST /auth/loginByEmail`：邮箱+邮箱验证码
  - `apps/backend/src/services/auth/auth.service.ts`
    - 负责校验与签发 JWT：`jwt.signAsync({ username, sub: id })`
  - `apps/backend/src/services/auth/auth.strategy.ts`
    - JWT payload 映射：`req.user = { userId: payload.sub, username: payload.username }`
  - `apps/backend/src/guards/jwt.guard.ts`
    - 未登录统一报错：`UnauthorizedException('请先登录后再试')`

- **用户模型（关键约束）**
  - `apps/backend/src/services/user/user.entity.ts`
    - `username`：必填唯一
    - `email`：必填唯一（这会影响“纯微信注册”）

- **数据库同步策略**
  - `apps/backend/src/database/typeorm-config.service.ts`
    - `synchronize` 由 `DB_SYNC` / `DB_DB1_SYNC` 控制（开发可用，生产建议关闭并使用迁移）

---

### 3. 核心概念与术语

- **OAuth 2.0（开放授权）**：微信网页登录/公众号网页登录常用的授权协议流程。
- **Code（授权码）**：前端从微信获取的临时凭证，用于后端换取身份信息。
- **openid（用户唯一标识）**：同一微信应用（同一 AppID）下用户的唯一标识。
- **unionid（跨应用统一标识）**：在同一开放平台主体下，多个应用之间可共享的统一用户标识（需要满足微信开放平台条件）。
- **JWT（JSON Web Token，令牌）**：本项目现有鉴权 token，`sub` 存用户 id。
- **绑定（bind）**：将业务 `User` 与微信身份（openid/unionid）建立关联。
- **clientType（客户端类型）**：本项目同时存在 Web 端与 Tauri 桌面端，后端用于区分授权承载方式、风控与日志口径。
- **Deep Link（深度链接）**：桌面端常用的“自定义协议回调”（例如 `myapp://wechat/callback?...`），用于系统浏览器授权后把结果带回应用。
- **Loopback Redirect（本机回环回调）**：桌面端也可用本机 `http://127.0.0.1:<port>/callback` 接收授权回调（需应用侧起临时监听）。

---

### 4. 功能点（按 API 动作拆分）

#### 4.1 微信快捷登录：`POST /auth/wechat/login`

- **触发入口**
  - 前端在微信授权后拿到 `code`，调用该接口。

- **前置条件/互斥条件**
  - `code` 必填、一次性使用（同一 `code` 重复使用需返回明确错误）。
  - **Web 端**若采用重定向回调：必须校验 `state`，避免 CSRF（Cross-Site Request Forgery，跨站请求伪造）。
  - **Tauri 桌面端**若采用“系统浏览器授权 + Deep Link/Loopback 回调”：必须校验 `state`，并建议将 `state` 与 `clientInstanceId`/`deviceId` 绑定，避免跨实例串用。
  - 同一设备/同一 IP 建议限流（防爆破/刷接口）。

- **状态变化（服务端）**
  - 若微信身份已绑定 `userId`：直接签发 JWT，写登录日志。
  - 若未绑定：
    - **自动注册**（可配置开关）：创建新 `User` 并绑定微信身份；或
    - **返回需要绑定信息**：要求用户补全邮箱/用户名后再完成注册绑定（适配 `email` 必填）。

- **网络调用（对微信服务端）**
  - 依据接入场景选择其一（至少实现一种，建议先实现与现有产品形态一致的一种）：
    - **公众号/网页授权**：使用 `code` 换取 `access_token/openid`，再拉取用户信息（可选）。
    - **小程序**：使用 `code` 调用 `code2session` 获取 `openid/unionid/session_key`。
    - **开放平台扫码登录**：与网页授权类似但 AppID 不同，且更贴合桌面端“扫码登录”形态。
  - Spec 要求后端封装为 `WechatAuthClient`，并对微信错误码做统一映射（见错误码章节）。

- **接口契约（建议）**
  - **Request**
    - `code: string`
    - `scene: 'mp' | 'mini_program' | 'open_platform'`（场景；用于选择调用哪个微信 API 与使用哪组 AppID/Secret）
    - `clientType?: 'web' | 'desktop'`（可选，推荐必填；用于风控、日志与后续扩展）
    - `state?: string`（Web/桌面端“重定向/Deep Link/Loopback”授权推荐必填）
    - `deviceId?: string`（可选，用于风控/审计；桌面端建议必填）
    - `clientInstanceId?: string`（可选；桌面端建议必填，用于把 state/nonce 绑定到某次客户端实例）
  - **Response（成功：已完成登录）**
    - `access_token: string`（JWT）
    - `id: number`
    - `username: string`
    - `email?: string`
    - `wechat: { openidMasked: string; unionidMasked?: string; scene: string }`
  - **Response（需要补全/绑定）**
    - `need_bind: true`
    - `bind_token: string`（短期 token，用于后续补全资料换正式 JWT，建议缓存 5-10 分钟）
    - `wechat: { openidMasked: string; unionidMasked?: string; scene: string }`

- **UI 表现（对前端的要求）**
  - 若返回 `need_bind: true`：前端应进入“补全信息/绑定邮箱”流程，再调用 `POST /auth/wechat/bind`。

- **错误处理与回滚**
  - 微信换取失败：不创建用户、不写绑定，返回可定位的错误码与 message。
  - 创建用户失败（唯一约束冲突等）：不写绑定，返回冲突错误，并提示前端走绑定流程或重试。

- **边界条件**
  - 同一 `unionid` 对应多个 `openid`（不同 appid）：允许多条映射但只能绑定到同一业务用户（通过唯一约束保证）。
  - `email` 必填时：必须走“补全邮箱”或“占位邮箱”策略（见数据模型章节）。

#### 4.2 微信绑定：`POST /auth/wechat/bind`

- **触发入口**
  - 已登录用户在“账号设置”中绑定微信；或微信登录返回 `need_bind` 后补全信息。

- **前置条件**
  - 方式 A：已登录（`JwtGuard`）+ 传 `code` 绑定当前用户。
  - 方式 B：使用 `bind_token`（短期 token）+ 补全资料完成绑定与登录。

- **接口契约（建议）**
  - **Request（已登录绑定）**
    - `code: string`
    - `scene: 'mp' | 'mini_program' | 'open_platform'`
  - **Request（补全绑定）**
    - `bind_token: string`
    - `email?: string`（若系统要求邮箱）
    - `username?: string`（若系统要求用户名）
  - **Response**
    - `success: true`
    - `access_token?: string`（若是补全绑定流程，绑定完成后直接签发）

- **边界条件**
  - 微信身份已绑定其他账号：拒绝绑定（返回冲突错误），避免账号盗绑。

#### 4.3 微信解绑：`POST /auth/wechat/unbind`

- **触发入口**
  - 已登录用户在设置页解绑微信。

- **前置条件**
  - 已登录（`JwtGuard`）。
  - 若账号没有密码/邮箱等其它可登录方式，需拒绝解绑，避免“解绑后无法登录”。

---

### 5. 状态模型与数据结构（推荐方案）

#### 5.1 推荐：新增 `user_wechat` 映射表（避免污染 `User` 核心表）

- **实体建议**：`apps/backend/src/services/auth/wechat/user-wechat.entity.ts`
- **字段**
  - `id: number`
  - `userId: number`（FK -> `User.id`）
  - `scene: 'mp' | 'mini_program' | 'open_platform'`
  - `appid: string`（冗余存储便于审计/多 app 支持）
  - `openid: string`（必填）
  - `unionid?: string`（可选）
  - `createdAt: Date`
  - `lastLoginAt?: Date`
  - `nickname?: string`、`avatarUrl?: string`（可选；仅在你确实需要展示时才保存）

- **唯一约束（强制）**
  - `(scene, appid, openid)` 唯一
  - `unionid` 若存在，可全局唯一或在同一开放平台主体内唯一（视你的业务而定）

#### 5.2 与现有 `User.email` 必填的冲突处理（两条可落地路径）

- **路径 A（推荐，企业级更合理）**：允许 `User.email` 为空
  - 修改 `User`：`email` 改为可空（`nullable: true`）并仍保持唯一（数据库对 NULL 的唯一行为需确认具体 DB；一般允许多个 NULL）。
  - 登录后引导绑定邮箱：提供 `/user/updateEmail` 现有能力即可（或补充“绑定邮箱”专用接口）。
  - 优点：数据语义正确，不需要“假邮箱”。
  - 风险：涉及数据库结构变更，生产需要迁移流程。

- **路径 B（保持现状，快速接入）**：自动生成占位邮箱
  - 规则：`email = "wx_" + sha256(openid).slice(0,16) + "@wx.local"`
  - 并在用户资料页显著提示“请绑定真实邮箱”，限制部分能力（可选）。
  - 优点：不改表结构即可上线。
  - 风险：邮箱语义不真实；若后续发送邮件需额外判断；占位域名需避免误发。

> 本仓库目前没有微信相关字段，优先推荐 5.1 + 5.2(A)。如果短期必须快速上线，可先用 5.2(B)，再计划迁移到 (A)。

---

### 6. 协议与接口契约（详细）

#### 6.1 后端新增路由（建议统一挂在 `AuthController` 下）

- `POST /auth/wechat/login`
- `POST /auth/wechat/bind`
- `POST /auth/wechat/unbind`
- （可选）`GET /auth/wechat/config`：返回前端需要的 appid/redirect_uri（避免前端硬编码；若涉及安全可只返回 appid）
- （可选，强烈建议）`POST /auth/wechat/state`：签发 `state`（并写入缓存），用于 Web/桌面端授权前置校验
- （可选，桌面端扫码登录）`POST /auth/wechat/qr/start`：创建一次“扫码登录会话”，返回二维码内容与轮询 token
- （可选，桌面端扫码登录）`GET /auth/wechat/qr/poll`：轮询扫码登录会话状态，成功时返回 `access_token` 或 `need_bind`

#### 6.2 响应格式

当前项目使用 `ResponseInterceptor` 统一响应格式（见 `apps/backend/src/interceptors/response.interceptor`，以实现为准）。本 Spec 的字段以 `data` 内返回为默认约定，若拦截器会包裹 `success/code/message`，需保持与现有接口一致。

#### 6.3 bind_token 设计（若采用“需要补全/绑定”模式）

- **生成**：服务端生成 `randomUUID()`，写入 Redis（cache）：
  - key：`WX_BIND_<uuid>`
  - value：`{ scene, appid, openid, unionid?, createdAt }`
  - TTL：5-10 分钟
- **消费**：`/auth/wechat/bind` 校验并一次性删除，避免重放。

---

### 7. 状态机与互斥规则（服务端规则）

- **一次性 code**
  - 任何微信 `code` 仅允许成功消费一次；重复请求必须返回“已使用/已过期”的统一错误。

- **绑定互斥**
  - 同一 `(scene, appid, openid)` 只能绑定一个 `userId`。
  - 若请求绑定到不同 `userId`：返回冲突错误（409）。

- **解绑保护**
  - 若用户没有其它可登录因子（例如：既无密码登录能力又无邮箱登录能力），禁止解绑，避免锁死账户。

---

### 8. 安全、风控与工程约束

- **双端（Web + Tauri）授权承载策略（必须明确其一）**
  - **策略 1：Web 端重定向回调 + 桌面端系统浏览器授权（Deep Link/Loopback）**
    - Web：后端签发 `state`，前端跳转微信授权页，微信回调到 `redirect_uri`（可能是后端或前端路由，二选一并保持一致）。
    - 桌面：应用打开系统浏览器进入微信授权页，回调到
      - **Deep Link**：`myapp://wechat/callback?code=...&state=...`（应用捕获后再调用后端 `/auth/wechat/login`）；或
      - **Loopback Redirect**：`http://127.0.0.1:<port>/callback?code=...&state=...`（由桌面端本机临时监听拿到 code，再调后端）。
  - **策略 2：桌面端扫码登录（推荐用于桌面端体验）**
    - 后端创建“扫码会话”并返回二维码内容（用于桌面端生成二维码）。
    - 用户用手机微信扫码完成授权后，后端更新会话状态；桌面端通过 `/auth/wechat/qr/poll` 获取最终登录结果（token 或 need_bind）。
    - 该策略通常使用 **开放平台扫码登录**（`scene=open_platform`）更贴合桌面端。

- **state 校验（Web/桌面端重定向类流程强制）**
  - 前端/桌面端发起授权前由后端签发 `state`（随机串）并缓存，回调或提交 `code` 时必须匹配。
  - 桌面端建议把 `state` 与 `clientInstanceId`（或 `deviceId`）绑定存储，避免不同实例串用。

- **限流**
  - 对 `/auth/wechat/login` 做 IP + deviceId 维度限流（例如 10/min），防刷。

- **日志与审计**
  - 登录成功：记录 `userId`、scene、appid、openid（可脱敏）、IP、UA、时间。
  - 登录失败：记录微信错误码、请求 traceId，便于排障。

- **配置管理**
  - 微信 `AppID/Secret` 必须仅在服务端保存，禁止下发 `secret`。

---

### 8.1 双端时序（建议落地为可联调的两条路径）

#### 8.1.1 Web 端：重定向授权 → 后端换取 code → 登录

- **前置**：`POST /auth/wechat/state` 获取 `state`
- **授权跳转**：Web 打开微信授权 URL（带 `state` 与 `redirect_uri`）
- **回调承载（两种二选一，需固定）**
  - 方案 A：微信回调到后端 `redirect_uri`，后端返回一个“登录中转页”（可由页面再 POST `/auth/wechat/login`，或由后端直接完成登录并跳转，按你的安全策略选择）。
  - 方案 B：微信回调到前端路由（能拿到 code），前端再 POST `/auth/wechat/login`。

#### 8.1.2 Tauri 桌面端：扫码登录 → 轮询 → 登录

- `POST /auth/wechat/qr/start`（携带 `clientType=desktop`、`deviceId`、`clientInstanceId`）
  - 返回：`qrContent`（用于生成二维码）+ `qrToken`（轮询用）+ `expiresAt`
- 桌面端展示二维码，用户用手机微信扫码确认
- `GET /auth/wechat/qr/poll?qrToken=...`
  - 状态：`pending` / `scanned` / `confirmed` / `expired`
  - 成功：返回与 `/auth/wechat/login` 相同的结果（`access_token` 或 `need_bind`）

### 9. 错误码与用户提示规范

> 以 NestJS `HttpException` 为基准，结合现有风格（当前多数使用 `HttpStatus.BAD_REQUEST`）。

- **400 参数错误**
  - `code` 缺失/格式不合法
  - `scene` 不支持
  - `state` 不匹配

- **401 未授权**
  - 需要登录绑定/解绑但未携带 JWT（复用 `JwtGuard` 行为：`请先登录后再试`）

- **409 冲突**
  - 微信身份已绑定其他账号
  - 自动注册时 `username/email` 唯一约束冲突（需给出可操作指引：改走补全绑定流程）

- **502/503 上游错误**
  - 微信服务端不可用/超时

- **推荐错误响应字段（若项目已有统一格式，以现有为准）**
  - `message`：面向用户的简短中文
  - `detail`：可选，包含微信 errcode/errmsg（仅在非生产或对内接口返回）

---

### 10. 验收清单（可直接用于测试）

- **基础成功路径**
  - 微信已绑定账号：`/auth/wechat/login` 返回 `access_token`，并可用该 token 访问受保护接口（如 `/user/getUsers`）。
  - 微信未绑定账号且允许自动注册：
    - 自动创建 `User` + `user_wechat` 映射
    - 返回 `access_token`

- **补全/绑定路径**
  - 微信未绑定账号且不允许自动注册：`/auth/wechat/login` 返回 `need_bind: true` + `bind_token`
  - `/auth/wechat/bind` 使用 `bind_token` + 补全资料成功后返回 `access_token`
  - `bind_token` 超时/重复使用：必须失败且不可重复消费

- **冲突与安全**
  - 同一 `openid` 尝试绑定不同用户：返回 409
  - `state` 不匹配（网页授权）：返回 400
  - 接口限流生效：超过阈值返回明确错误（429 或 400/403，按你项目规范）

- **解绑保护**
  - 账号无其它登录因子：解绑失败并提示先设置密码/绑定邮箱
  - 账号有其它登录因子：解绑成功，后续使用微信登录应进入 `need_bind` 或直接失败（按策略）

---

### 11. 需要新增/修改的配置项（建议）

在 `apps/backend/src/enum/config.enum.ts` 新增：

- `WechatEnum`
  - `WECHAT_MP_APPID`
  - `WECHAT_MP_SECRET`
  - `WECHAT_MINI_APPID`
  - `WECHAT_MINI_SECRET`
  - `WECHAT_OPEN_APPID`
  - `WECHAT_OPEN_SECRET`
  - `WECHAT_LOGIN_AUTO_REGISTER`（true/false）

并在 `apps/backend/.env.*` 添加对应变量（生产环境必须走安全注入）。

---

### 12. 实施步骤（最小可落地）

> 目标：在不破坏现有 `/auth/login`、`/auth/loginByEmail` 的前提下，新增微信登录入口，并确保 Web/Tauri 双端均可走通。

#### 12.1 代码落点（建议目录与文件清单）

> 以“最少新增文件 + 易维护”为原则。最终目录可按你团队习惯微调，但建议保持职责边界。

- **Auth（鉴权入口）**
  - `apps/backend/src/services/auth/auth.controller.ts`
    - 新增路由：`POST /auth/wechat/login`、`POST /auth/wechat/bind`、`POST /auth/wechat/unbind`
    - （可选）`POST /auth/wechat/state`
    - （可选，桌面端扫码）`POST /auth/wechat/qr/start`、`GET /auth/wechat/qr/poll`
  - `apps/backend/src/services/auth/auth.service.ts`
    - 新增方法：`loginByWechat(...)`、`bindWechat(...)`、`unbindWechat(...)`
    - （可选）`issueWechatState(...)`、`startWechatQrLogin(...)`、`pollWechatQrLogin(...)`

- **Wechat（微信协议与数据层）**
  - `apps/backend/src/services/auth/wechat/wechat-auth.client.ts`
    - 封装“用 code 换 openid/unionid”的 HTTP 调用、超时、重试（可选）与错误映射
  - `apps/backend/src/services/auth/wechat/user-wechat.entity.ts`
    - `user_wechat` 映射表实体
  - `apps/backend/src/services/auth/wechat/user-wechat.service.ts`
    - 查找/绑定/更新 lastLoginAt 等
  - `apps/backend/src/services/auth/wechat/dto/wechat-login.dto.ts`
  - `apps/backend/src/services/auth/wechat/dto/wechat-bind.dto.ts`
  - `apps/backend/src/services/auth/wechat/dto/wechat-unbind.dto.ts`
  - （可选，桌面端扫码）`apps/backend/src/services/auth/wechat/dto/wechat-qr.dto.ts`

#### 12.2 数据库实现步骤（TypeORM）

- **第 1 步：新增 `user_wechat` 实体**
  - 字段按 `### 5.1`，并加上唯一约束：
    - `unique(scene, appid, openid)`
    - `unionid` 若存在，建议再加一个唯一索引（按你的开放平台主体策略）
- **第 2 步：在对应 Module 注册**
  - 在 `AuthModule`（或新建 `WechatAuthModule` 并被 `AuthModule` 引入）里 `TypeOrmModule.forFeature([UserWechat])`
- **第 3 步：落库策略**
  - 开发环境：若 `DB_SYNC=true`，启动即可自动建表
  - 生产环境：建议关闭 `synchronize`，使用迁移（migration）创建表与索引（本 Spec 不强依赖你当前是否已有迁移体系，但上线前必须明确）

#### 12.3 微信客户端实现步骤（WechatAuthClient）

- **第 1 步：配置读取**
  - 根据 `scene` 选择不同的 `appid/secret`：
    - `mp`：公众号/网页授权
    - `mini_program`：小程序
    - `open_platform`：开放平台（扫码）
- **第 2 步：实现“用 code 换身份”**
  - 输入：`{ code, scene }`
  - 输出：`{ appid, openid, unionid?, session_key?, access_token? }`（按微信对应接口返回）
- **第 3 步：错误映射**
  - 将微信 `errcode/errmsg` 映射为：
    - 400：参数/状态错误（例如 code 无效、state 不匹配）
    - 502/503：上游不可用/超时

#### 12.4 登录主流程实现步骤（AuthService.loginByWechat）

> 该流程是“业务核心”，必须保证：幂等、可审计、可回滚（失败不落脏数据）、与现有 JWT 签发方式一致。

- **输入参数（建议）**
  - `code, scene, clientType, state?, deviceId?, clientInstanceId?`
- **步骤（伪流程）**
  - 校验参数：`code/scene` 必填，`clientType` 建议必填
  - 若为 Web/桌面端重定向类流程：校验 `state`（见 `12.6 state 生成与校验`）
  - 调用 `WechatAuthClient.exchangeCode(...)` 获取 `{ appid, openid, unionid? }`
  - 查询 `user_wechat`：
    - 若存在绑定：
      - 更新 `lastLoginAt`
      - 查询 `User`（复用现有 `UserService`）
      - 签发 JWT：复用当前逻辑 `jwt.signAsync({ username, sub: user.id })`
      - 返回：`{ access_token, ...userInfo }`
    - 若不存在绑定：
      - 若开启 `WECHAT_LOGIN_AUTO_REGISTER=true`：
        - 创建 `User`（注意 `email` 策略：走 5.2(A) 或 5.2(B)）
        - 创建 `user_wechat` 绑定记录
        - 签发 JWT 并返回
      - 若不开启自动注册：
        - 生成 `bind_token`（缓存 5-10 分钟，一次性消费）
        - 返回：`{ need_bind: true, bind_token, wechat: ... }`

#### 12.5 绑定/解绑实现步骤

- **bind（已登录绑定）**
  - `JwtGuard` 获取 `req.user.userId`
  - `exchangeCode` 得到 `openid`
  - 检查 `openid` 是否已绑定其它 `userId`：
    - 是：返回 409
    - 否：写入 `user_wechat`，返回成功

- **bind（补全绑定：bind_token）**
  - 校验并消费 `bind_token`（一次性删除）
  - 使用补全信息创建/查找 `User`：
    - 若你的策略是“必须邮箱”：校验 email 格式与唯一性
  - 写入 `user_wechat` 绑定
  - 签发 JWT 并返回

- **unbind**
  - `JwtGuard` 获取 `req.user.userId`
  - 检查是否还有其它登录因子（至少保证解绑后还能登录）：
    - 若没有：拒绝解绑
  - 删除/软删除 `user_wechat` 绑定记录

#### 12.6 state 生成与校验（Web + 桌面端重定向/Deep Link/Loopback）

> state 用于防 CSRF/重放。桌面端尤其要防“不同客户端实例互相串用 code/state”。

- **签发接口（建议）**：`POST /auth/wechat/state`
  - Request：`{ clientType: 'web' | 'desktop', deviceId?: string, clientInstanceId?: string, scene: ... }`
  - Response：`{ state: string, expiresAt: number }`
- **服务端存储（建议）**
  - key：`WX_STATE_<state>`
  - value：`{ clientType, deviceId?, clientInstanceId?, scene, createdAt }`
  - TTL：5-10 分钟
- **校验**
  - `/auth/wechat/login` 必须读取并比对：
    - 存在且未过期
    - `clientType/scene` 一致
    - 桌面端若传了 `clientInstanceId/deviceId`：必须一致
  - 校验成功后应删除该 `state`（一次性使用），避免重放

#### 12.7 Tauri 桌面端扫码登录实现步骤（可选，但推荐）

> 目标：让桌面端不依赖 Deep Link/Loopback，也不依赖在桌面端内嵌微信网页授权体验。

- **开始扫码会话**：`POST /auth/wechat/qr/start`
  - Request：`{ clientType:'desktop', deviceId, clientInstanceId }`
  - Response：`{ qrContent, qrToken, expiresAt }`
  - 服务端存储（建议）：
    - key：`WX_QR_<qrToken>`
    - value：`{ status:'pending', clientInstanceId, deviceId, createdAt, result? }`
    - TTL：2-5 分钟
- **轮询状态**：`GET /auth/wechat/qr/poll?qrToken=...`
  - Response：
    - `pending/scanned/confirmed/expired`
    - `confirmed` 时返回最终登录结果（`access_token` 或 `need_bind`）
- **确认回写（实现方式）**
  - 当手机侧完成授权后，后端拿到微信回调（或手机侧把 code POST 回来），将 `WX_QR_<qrToken>` 更新为 `confirmed + result`
  - 桌面端轮询拿到结果后，后端应立即删除该会话，避免重复领取

---

### 13. 登录流程（Web + Tauri 双端）

> 统一原则：无论 Web 还是 Tauri，最终都落到同一个“换取身份 → 查绑定 → 签 JWT”的服务端流程；差异仅在“如何获得 code/如何承载回调”。

#### 13.1 通用后端决策流程（所有端共享）

- 获取微信身份：`exchangeCode -> { appid, openid, unionid? }`
- 查绑定（`user_wechat`）：
  - **已绑定** → 签发 `access_token` → 返回用户信息
  - **未绑定**
    - `WECHAT_LOGIN_AUTO_REGISTER=true` → 创建用户 + 绑定 → 签 token
    - 否则 → 返回 `need_bind + bind_token`

#### 13.2 Web 端登录流程（重定向授权）

- Web 端向后端申请 `state`：`POST /auth/wechat/state`
- Web 端跳转微信授权页（携带 `state` 与 `redirect_uri`）
- 微信回调到 `redirect_uri`（前端路由或后端中转页）
- 前端拿到 `code/state` 后调用：
  - `POST /auth/wechat/login { code, scene:'mp'|'open_platform', clientType:'web', state }`
- 后端按 13.1 决策：
  - 返回 `access_token` 或 `need_bind`

#### 13.3 Tauri 桌面端登录流程（推荐：扫码 + 轮询）

- 桌面端请求创建扫码会话：
  - `POST /auth/wechat/qr/start { clientType:'desktop', deviceId, clientInstanceId }`
- 桌面端展示二维码
- 用户手机微信扫码并完成授权（导致后端会话变为 confirmed）
- 桌面端轮询：
  - `GET /auth/wechat/qr/poll?qrToken=...`
- 后端返回：
  - `access_token` 或 `need_bind + bind_token`

#### 13.4 Tauri 桌面端登录流程（备选：系统浏览器 + Deep Link/Loopback）

- 桌面端申请 `state`：`POST /auth/wechat/state { clientType:'desktop', deviceId, clientInstanceId }`
- 桌面端打开系统浏览器进入微信授权页（携带 `state`）
- 回调：
  - Deep Link：桌面端捕获 `code/state` 后调用 `/auth/wechat/login`
  - Loopback：桌面端本地监听拿到 `code/state` 后调用 `/auth/wechat/login`
- 后端按 13.1 决策返回结果
