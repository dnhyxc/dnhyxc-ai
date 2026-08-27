# modules/ebook/

电子书阅读页的 `api.modules.ebook` Host 实现。

## 职责

- 阅读页通过 `setEbookHostHandlers` 绑定当前书籍与导航
- `createEbookModulesApi()` 返回冻结代理，bridge 装配后插件可读最新 handlers
- 权限门闩：`modules:ebook`

## 文件

| 文件 | 说明 |
|------|------|
| `hostApi.ts` | `getBookId` / `navigateToCfi` / `openThought` 等 |

## Host 绑定（阅读页）

```ts
import { setEbookHostHandlers } from '@/federation';

setEbookHostHandlers({
  getBookId: () => book.id,
  navigateToCfi: (cfi) => …,
  openThought: (thought) => …,
});
```

## 插件侧

```ts
const bookId = api.modules?.ebook?.getBookId();
await api.modules?.ebook?.navigateToCfi(cfi);
```

## 关联

- runtime 注册 → [`../../runtime/`](../../runtime/README.md)
- Surface 挂载 → [`../../host/PluginHostSurface.tsx`](../../host/PluginHostSurface.tsx)
