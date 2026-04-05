# 前端路由与登录态（鉴权）说明

本文说明 `apps/frontend` 中「未登录禁止进入业务页」与「Token 失效后回登录」的实现思路、涉及文件及关键代码含义（含代码内注释对应关系）。

---

## 1. 设计思路（两层）

| 层级 | 触发时机 | 作用 |
|------|----------|------|
| **路由守卫（Layout）** | 用户进入带主布局（`Layout`）的页面、或刷新当前 URL | 仅根据 **是否存在 `localStorage.token`** 判断；无 token 且当前路径**不属于公开白名单**时，**客户端路由**跳转到 `/login`。 |
| **接口 401 收敛** | 任意 `http` 请求或 `streamFetch` 收到 **HTTP 401**（或解析体 `code === 401`） | **同步**清 `token` / `userInfo`，重置 `http` 与 `userStore`；若当前 URL **需要登录**，**整页** `location.replace('/login')`，避免刷新后仍停留在受保护页但 token 已失效。 |

**为何需要两层？**

- 仅 Layout 守卫：用户已在 `/chat` 刷新时，若 token 被删或过期但首屏未立刻发请求，可能短暂看到壳子；或本地仍残留过期 token，守卫会认为「已登录」。
- 仅 401：用户手动在地址栏输入受保护 URL 且不发请求时，不会触发接口，需要守卫拦截。

**公开页（白名单）** 与产品约定一致：**首页 `/`、`/login`、`/win`、`/about`、`/share/:shareId`、`/setting` 及其子路径** 不要求登录；其余路径（如 `/chat`、`/knowledge` 等）要求登录。

白名单的**唯一事实来源**为 `apps/frontend/src/router/authPaths.ts` 中的 `isPublicPath`。`apps/frontend/src/router/routes.ts` 顶部注释指向该文件，避免两处维护不一致。

---

## 2. 文件与职责

| 文件 | 职责 |
|------|------|
| `src/router/authPaths.ts` | 公开路径判断、`requiresAuthForPath`、`hasValidAuthToken` |
| `src/router/authSession.ts` | `notifyUnauthorized`：清会话 + 按需跳转登录 |
| `src/layout/index.tsx` | Layout 内 `useLayoutEffect` 重定向 + 无 token 时不渲染 `Outlet` |
| `src/utils/fetch.ts` | `HttpClient.request` 捕获 401 时调用 `notifyUnauthorized`，且不再弹通用错误 Toast |
| `src/utils/sse.ts` | `streamFetch` 在响应 401 时 `http.setAuthToken('')` + `notifyUnauthorized` |
| `src/router/routes.ts` | 路由表；注释说明白名单见 `authPaths` |

---

## 3. `authPaths.ts`（白名单与 token 判断）

实现要点：

- **`isPublicPath(pathname)`**：精确匹配或前缀匹配（`/setting`）、分享页用正则 `/^\/share\/[^/]+\/?$/`。
- **`requiresAuthForPath`**：对 `isPublicPath` 取反。
- **`hasValidAuthToken`**：读 `localStorage.getItem('token')?.trim()`；SSR 场景返回 `false`。

```typescript
// apps/frontend/src/router/authPaths.ts

/**
 * 未登录可访问的路径（与产品约定一致）。
 * 其余路径进入 Layout 后需携带有效 token，否则跳转 /login。
 */
export function isPublicPath(pathname: string): boolean {
	if (pathname === '/') return true;
	if (pathname === '/login') return true;
	if (pathname === '/win') return true;
	if (pathname === '/about') return true;
	if (pathname === '/setting' || pathname.startsWith('/setting/')) return true;
	// /share/:shareId
	if (/^\/share\/[^/]+\/?$/.test(pathname)) return true;
	return false;
}

/** 当前路径是否必须登录后才能访问（与 isPublicPath 互斥） */
export function requiresAuthForPath(pathname: string): boolean {
	return !isPublicPath(pathname);
}

export function hasValidAuthToken(): boolean {
	if (typeof window === 'undefined') return false;
	return Boolean(localStorage.getItem('token')?.trim());
}
```

**扩展白名单**：只改 `isPublicPath`，并在 `routes.ts` 注释中保持说明即可。

---

## 4. `authSession.ts`（401 后的统一收口）

实现要点：

- **`handlingUnauthorized`**：短时间内防重复进入（避免连续 401 多次 `replace`）。
- **同步**删除 `localStorage` 的 `token`、`userInfo`，并 `dispatchEvent('userInfoChanged')`，保证与 `useStorageInfo` 等监听一致；**避免**先 `replace` 再异步清理导致清理未执行完。
- **`http.setAuthToken('')`、`userStore.clearUserInfo()`** 使用 **动态 `import()`**，减轻与 `fetch` / `store` 的静态循环依赖风险。
- **仅在「当前路径需要登录」且非 `/login`** 时 `window.location.replace('/login')`：用户在**公开首页** `/` 上某接口 401 时，只清会话、**不**强制跳登录页。

```typescript
// apps/frontend/src/router/authSession.ts

import { requiresAuthForPath } from '@/router/authPaths';

let handlingUnauthorized = false;

/**
 * token 失效（如 401）：清理本地登录态；若当前在需登录页则整页跳转登录（刷新后同样生效）。
 */
export function notifyUnauthorized(): void {
	if (typeof window === 'undefined' || handlingUnauthorized) return;
	handlingUnauthorized = true;

	// 须同步清理，避免随后 location.replace 导致异步任务未执行完
	localStorage.removeItem('token');
	localStorage.removeItem('userInfo');
	window.dispatchEvent(new Event('userInfoChanged'));

	void import('@/utils/fetch').then(({ http }) => http.setAuthToken(''));
	void import('@/store/user').then((m) => m.default.clearUserInfo());

	const path = window.location.pathname;
	if (requiresAuthForPath(path) && path !== '/login') {
		window.location.replace('/login');
	}

	window.setTimeout(() => {
		handlingUnauthorized = false;
	}, 1500);
}
```

---

## 5. `layout/index.tsx`（Layout 内路由守卫）

实现要点：

- 使用 **`useLayoutEffect`**，尽量在绘制前发起 `navigate('/login', { replace: true })`，减少受保护内容一闪。
- **`state.from`**：携带 `pathname + search`，便于登录页将来做「登录后跳回原地址」（当前未强制使用，可后续接）。
- **`needAuth && !authed` 时不渲染 `<Outlet />`**：避免在重定向前短暂挂载子页面。

```typescript
// apps/frontend/src/layout/index.tsx（与鉴权相关的片段）

import { useLayoutEffect /* ... */ } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router';
import { hasValidAuthToken, requiresAuthForPath } from '@/router/authPaths';

const Layout = () => {
	const location = useLocation();
	const navigate = useNavigate();
	// ...

	const needAuth = requiresAuthForPath(location.pathname);
	const authed = hasValidAuthToken();

	useLayoutEffect(() => {
		if (!needAuth || authed) return;
		navigate('/login', {
			replace: true,
			state: { from: `${location.pathname}${location.search}` },
		});
	}, [needAuth, authed, location.pathname, location.search, navigate]);

	return (
		// ...
		<div className="...">
			{needAuth && !authed ? null : <Outlet />}
		</div>
		// ...
	);
};
```

**说明**：`/login`、`/about` 等不在 `Layout` 下的路由不会走上述逻辑，由 `isPublicPath` 与路由结构共同保证。

---

## 6. `fetch.ts`（普通 HTTP 与 401）

实现要点：

- 在 **`request` 的 `catch`** 中统一判断 **`response?.status === 401` 或 `requestError.code === 401`**（与后端 Nest `UnauthorizedException` 等对齐）。
- **401**：`this.setAuthToken('')` + `notifyUnauthorized()`，**不**走通用错误 Toast，避免与跳转重复打扰。
- **非 401**：保持原有 Toast 行为。

```typescript
// apps/frontend/src/utils/fetch.ts（片段）

import { notifyUnauthorized } from '@/router/authSession';

// 在 HttpClient.request 的 catch 中：
const isUnauthorized =
	response?.status === 401 || requestError.code === 401;

if (isUnauthorized) {
	this.setAuthToken('');
	notifyUnauthorized();
} else {
	Toast({
		type: 'error',
		title:
			requestError?.data?.data?.error?.message ||
			requestError?.data?.data?.message ||
			requestError.message ||
			'请求接口异常',
	});
}
```

---

## 7. `sse.ts`（流式请求与 401）

`streamFetch` 不经过 `HttpClient`，需单独处理 401：

- 先 **`http.setAuthToken('')`**（与 `fetch` 层单例一致），再 **`notifyUnauthorized()`**，最后 `throw` 供上层 `onError` 处理。

```typescript
// apps/frontend/src/utils/sse.ts（片段）

import { notifyUnauthorized } from '@/router/authSession';
import { getPlatformFetch, http } from '@/utils/fetch';

if (!response.ok) {
	if (response.status === 401) {
		http.setAuthToken('');
		notifyUnauthorized();
		throw new Error('请先登录后再试');
	} else {
		throw new Error(`HTTP error! status: ${response.statusText}`);
	}
}
```

---

## 8. `routes.ts` 中的文档注释

路由表文件顶部注明白名单以 `authPaths` 为准，避免新增路由时误以为「只要在 routes 里挂了页面就会自动鉴权」——**鉴权逻辑与路由配置解耦，白名单集中在 `authPaths`**。

```typescript
// apps/frontend/src/router/routes.ts（文件头）

/**
 * 路由表。鉴权白名单（未登录可访问）见 `@/router/authPaths` 的 `isPublicPath`：
 * 首页 `/`、`/login`、`/win`、`/about`、`/share/:shareId`、`/setting` 及其子路径。
 */
```

---

## 9. 与登出、登录的衔接

- **侧边栏登出**：应同时清 token 与 `userStore`（如 `userStore.clearUserInfo()`），与 `notifyUnauthorized` 中逻辑一致，避免内存与 `localStorage` 不一致。
- **登录成功**：写入 `token` 并 `userStore.setUserInfo`（项目内已持久化到 `localStorage`），`hasValidAuthToken()` 即为 true，Layout 守卫允许进入受保护页。

---

## 10. 排查清单

| 现象 | 可能原因 |
|------|----------|
| 公开页被踢到登录 | 检查 `pathname` 是否被 `isPublicPath` 正确覆盖（含尾部 `/`、query 仅影响 `location.search` 不影响 `pathname`）。 |
| 401 不跳转 | 是否走了非 `http` / 非 `streamFetch` 的裸 `fetch`；或后端返回非 401 的业务码。 |
| 循环跳转 | 确认 `/login` 在 `isPublicPath` 内，且 `notifyUnauthorized` 对 `/login` 不再 `replace`。 |

---

## 11. 相关路径速查（仓库内）

- `apps/frontend/src/router/authPaths.ts`
- `apps/frontend/src/router/authSession.ts`
- `apps/frontend/src/layout/index.tsx`
- `apps/frontend/src/utils/fetch.ts`
- `apps/frontend/src/utils/sse.ts`
- `apps/frontend/src/router/routes.ts`
