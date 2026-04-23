# Tauri macOS 生产包访问 HTTP 域名（ATS）处理记录

本文档记录 `apps/frontend` 在 **Tauri v2** 打包为 **macOS 生产包**后，访问 `http://` 资源被系统策略拦截（ATS）的原因、解决思路与具体代码落点。

---

## 1. 现象与报错

生产包中加载 `http://` 域名资源（例如图片）时，WebView 控制台常见报错类似：

- `Failed to load resource: The network connection was lost.`
- `Failed to load resource: The resource could not be loaded because the App Transport Security policy requires the use of a secure connection.`

示例资源：

- `http://tdxerr4c5.hd-bkt.clouddn.com/128x128@2x.png`

---

## 2. 根因

macOS 的 **ATS（App Transport Security，应用传输安全）** 默认要求网络请求使用 **HTTPS（TLS，加密传输）**。  
在 Tauri 的 macOS 生产包中，前端运行在 `WKWebView` 内，加载外部 `http://` 资源会被 ATS 直接阻断，从而出现“资源无法加载 / 连接丢失”等错误。

> 注意：这不是前端代码的 fetch/axios 逻辑问题，而是系统层的网络安全策略。

---

## 3. 解决思路（推荐顺序）

### 3.1 最佳方案：切到 HTTPS

把资源域名升级为 HTTPS 是最推荐的做法，安全性与兼容性最好，无需在客户端放行明文 HTTP。

### 3.2 折中方案：仅对特定域名放行 HTTP（本次采用）

在 macOS 应用的 `Info.plist` 中配置 ATS 的 **NSExceptionDomains**，只对必须的域名放行明文 HTTP。

Tauri v2 支持将 `src-tauri` 目录下的 `Info.plist` 自动合并进最终打包产物，因此我们选择在仓库中新增该文件。

### 3.3 不推荐：全局放开 HTTP

设置 `NSAllowsArbitraryLoads = true` 会放开所有 HTTP，风险更高（尤其是加载第三方资源时），一般不建议在生产包里这样做。

---

## 4. 具体代码改动

### 4.1 新增/修改文件

- **macOS ATS 放行配置**：`apps/frontend/src-tauri/Info.plist`

关键配置（仅放行 `tdxerr4c5.hd-bkt.clouddn.com`）：

```xml
<key>NSAppTransportSecurity</key>
<dict>
  <key>NSExceptionDomains</key>
  <dict>
    <key>tdxerr4c5.hd-bkt.clouddn.com</key>
    <dict>
      <key>NSExceptionAllowsInsecureHTTPLoads</key>
      <true/>
      <key>NSIncludesSubdomains</key>
      <true/>
    </dict>
  </dict>
</dict>
```

如果需要同时放行多个域名，可以在 `NSExceptionDomains` 下追加多个域名节点，例如：

```xml
<key>NSAppTransportSecurity</key>
<dict>
  <key>NSExceptionDomains</key>
  <dict>
    <key>tdxerr4c5.hd-bkt.clouddn.com</key>
    <dict>
      <key>NSExceptionAllowsInsecureHTTPLoads</key>
      <true/>
      <key>NSIncludesSubdomains</key>
      <true/>
    </dict>

    <key>example-http-assets.com</key>
    <dict>
      <key>NSExceptionAllowsInsecureHTTPLoads</key>
      <true/>
      <key>NSIncludesSubdomains</key>
      <true/>
    </dict>
  </dict>
</dict>
```

### 4.2 为什么放在 `src-tauri/Info.plist`

根据 Tauri v2 配置说明，Tauri 会自动寻找并合并与配置文件同目录的 `Info.plist`，也可以通过配置项显式指定 “用于合并的 Info.plist 路径”。  
本项目采用“同目录自动合并”的最小改动方式，便于维护与审计。

---

## 5. 验证方式

重新打包 macOS 生产包后，打开应用，确认：

- 控制台不再出现 ATS 相关报错
- `http://tdxerr4c5.hd-bkt.clouddn.com/128x128@2x.png` 能正常加载

如果你在 CI 环境或本机环境中遇到 `--ci` 参数解析异常，可以临时通过取消环境变量 `CI` 的方式运行构建：

```bash
cd apps/frontend
env -u CI pnpm run tauri build --debug
```

---

## 6. 常见坑与注意事项

- **域名必须不带协议与端口**：ATS 的域名例外按 `host` 配置，不能写 `http://`、不能带 `:80`。
- **尽量只放行必要域名**：避免使用 `NSAllowsArbitraryLoads`。
- **多域名场景**：继续在 `NSExceptionDomains` 下追加多个域名即可（每个域名一个 dict）。

