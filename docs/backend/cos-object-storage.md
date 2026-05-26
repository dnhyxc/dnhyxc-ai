# 腾讯云 COS 对象存储（头像等云上传）

> **文档角色（主文档）**：七牛直传迁移为腾讯云 COS 服务端上传；聊天附件仍走本地上传。  
> **延伸阅读**  
> - 本地上传目录：[upload-storage-paths.md](./upload-storage-paths.md)  
> - 开发态图片同源代理（沿用 `/ext-cos/`）：[../frontend/qiniu-dev-http-proxy.md](../frontend/qiniu-dev-http-proxy.md)（七牛历史说明，域名变量已改为 COS）  
> - 生产 Nginx `/ext-cos/`：[nginx.md](./nginx.md)  
> - 聊天附件预览（与 COS 无关）：[../chat/chat-upload-preview.md](../chat/chat-upload-preview.md)

若与仓库最新源码不一致，以源码为准。

---

## 1. 背景与目标

### 1.1 要解决的问题

- 账户头像、下载页演示上传等原先依赖**七牛云前端直传**（`getUploadToken` + `qiniu-js`），密钥与上传域分散在前端，维护成本高。
- 需统一为**腾讯云对象存储（COS）**，由后端持有 SecretId/SecretKey，通过官方 Node.js SDK 上传。

### 1.2 目标与边界

| 能力 | 存储 | 上传方式 |
|------|------|----------|
| 头像、下载页云图 | COS `assets/` 前缀 | `POST /api/upload/uploadCos`（内存 multipart → `putObject`） |
| 对话附件、本地下载 | `uploads/images`、`uploads/files` | 既有 `POST /api/upload/uploadFile`（multer 落盘） |

**持久化**：数据库/用户信息中存后端返回的**完整 HTTPS 对象 URL**（非签名 URL）。  
**展示**：Web 开发/生产通过 `resolveCosUrlForWebDisplay` 改写为同源 `/ext-cos/`；Tauri 生产包直链 COS HTTPS 域名。

---

## 2. 改动范围

### 后端

- `apps/backend/src/enum/config.enum.ts` — `CosEnum` 替代 `QiniuEnum`
- `apps/backend/src/services/upload/cos.config.ts` — **新增**：配置读取、ACL 解析、COS 错误文案
- `apps/backend/src/services/upload/upload.service.ts` — `cos-nodejs-sdk-v5`、`uploadObjectToCos`
- `apps/backend/src/services/upload/upload.controller.ts` — 移除 `getUploadToken`，新增 `uploadCos`
- `apps/backend/package.json` — `qiniu` → `cos-nodejs-sdk-v5`

### 前端

- `apps/frontend/src/service/api.ts`、`service/index.ts` — `uploadCosFile`
- `apps/frontend/src/views/account/index.tsx`、`download/index.tsx` — 去掉 `qiniu-js`
- `apps/frontend/src/utils/index.ts` — `getCosPublicDomainPrefix`、`resolveCosUrlForWebDisplay`
- `apps/frontend/vite.config.ts` — `/ext-cos` 回源 `VITE_COS_PUBLIC_DOMAIN`
- `apps/frontend/src-tauri/Info.plist`、`capabilities/default.json` — 七牛 HTTP 例外改为 COS HTTPS 域

---

## 3. 实现思路

### 3.1 为何改为服务端上传

- 永久密钥只留在后端 `.env`，前端不再拿 upload token。
- 与 [腾讯云 COS Node.js 快速入门](https://cloud.tencent.com/document/product/436/8629) 一致：单例 `COS` 客户端，`putObject` 写入对象。

### 3.2 对象键与 URL

- 键名：`assets/{uuid}_{安全化文件名}`，禁止路径穿越（`basename` + 替换 `/` `\`）。
- 对外 URL：`COS_PUBLIC_DOMAIN` + 分段 `encodeURIComponent`（支持文件名中的 `@` 等字符）。

### 3.3 ACL 与 403

- 默认 `COS_OBJECT_ACL=public-read`，浏览器与 `/ext-cos` 等同源代理可直接 GET。
- 若设为 `private`，匿名访问对象 URL 会 **403**；需另行实现**签名 URL** 或后端代理读（当前仓库未内置签名接口，部署私有桶前须评估）。

### 3.4 CAM 权限

- 上传失败 `AccessDenied`：`headBucket` 可能成功但 `putObject` 失败，多为子账号缺少 `cos:PutObject`。
- `formatCosUploadError` 会在接口层返回可操作的中文提示。

### 3.5 与七牛展示链的衔接

- `/ext-cos/` 代理逻辑保留，仅将 `VITE_QINIU_DOMAIN` 换为 `VITE_COS_PUBLIC_DOMAIN`（仍兼容旧变量名读取）。
- 库内旧七牛 HTTP 头像 URL 在配置旧域名时仍可被 `resolveCosUrlForWebDisplay` 识别。

### 3.6 同源代理路径命名（`/ext-cos`）

- 默认 **`/ext-cos/`**，表示经本站代理访问 COS 上的**任意对象**（图片、后续可能的 PDF 等），MIME 不做限制。
- 环境变量：**`VITE_COS_PROXY_PREFIX`**（默认 `/ext-cos/`）；**不再**支持历史 `/ext-img/` 或 `VITE_WEB_IMAGE_PROXY_PREFIX`（Vite、Nginx、前端 URL 工具均只认当前前缀）。
- **Vite dev**：注册 `VITE_COS_PROXY_PREFIX` 对应路径，rewrite 后回源 `VITE_COS_PUBLIC_DOMAIN`（迁移期仍可读 `VITE_QINIU_DOMAIN` 作为回源域名）。
- **Nginx 生产**：仅配置 `location /ext-cos/`（见 `nginx.md` 示例）。

### 3.7 云对象下载（与展示 URL 分离）

**问题**：展示层把 COS URL 改写为 `/ext-cos/assets/...` 后，若下载仍用该相对路径或跨域直链，浏览器 `<a download>` / Tauri `download_file` 会失败。

**策略**：

| 环境 | 下载实际请求的 URL |
|------|-------------------|
| Web | 同源绝对地址 `origin + /ext-cos/...`，经 `fetch` 拉取 blob 再 `downloadBlob` 落盘 |
| Tauri | 还原为桶上 HTTPS 直链 `resolveCosCanonicalObjectUrl`（插件不认 `/ext-cos` 相对路径） |

- **`downloadFileFromUrl`**：先 `resolveUrlForDownload`，COS/同源资源走 fetch；其余仍可用 `<a download>` 或 Tauri 原生下载。
- **`handlerDownload`**：供 `ImagePreview` 默认下载，结束后 **Toast** 提示成功/失败（与 `Upload` 组件一致）。

---

## 4. 关键代码与注释

### 4.1 环境变量（CosEnum）

**来源**：`apps/backend/src/enum/config.enum.ts`（约 L28–L43）

```typescript
/** 腾讯云 COS（对象存储） */
export enum CosEnum {
  COS_SECRET_ID = 'COS_SECRET_ID',
  COS_SECRET_KEY = 'COS_SECRET_KEY',
  /** 存储桶名称，格式 BucketName-APPID */
  COS_BUCKET = 'COS_BUCKET',
  /** 地域，如 ap-guangzhou */
  COS_REGION = 'COS_REGION',
  /**
   * 对象对外访问域名（CDN 或默认桶域名），如 https://xxx.cos.ap-guangzhou.myqcloud.com/
   * 未配置时由 Bucket + Region 拼接默认域名。
   */
  COS_PUBLIC_DOMAIN = 'COS_PUBLIC_DOMAIN',
  /** putObject 对象 ACL，默认 public-read（浏览器直读） */
  COS_OBJECT_ACL = 'COS_OBJECT_ACL',
}
```

### 4.2 配置读取与错误提示

**来源**：`apps/backend/src/services/upload/cos.config.ts`（`getCosRuntimeConfig`、`formatCosUploadError` 附近）

```typescript
// 说明：兼容迁移期仍可能存在的 ACCESS_KEY / BUCKET_NAME / DOMAIN（七牛命名）
const secretId = config[CosEnum.COS_SECRET_ID] || config.ACCESS_KEY || '';
const bucket = config[CosEnum.COS_BUCKET] || config.BUCKET_NAME || '';

// 未配置 COS_PUBLIC_DOMAIN 时自动拼接默认桶域名
if (!publicDomain && bucket && region) {
  publicDomain = `https://${bucket}.cos.${region}.myqcloud.com/`;
}

objectAcl: parseCosObjectAcl(config[CosEnum.COS_OBJECT_ACL]), // 默认 public-read
```

### 4.3 上传到 COS

**来源**：`apps/backend/src/services/upload/upload.service.ts`（`uploadObjectToCos` 约 L60–L96）

```typescript
const key = this.buildCosObjectKey(file.originalname); // assets/{uuid}_{name}

await cos.putObject({
  Bucket: config.bucket,
  Region: config.region,
  Key: key,
  Body: file.buffer, // 控制器侧 memoryStorage，不落本地盘
  ContentType: file.mimetype || 'application/octet-stream',
  ACL: config.objectAcl, // CosObjectAcl，与 SDK 类型对齐
});

return {
  key,
  url: this.buildCosPublicUrl(key), // 持久化用完整 HTTPS URL
  // ...
};
```

### 4.4 HTTP 接口

**来源**：`apps/backend/src/services/upload/upload.controller.ts`（约 L36–L51）

```typescript
/** 上传文件到腾讯云 COS（头像、下载页图片等） */
@Post('/uploadCos')
@UseInterceptors(FileInterceptor('file', cosMemoryUpload)) // 20MB、memoryStorage
async uploadCos(@UploadedFile() file: Express.Multer.File) {
  return await this.uploadService.uploadObjectToCos(file);
}
```

已删除：`GET /upload/getUploadToken`。

### 4.5 前端上传与展示

**来源**：`apps/frontend/src/views/account/index.tsx`（`uploadAvatarToCos` 约 L227–L235）

```typescript
const res = await uploadCosFile(file); // POST multipart → /upload/uploadCos
if (res?.data?.url) {
  setAccountInfo((prev) => ({ ...prev, avatar: res.data.url }));
}
```

**来源**：`apps/frontend/src/utils/index.ts`（`getCosProxyPrefix`、`isCosProxyPathUrl`、`resolveCosUrlForWebDisplay` 约 L42–L103）

```typescript
// 说明：展示用代理前缀，默认 /ext-cos/；仅认 VITE_COS_PROXY_PREFIX，无 /ext-img 回退
export function getCosProxyPrefix(): string {
  const raw = import.meta.env.VITE_COS_PROXY_PREFIX || '/ext-cos/';
  const withLeading = raw.startsWith('/') ? raw : `/${raw}`;
  return withLeading.endsWith('/') ? withLeading : `${withLeading}/`;
}

export function isCosProxyPathUrl(url: string): boolean {
  const normalized = url.startsWith('/') ? url : `/${url}`;
  return normalized.startsWith(getCosProxyPrefix());
}

export const resolveCosUrlForWebDisplay = (url?: string): string => {
  if (!url) return '';
  if (import.meta.env.DEV) return rewriteCosUrlToSameOriginProxy(url);
  if (isTauriRuntime()) return url; // Tauri 生产：直链 COS HTTPS
  if (!import.meta.env.PROD) return url;
  return rewriteCosUrlToSameOriginProxy(url);
};
```

### 4.6 Vite 开发代理

**来源**：`apps/frontend/vite.config.ts`（约 L11–L25、L79–L85）

```typescript
// 说明：回源目标优先 VITE_COS_PUBLIC_DOMAIN，迁移期可读 VITE_QINIU_DOMAIN
const cosProxyTarget = (
  env.VITE_COS_PUBLIC_DOMAIN ||
  env.VITE_QINIU_DOMAIN ||
  'https://example.cos.ap-guangzhou.myqcloud.com'
).replace(/\/$/, '');

const cosProxyPrefixRaw = env.VITE_COS_PROXY_PREFIX || '/ext-cos/';
const cosProxyPathname = (
  cosProxyPrefixRaw.startsWith('/') ? cosProxyPrefixRaw : `/${cosProxyPrefixRaw}`
).replace(/\/$/, '') || '/ext-cos';

// server.proxy：仅注册一条 COS 代理键，无 /ext-img 双路由
[cosProxyPathname]: {
  target: cosProxyTarget,
  changeOrigin: true,
  rewrite: (path) =>
    path.replace(new RegExp(`^${cosProxyPathname}`), '') || '/',
},
```

### 4.7 下载 URL 解析与 fetch 落盘

**来源**：`apps/frontend/src/utils/index.ts`（`resolveUrlForDownload`、`shouldDownloadViaFetch`、`downloadFileFromUrl` 约 L169–L313）

```typescript
// 说明：Tauri 必须拿到桶域名直链；Web 把 /ext-cos 或 COS 域名转为可 fetch 的同源绝对 URL
export function resolveUrlForDownload(url: string): string {
  if (isTauriRuntime()) return resolveCosCanonicalObjectUrl(url);
  if (isCosProxyPathUrl(url)) {
    const path = url.startsWith('/') ? url : `/${url}`;
    return `${window.location.origin}${path}`;
  }
  if (isCosStoredObjectUrl(url)) {
    const proxied = rewriteCosUrlToSameOriginProxy(url);
    return `${window.location.origin}${proxied}`;
  }
  return url;
}

// downloadFileFromUrl：COS / 同源 → platformFetch → blob → downloadBlob
const resolvedUrl = resolveUrlForDownload(url);
if (shouldDownloadViaFetch(url, resolvedUrl)) {
  const response = await platformFetch(resolvedUrl, { method: 'GET' });
  const blob = await response.blob();
  return await downloadBlob({ file_name: name, id: downloadId }, blob);
}
```

### 4.8 图片预览下载 + Toast

**来源**：`apps/frontend/src/utils/index.ts`（`handlerDownload` 约 L541–L551）

**来源**：`apps/frontend/src/components/design/ImagePreview/index.tsx`（`onDownload` 约 L526–L532）

```typescript
// utils：与 Upload 相同 Toast 反馈
export const handlerDownload = async (url: string, file_name?: string) => {
  const res = await downloadFileFromUrl({ url, file_name });
  Toast({ type: res.success, title: res.message });
  return res;
};

// ImagePreview：默认走 handlerDownload；自定义 download 回调由调用方自行处理
const onDownload = useCallback(async () => {
  if (download) { download(currentImage); return; }
  await handlerDownload(currentImage.url);
}, [download, currentImage]);
```

---

## 5. 部署与环境变量

### 5.1 后端 `apps/backend/.env`

```env
COS_SECRET_ID=
COS_SECRET_KEY=
COS_BUCKET=桶名-APPID
COS_REGION=ap-shanghai
COS_PUBLIC_DOMAIN=https://桶名-APPID.cos.ap-shanghai.myqcloud.com/
COS_OBJECT_ACL=public-read
```

### 5.2 前端 `apps/frontend/.env`

```env
VITE_COS_PUBLIC_DOMAIN=https://桶名-APPID.cos.ap-shanghai.myqcloud.com/
VITE_COS_PROXY_PREFIX=/ext-cos/
```

前后端 **COS 对外域名须一致**。换桶时同步 Vite 代理、Nginx `proxy_pass`、Tauri `http.allowlist`（若使用自定义 CDN 域）。

### 5.3 行为变化

| 项目 | 之前（七牛） | 现在（COS） |
|------|-------------|-------------|
| 上传 API | `GET getUploadToken` + 前端直传 | `POST uploadCos` 经后端 |
| 依赖 | `qiniu` / `qiniu-js` | `cos-nodejs-sdk-v5` |
| 聊天附件 | 本地上传 | **不变** |

破坏性：

- 客户端若仍调用 `getUploadToken` 将 404，须改用 `uploadCosFile`。
- 若线上曾配置 `/ext-img/` 代理或书签缓存了该前缀，需改为 `/ext-cos/` 或重新上传/刷新展示链。

---

## 6. 测试与回归建议

1. 配置 CAM：`cos:PutObject`、`cos:GetObject`（公有读或签名场景）覆盖 `assets/*`。
2. 登录 → 账户设置上传头像 → 保存 → 侧栏与资料页预览正常。
3. 无痕窗口直接打开返回的 `url`：公有读应 **200**；`private` 应为 **403**（符合预期）。
4. Web HTTPS 站点：头像走 `/ext-cos/`，无 mixed content 报错。
5. **下载**：`ImagePreview` 大图预览点下载 → Toast 成功；`Upload` 悬停下载 → Toast；Network 中 Web 为同源 `/ext-cos/...` fetch，Tauri 为 COS 直链。
6. Tauri 生产包：确认 COS 域名在 allowlist；HTTPS 一般无需 ATS 明文例外。
7. 对话附件上传/预览：确认仍走 `/images`、`/files`，不受 COS 配置影响。
8. Nginx：确认已配置 `location /ext-cos/`。

---

## 7. 相关源码索引

| 说明 | 路径 |
|------|------|
| COS 配置与 ACL | `apps/backend/src/services/upload/cos.config.ts` |
| 上传与 URL 构建 | `apps/backend/src/services/upload/upload.service.ts` |
| 路由 | `apps/backend/src/services/upload/upload.controller.ts` |
| 前端 API | `apps/frontend/src/service/api.ts`、`service/index.ts` |
| 展示 / 下载 URL 工具 | `apps/frontend/src/utils/index.ts`（`resolveCosUrlForWebDisplay`、`resolveUrlForDownload`、`handlerDownload`） |
| 图片预览下载 | `apps/frontend/src/components/design/ImagePreview/index.tsx` |
| Vite 代理 | `apps/frontend/vite.config.ts` |
| 本地上传（不变） | `apps/backend/src/utils/upload-paths.ts`、`docs/backend/upload-storage-paths.md` |

---

## 8. 延伸阅读

- [upload-storage-paths.md](./upload-storage-paths.md) — 聊天附件本地上传
- [../frontend/qiniu-dev-http-proxy.md](../frontend/qiniu-dev-http-proxy.md) — `/ext-cos/` 与 mixed content（历史七牛语境，机制仍适用 COS）
