### 企业级 SPEC 模板（骨架）

> 使用方式：把本骨架复制到目标 `*.md`，再按代码实现填充。每一条都要能在代码里对上号。

---

### 1. 目标与范围

- **目标**：模块解决什么问题、提供哪些能力
- **范围**：包含/不包含哪些页面、组件、接口、存储
- **非目标**：明确不做的事（防止需求蔓延）

---

### 2. 目录结构与关键入口

- **入口文件**：路由/页面/组件的 entry
- **关键依赖**：
  - Store（状态管理）
  - Hooks（业务编排）
  - service/api（网络）
  - utils（协议/算法）
  - types（数据结构）
  - contexts（跨组件共享）

---

### 3. 核心概念与术语

- **术语**：英文术语（中文）+ 在本模块的具体含义
- **关键标识**：id/key/canonicalKey/sessionId/documentIdentity 等
- **模式**：受控/非受控、ephemeral/持久化、split/splitDiff 等

---

### 4. 用户可见功能点（按用户动作拆分）

> 每个功能点都用同一格式：触发入口 → 前置条件 → 状态变化 → 网络 → UI 表现 → 错误与回滚。

#### 4.x 功能点标题

- **触发入口**
- **前置条件/互斥条件**
- **状态变化（state/ref/map）**
- **网络调用（endpoint + 请求体/响应/事件）**
- **UI 表现**
- **错误处理与回滚**
- **边界条件**

---

### 5. 状态模型与数据结构

- **核心数据结构**：Message/Session/Document 等关键字段
- **状态来源**：Store vs local state vs ref vs derived memo
- **派生数据**：displayMessages、selectionMap、snapshot 等如何计算
- **清理策略**：切换/卸载/异常时如何清理

---

### 6. 协议与接口契约

- **请求与响应结构**：字段、含义、限制（size/max、窗口截断等）
- **流式协议**：data 行格式、type/done/error/usage、回调映射
- **鉴权与未授权**：401 行为、全局处理

---

### 7. 互斥与状态机（关键规则）

- **互斥矩阵**：例如 sharing vs input、preview vs diff vs assistant
- **状态机**：sending/historyLoading/streaming/stopped 等转移条件

---

### 8. 性能与工程约束

- **节流/缓冲**：rAF、batch update
- **观察器**：ResizeObserver/MutationObserver 的订阅与释放
- **稳定引用**：memo/reaction/避免依赖抖动
- **大数据场景**：长列表/大文档的处理策略

---

### 9. 错误提示与 Toast 规范

- **用户可见文案**：触发条件与文案
- **静默失败策略**：哪些失败不打断用户、如何降级

---

### 10. 验收清单（可直接用于测试）

- **功能**：逐条可验收
- **边界**：空数据/无权限/中断/快速切换/并发
- **回归点**：最容易出 bug 的点（如回滚、切分支、Diff dispose、IME）

