### 多站点热门商品选品（Hot Product Sourcing）SPEC

> **目标**：在现有 Tauri + React + NestJS 架构内新增一个“热门商品选品”模块：从多个选品网站扫描近期热门商品（可按类目/关键词/时间窗），将扫描结果聚合为候选商品列表，并对用户选择的商品做结构化分析，帮助快速决策与落地选品。  
> **定位**：本 SPEC 为“待实现规范”，遵循仓库既有 SPEC 风格（`views/knowledge`、`views/chat`）与 `service/index.ts` 的接口组织方式，方便后续 vibcoding 直接照着实现。  
> **重要约束**：涉及第三方平台数据采集需遵守其条款、robots 与法律合规；本模块在设计上默认“后端代理采集 + 限速 + 缓存 + 可审计”，前端不直接抓取第三方页面。

---

### 1. 目标与范围

#### 1.1 目标

- **热门扫描**：支持从多个选品网站扫描“近期热门”商品，产出结构化候选集（商品卡片 + 指标 + 来源证据）。
- **选品工作台**：支持筛选/排序/对比/收藏（shortlist）与导出（CSV/JSON）。
- **商品分析**：对单个商品或一组商品做多维度分析（需求热度、竞争强度、利润空间、供应稳定性、风险提示等），并能追溯到数据证据。
- **可复用的任务模型**：扫描与分析均以 **Job（任务）** 形式异步执行，支持进度、失败重试、结果缓存与历史回看。

#### 1.2 范围（包含）

- **前端**：
  - 路由与页面：选品工作台、扫描任务创建与历史、扫描结果列表、商品详情与分析报告、对比视图、收藏列表。
  - 状态：MobX store 管理任务与结果缓存、筛选条件、选中集合、导出状态。
  - 网络：对接后端选品 API（创建扫描、查询进度、拉取结果、触发分析、导出）。
- **后端契约（前端依赖）**：
  - 1688 扫描/解析：后端负责采集、清洗、去重、打分、存储。
  - 分析服务：后端负责计算指标与（可选）调用大模型生成分析文本。
  - 鉴权：沿用现有 JWT（JSON Web Token，JSON 网络令牌）鉴权与 401 全局处理。

#### 1.3 非目标（明确不做）

- 不在前端实现任何“直接抓取第三方网站网页”的逻辑（避免 CORS、账号风控、密钥泄漏与合规风险）。
- 不承诺“绝对准确的销量/热度”——以“可解释的估算 + 证据链”呈现，并给出置信度。
- 不做完整的跨平台电商全链路（下单/履约/广告投放等）；本期聚焦“扫描 + 结构化分析 + 决策辅助”，但接口设计保留扩展位以便后续接入更多数据源。

---

### 2. 目录结构与关键入口（建议落点）

> 以现有工程习惯（`apps/frontend/src/views/**` + `apps/frontend/src/store/**` + `apps/frontend/src/service/index.ts`）为准。

#### 2.1 路由与页面入口

- **路由**：建议新增 `/sourcing`（选品工作台）
  - `/sourcing`：工作台（结果列表 + 筛选 + 选中集合）
  - `/sourcing/jobs`：任务历史（扫描/分析任务列表）
  - `/sourcing/p/:productId`：商品详情 + 分析报告
  - `/sourcing/compare`：对比视图（基于选中集合/收藏集合）

#### 2.2 视图文件建议

- `apps/frontend/src/views/sourcing/index.tsx`：路由容器（tabs：工作台/任务/收藏）。
- `apps/frontend/src/views/sourcing/SourcingWorkbench.tsx`：核心工作台。
- `apps/frontend/src/views/sourcing/SourcingJobList.tsx`：任务历史。
- `apps/frontend/src/views/sourcing/SourcingJobCreate.tsx`：创建扫描任务弹窗/抽屉。
- `apps/frontend/src/views/sourcing/SourcingProductDetail.tsx`：商品详情与分析。
- `apps/frontend/src/views/sourcing/SourcingCompare.tsx`：对比视图。

#### 2.3 Store / Service / Types 建议

- **Store**：`apps/frontend/src/store/sourcing.ts`（MobX）
- **Types**：`apps/frontend/src/types/sourcing.ts`
- **Service**：在 `apps/frontend/src/service/api.ts` 新增常量，并在 `apps/frontend/src/service/index.ts` 按既有风格新增函数：
  - `createSourcingScanJob`
  - `getSourcingJobList`
  - `getSourcingJobDetail`
  - `getSourcingJobProgress`
  - `getSourcingProducts`
  - `getSourcingProductDetail`
  - `createSourcingAnalysisJob`
  - `getSourcingAnalysis`
  - `exportSourcingProducts`

---

### 3. 核心概念与术语

- **Job（任务）**：异步计算单元。类型包括 `scan`（扫描）与 `analysis`（分析）。  
- **Source（数据源）**：数据来源平台/网站。用于区分不同扫描入口、解析策略、限速风控与证据链格式。  
- **Evidence（证据）**：支撑指标的原始依据，如：榜单入口、搜索结果页、类目页片段、时间戳、抓取批次号。  
- **Candidate（候选商品）**：扫描后进入工作台的候选条目。  
- **Shortlist（收藏/候选清单）**：用户标记的重点商品集合，用于后续对比与导出。  
- **Scoring（打分）**：将多维指标聚合为总分（如 0-100），同时保留每项子分与权重，避免黑盒。  
- **Confidence（置信度）**：对热度/销量/竞争等估算的可信程度分级（如 A/B/C）。

关键标识符（建议）：

- `jobId`：任务 id（后端生成，前端用于轮询与缓存 key）。
- `productId`：内部商品 id（后端对第三方商品标识做规范化映射；跨源去重可选）。
- `sourceItemId`：第三方原始商品 id（各 Source 自己的 itemId/skuId/urlKey 等）。

建议的 Source 枚举（可按实际需要增删）：

- `1688`（供货/工厂货源）
- `pdd`（拼多多）
- `jd`（京东）
- `taobao`（淘宝）
- `douyin`（抖音电商）
- `xiaohongshu`（小红书）
- `temu`（Temu）
- `amazon`（Amazon）

> 备注：这里的 `Source` 表达的是“数据源/网站”，不要求所有 Source 都能“抓取榜单”。某些站点可以先用“搜索热词/类目页热销排序”作为热门近似；关键是统一输出结构与证据链。

---

### 4. 用户可见功能点（按用户动作拆分）

#### 4.1 创建“热门扫描”任务（支持多 Source）

- **触发入口**
  - 工作台顶部「开始扫描」按钮
  - 任务页「新建扫描」按钮
- **前置条件/互斥条件**
  - 必须登录（JWT）；未登录提示并引导登录
  - 同一用户同时运行的扫描任务数限制（由后端返回 429/业务错误码）；前端展示“稍后重试/查看进行中任务”
- **状态变化（store）**
  - 写入 `sourcingStore.creatingJob=true`
  - 创建成功后将 `jobId` 放入 `activeJobId`，并将任务插入 `jobList` 顶部
  - 打开“任务进度条/侧栏”
- **网络调用**
  - `POST /sourcing/jobs/scan`：创建扫描任务
- **UI 表现**
  - 弹窗表单：
    - 数据源 Source（支持多选，默认 `1688`）
    - 时间窗（7/14/30 天）
    - 类目（可选，若不同 Source 类目体系不一致，则使用“跨源通用类目”或允许按 Source 分组选择）
    - 关键词（可选；可为每个 Source 设置不同关键词，最小实现先全局共用）
    - 数量上限（如 200/500/1000）
    - 地区/发货地（可选；仅对支持该维度的 Source 生效）
  - 提交后立即跳转到任务详情或在页面顶部展示进度条
- **错误处理与回滚**
  - 表单校验失败：就地提示
  - 网络失败：Toast error；`creatingJob=false`
- **边界条件**
  - 用户快速重复点击：按钮需禁用（loading）

#### 4.2 查看扫描任务进度与日志

- **触发入口**
  - 任务列表点击某条任务
  - 创建任务后自动打开
- **前置条件/互斥条件**
  - 必须登录
- **状态变化**
  - `activeJobId` 切换
  - 若本地无缓存：`jobDetailLoading=true`
- **网络调用**
  - `GET /sourcing/jobs/:jobId`
  - `GET /sourcing/jobs/:jobId/progress`（轮询或 SSE）
- **UI 表现**
  - 进度：百分比 + 阶段（发现候选/抓取详情/去重/打分/入库）
  - 日志：显示最近 N 条（可折叠），便于定位失败原因
- **错误处理与回滚**
  - 任务失败：显示失败原因、建议（如“触发限速”“解析失败”“需要更换关键词”）
- **边界条件**
  - 页面离开/切换任务时停止轮询（避免重复请求）

#### 4.3 浏览扫描结果（候选商品列表）

- **触发入口**
  - 扫描任务完成后点击「查看结果」
  - 工作台选择一个已完成任务作为数据集
- **前置条件/互斥条件**
  - 任务必须处于 `SUCCEEDED` 或 `PARTIAL_SUCCEEDED`
  - 列表加载中与筛选/排序互斥：需做请求取消或“以最后一次请求为准”
- **状态变化**
  - `activeDatasetJobId=jobId`
  - `filters`、`sort` 写入 store 并持久化到 `localStorage`（可选）
- **网络调用**
  - `GET /sourcing/jobs/:jobId/products`（分页）
- **UI 表现**
  - 列表卡片字段（最小集）：
    - 来源站点：`source` 标签（如 `1688`/`pdd`），用于快速识别数据来源
    - 标题、主图、价格区间、最小起订量、发货地、店铺信息
    - 热度指标（估算）、竞争指标（估算）、总分、置信度
    - 标签：新近上升、稳定热销、价格带优势、风险提示
  - 筛选器（建议）：
    - 数据源（Source，多选）
    - 价格区间、起订量、发货地、类目、总分、置信度、风险等级
  - 排序（建议）：
    - 总分、热度、利润空间、竞争强度、上升速度、上架新鲜度
- **错误处理与回滚**
  - 空数据：空态提示“调整关键词/类目/时间窗重新扫描”
- **边界条件**
  - 图片加载失败：降级为占位图（不影响列表滚动性能）

#### 4.4 选中、收藏与批量操作

- **触发入口**
  - 列表行复选框
  - 商品卡片「收藏」按钮
  - 顶部批量操作条（选中>0）
- **前置条件/互斥条件**
  - 必须登录（收藏写入服务端）；未登录仅允许临时选中但不落库（可选策略）
- **状态变化**
  - `selectedProductIds: Set<string>`
  - `shortlistProductIds: Set<string>`（若后端落库则以服务端为准）
- **网络调用**
  - `POST /sourcing/shortlist`、`DELETE /sourcing/shortlist/:productId`（若做服务端收藏）
- **UI 表现**
  - 批量操作：对比、批量分析、导出、加入清单、移出清单
- **错误处理与回滚**
  - 收藏失败：Toast error 并回滚 UI 状态
- **边界条件**
  - 选中集合过大：限制单次对比/分析的最大数量（例如 10/30），并给出提示

#### 4.5 商品详情页与证据链查看

- **触发入口**
  - 点击商品卡片
- **前置条件/互斥条件**
  - 必须登录（若后端数据归属于用户任务）
- **状态变化**
  - `activeProductId`
  - `productDetailLoading=true`
- **网络调用**
  - `GET /sourcing/products/:productId`
- **UI 表现**
  - 基础信息：标题、图集、SKU/规格（如有）、价格梯度、起订量、店铺评分、发货地、类目
  - 指标区：各子分 + 权重 + 解释文案
  - 证据链：显示本商品来自哪个扫描任务/来源入口/抓取时间戳（可展开原始片段/链接）
- **错误处理与回滚**
  - 若商品已下架/不可访问：显示“数据过期”并建议重新扫描

#### 4.6 触发商品分析（结构化指标 + 文本报告）

- **触发入口**
  - 商品详情页「生成分析」
  - 工作台批量选中后「批量分析」
- **前置条件/互斥条件**
  - 必须登录
  - 同一商品/同一任务版本的分析结果可缓存；若已存在且未过期，默认直接展示（提供“重新分析”）
- **状态变化**
  - `analysisByProductId[productId].status`：`IDLE | RUNNING | SUCCEEDED | FAILED`
- **网络调用**
  - `POST /sourcing/jobs/analysis`：创建分析任务
  - `GET /sourcing/analysis/:productId`：读取分析结果
- **UI 表现**
  - 结构化结论：推荐等级（S/A/B/C）、主卖点、主要风险、适合渠道（如跨境/内销/礼品）
  - 盈利测算（估算）：成本、物流、平台费、广告费、建议售价区间、毛利率区间
  - 竞争分析（估算）：同款数量、价格带拥挤度、差异化建议
  - 合规/风险：侵权关键词提示、敏感品类提示、供应不稳定信号
- **错误处理与回滚**
  - 分析失败：展示失败原因与重试按钮（限频）
- **边界条件**
  - 批量分析：UI 以队列形式展示进度，并允许中止（stop）

#### 4.7 对比视图（多商品并排）

- **触发入口**
  - 工作台批量选中 → 「对比」
  - 收藏清单 → 「对比」
- **前置条件/互斥条件**
  - 对比数量限制（如 2-10）
- **状态变化**
  - `compareProductIds`
- **网络调用**
  - 可复用 `GET /sourcing/products` 批量接口（建议后端提供），否则前端并发拉取详情（需并发控制）
- **UI 表现**
  - 表格维度（建议）：价格梯度、起订量、发货地、热度、竞争、利润、风险、综合推荐
  - 支持“按维度排序”和“高亮最优/最差”
- **错误处理与回滚**
  - 任一商品拉取失败：按列显示占位并提示可重试

#### 4.8 导出（CSV/JSON）与分享

- **触发入口**
  - 工作台批量选中 → 「导出」
  - 任务结果页 → 「导出全部」
- **前置条件/互斥条件**
  - 必须登录
  - 导出频控（后端）
- **状态变化**
  - `exporting=true`，成功后清理
- **网络调用**
  - `POST /sourcing/export`：返回文件名/下载链接（沿用现有 `downloadFile/downloadZip` 模式更一致）
- **UI 表现**
  - 导出字段选择（最小实现可固定字段）
  - 导出完成 Toast success，并提供“下载/打开文件夹”（Tauri 可扩展）
- **错误处理与回滚**
  - 导出失败：Toast error

---

### 5. 状态模型与数据结构（建议）

> 命名与风格建议对齐现有 `knowledgeStore/chatStore`：分页字段、loadingMore、viewportScroll 触发阈值等保持一致。

#### 5.1 TypeScript 类型（`types/sourcing.ts`）

- **SourcingJob**
  - `id: string`
  - `type: 'scan' | 'analysis'`
  - `source: string | string[]`（建议：扫描任务为 `string[]`，分析任务可为 `string` 或从商品上推导）
  - `status: 'PENDING' | 'RUNNING' | 'SUCCEEDED' | 'FAILED' | 'CANCELLED' | 'PARTIAL_SUCCEEDED'`
  - `createdAt/updatedAt: string`
  - `params: ScanParams | AnalysisParams`
  - `progress?: { percent: number; stage: string; message?: string }`
  - `error?: { code?: string; message: string; retryable?: boolean }`
- **SourcingProductSummary**
  - `productId: string`
  - `source: string`
  - `sourceItemId: string`
  - `title: string`
  - `imageUrl: string | null`
  - `priceMin/priceMax: number | null`
  - `moq: number | null`（minimum order quantity，最小起订量）
  - `shipFrom: string | null`
  - `score: { total: number; heat: number; competition: number; margin: number; risk: number; weights: Record<string, number> }`
  - `confidence: 'A' | 'B' | 'C'`
  - `tags: string[]`
  - `evidence: Array<{ type: string; capturedAt: string; ref: string; snippet?: string }>`
- **SourcingProductDetail**
  - `summary: SourcingProductSummary`
  - `images: string[]`
  - `shop: { name: string; url?: string; rating?: number | null; years?: number | null }`
  - `attributes?: Array<{ name: string; value: string }>`
  - `raw?: unknown`（可选：保留清洗前原始结构，用于 debug，但注意脱敏）
- **SourcingAnalysis**
  - `productId: string`
  - `version: string`（与扫描批次或算法版本绑定）
  - `status: 'RUNNING' | 'SUCCEEDED' | 'FAILED'`
  - `summary: { grade: 'S' | 'A' | 'B' | 'C'; oneLiner: string }`
  - `insights: Array<{ title: string; level: 'info' | 'warn' | 'risk'; content: string; evidenceRefs?: string[] }>`
  - `profitModel?: { cost: number; shipping: number; feeRate: number; ads: number; suggestedPriceMin: number; suggestedPriceMax: number; grossMarginMin: number; grossMarginMax: number }`
  - `risks: Array<{ type: string; level: 'low' | 'medium' | 'high'; message: string; mitigation?: string }>`
  - `createdAt: string`

#### 5.2 `sourcingStore`（MobX）字段建议

- **任务**
  - `jobList: SourcingJob[]`
  - `jobTotal/pageNo/pageSize/jobLoading/jobLoadingMore`
  - `activeJobId: string | null`
  - `jobDetailById: Map<string, SourcingJob>`
  - `jobProgressById: Map<string, { percent; stage; message? }>`
- **数据集与列表**
  - `activeDatasetJobId: string | null`
  - `productList: SourcingProductSummary[]`
  - `productTotal/pageNo/pageSize/productLoading/productLoadingMore`
  - `filters`、`sort`
- **选择与收藏**
  - `selectedProductIds: Set<string>`
  - `shortlistProductIds: Set<string>`
- **详情与分析缓存**
  - `productDetailById: Map<string, SourcingProductDetail>`
  - `analysisByProductId: Map<string, SourcingAnalysis>`
- **控制与清理**
  - `pollingTimersByJobId`（或统一 reaction）用于轮询进度并在切换/卸载清理

---

### 6. 协议与接口契约（前端依赖，建议）

> 路径仅为建议命名；实现时应在 `apps/frontend/src/service/api.ts` 建常量，并在 `service/index.ts` 按既有风格封装。

#### 6.1 创建扫描任务

- `POST /sourcing/jobs/scan`
  - Body:
    - `sources: string[]`（至少 1 个；如 `['1688','pdd']`）
    - `timeWindowDays: 7 | 14 | 30`
    - `categoryId?: string`
    - `keywords?: string[]`
    - `limit?: number`
    - `shipFrom?: string[]`
  - Response:
    - `{ jobId: string }`

#### 6.2 任务列表与详情

- `GET /sourcing/jobs`
  - Query: `pageNo/pageSize/type/status/source`
  - Response: `{ list: SourcingJob[]; total: number }`
- `GET /sourcing/jobs/:jobId`
  - Response: `SourcingJob`
- `GET /sourcing/jobs/:jobId/progress`
  - Response: `{ percent: number; stage: string; message?: string; updatedAt: string }`

#### 6.3 扫描结果：候选商品列表

- `GET /sourcing/jobs/:jobId/products`
  - Query: `pageNo/pageSize` + filters/sort（以 query 传递，保持幂等与可分享）
  - Response: `{ list: SourcingProductSummary[]; total: number }`

#### 6.4 商品详情

- `GET /sourcing/products/:productId`
  - Response: `SourcingProductDetail`

#### 6.5 分析任务与结果

- `POST /sourcing/jobs/analysis`
  - Body:
    - `productIds: string[]`
    - `jobId?: string`（绑定扫描批次）
    - `force?: boolean`（重新分析）
  - Response:
    - `{ jobId: string }`（批量分析任务）
- `GET /sourcing/analysis/:productId`
  - Query: `version?`
  - Response: `SourcingAnalysis`

#### 6.6 导出

- `POST /sourcing/export`
  - Body:
    - `jobId?: string`
    - `productIds?: string[]`
    - `format: 'csv' | 'json'`
    - `fields?: string[]`
  - Response:
    - `{ filename: string }`
  - 备注：前端复用现有 `downloadFile(filename)` 或 `downloadZip(filename)` 下载。

#### 6.7 鉴权与未授权

- 401 行为必须与现有全局一致（触发 `notifyUnauthorized()`，并提示 `请先登录后再试` 或等价文案）。

---

### 7. 互斥与状态机（关键规则）

- **任务创建 vs 任务轮询**：
  - 创建成功后才允许轮询进度；失败则不启动轮询。
  - 切换 `activeJobId` 必须停止旧轮询，避免并发请求与 UI 串数据。
- **列表加载 vs 筛选/排序**：
  - 同一数据集的请求以“最后一次请求为准”（需要 abort/cancel 或序号比对）。
- **批量分析队列**：
  - 允许并发度上限（例如同时 3 个商品分析），其余排队；UI 可展示队列长度。
- **选中集合**：
  - 切换 `activeDatasetJobId` 时默认清空 `selectedProductIds`（避免跨数据集误操作）。

---

### 8. 性能与工程约束

- **长列表性能**：
  - 列表分页 + 虚拟化（virtualization，列表虚拟化）视规模决定；最小实现先分页 + “触底加载更多”（可复用 72px 阈值的既有习惯）。
  - 图片懒加载，避免滚动卡顿。
- **轮询节流**：
  - 任务进度轮询间隔建议 \(1.5\sim3s\)，并在后台/不可见时降频（可选）。
- **缓存策略**：
  - `productDetailById` 与 `analysisByProductId` 做 LRU（least recently used，最近最少使用）或按数据集清理，避免内存无限增长。
- **稳定引用**：
  - 事件处理函数与派生数据用 memo/reaction 控制，避免筛选条件抖动导致重复请求。

---

### 9. 错误提示与 Toast 规范（建议文案）

- **未登录**
  - `请先登录后再使用选品功能`
- **任务创建失败**
  - `创建扫描任务失败：{reason}`
- **任务运行失败**
  - `扫描失败：{reason}（可重试）`
- **触发限速/风控**
  - `请求过于频繁，请稍后再试`
- **空结果**
  - `未找到符合条件的热门商品，建议调整关键词/类目/时间窗重新扫描`
- **导出失败**
  - `导出失败，请稍后再试`

静默策略（建议）：

- 进度轮询失败可最多静默重试 2 次；超过后在进度区展示“连接异常，点击重试”，避免频繁 Toast 打断。

---

### 10. 验收清单（可直接用于测试）

#### 10.1 扫描任务

- [ ] 登录后可创建 1688 扫描任务；提交期间按钮禁用。
- [ ] 创建后能看到任务进度（阶段+百分比）；离开页面后不再继续轮询。
- [ ] 任务失败能展示失败原因与“重试”入口。

#### 10.2 结果列表与筛选排序

- [ ] 任务完成后可进入结果列表；支持分页/触底加载更多。
- [ ] 筛选与排序会触发重新拉取并正确更新列表；不会出现旧请求覆盖新结果。
- [ ] 空结果有明确空态指引。

#### 10.3 选中/收藏/批量操作

- [ ] 列表可多选；选中后出现批量操作条。
- [ ] 收藏成功后状态可见；失败会回滚并提示。
- [ ] 切换数据集后选中集合会清空。

#### 10.4 商品详情与证据链

- [ ] 点击商品可进入详情页，展示基础信息、指标与证据链。
- [ ] 数据过期/不可访问时有降级提示与重新扫描建议。

#### 10.5 分析与对比

- [ ] 单品分析：点击生成分析后能看到运行态、成功态、失败态与重试。
- [ ] 批量分析：显示队列/进度，且能中止（stop）。
- [ ] 对比视图：2-10 个商品并排展示核心维度，高亮最优/最差。

#### 10.6 导出

- [ ] 批量导出选中商品为 CSV/JSON；导出完成可下载文件。
- [ ] 导出频控/失败提示清晰，不会重复弹 Toast 轰炸。

