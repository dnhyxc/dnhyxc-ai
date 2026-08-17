# 七、桌面端 Tauri

## 7.1 系统架构

### 7.1.1 双层架构

```
┌─────────────────────────────────────────┐
│           前端 TypeScript 桥接层          │
│  ┌───────────────────────────────────┐  │
│  │  @tauri-apps/api (invoke, path)   │  │
│  └───────────────────────────────────┘  │
│  ┌───────────────────────────────────┐  │
│  │  前端封装模块                      │  │
│  │  utils/tauri/                     │  │
│  └───────────────────────────────────┘  │
├─────────────────────────────────────────┤
│           Tauri 命令系统                  │
│  ┌───────────────────────────────────┐  │
│  │  commands/ (窗口、菜单、HTTP)      │  │
│  └───────────────────────────────────┘  │
│  ┌───────────────────────────────────┐  │
│  │  system/ (快捷键、托盘)            │  │
│  └───────────────────────────────────┘  │
├─────────────────────────────────────────┤
│           Rust 原生层                     │
│  ┌───────────────────────────────────┐  │
│  │  window: create, close, minimize  │  │
│  │  menu: build, set_accelerator      │  │
│  │  http: rewrite, retry             │  │
│  │  shortcuts: register, reload      │  │
│  └───────────────────────────────────┘  │
├─────────────────────────────────────────┤
│           macOS API 桥接                  │
│  ┌───────────────────────────────────┐  │
│  │  objc2: NSWindow, NSApplication   │  │
│  │  fullscreen: NSWindowWillExit...  │  │
│  │  drag: AsyncFileDialog             │  │
│  └───────────────────────────────────┘  │
└─────────────────────────────────────────┘
```

### 7.1.2 代码结构

```
apps/frontend/src-tauri/
├── src/
│   ├── commands/
│   │   ├── window.rs        # 窗口操作
│   │   ├── menu.rs          # 系统菜单
│   │   ├── http.rs          # HTTP 重试
│   │   └── file.rs          # 文件选择
│   ├── system/
│   │   ├── shortcut.rs      # 全局快捷键
│   │   └── tray.rs          # 系统托盘
│   ├── macOS/
│   │   ├── fullscreen.rs    # macOS 全屏同步
│   │   ├── drag.rs          # macOS 拖拽
│   │   └── at.rs            # ATS 配置
│   ├── window_zoom.rs       # 窗口缩放动画
│   ├── lib.rs
│   └── main.rs
├── tauri.conf.json
├── Cargo.toml
└── capabilities/
    └── default.json

apps/frontend/src/utils/tauri/
├── index.ts                 # 主入口
├── window.ts                # 窗口操作封装
├── menu.ts                  # 菜单封装
├── shortcut.ts              # 快捷键封装
├── file.ts                  # 文件选择封装
└── http.ts                  # HTTP 请求封装
```

---

## 7.2 窗口管理

### 7.2.1 全屏同步

```rust
// src-tauri/src/macOS/fullscreen.rs
use objc2::{
  class_type, declare_class,
  runtime::{Object, Sel},
};
use objc2_mac_app::NSApplication;
use objc2_app_kit::{NSNotification, NSWindow, NSWindowWillExitFullScreenNotification};

// 监听 macOS 全屏通知
fn setup_fullscreen_listener(app_handle: &AppHandle) {
    let center = unsafe {
        NSApplication::sharedApplication().notificationCenter()
    };

    // 添加观察者
    let notification_name = unsafe {
        NSWindowWillExitFullScreenNotification
    };

    center.addObserver_forName_object_queue_block(
        &block,
        notification_name,
        None,
        None,
        |notification| {
            // 通知前端切换影院态
            app_handle.emit("tauri:fullscreen-changed", true)
                .expect("Failed to emit fullscreen change");
        },
    );
}
```

### 7.2.2 窗口缩放

```rust
// src-tauri/src/window_zoom.rs
#[tauri::command]
pub async fn zoom_window(window: WebviewWindow, target_size: (f64, f64)) -> Result<(), String> {
    // 获取当前窗口位置
    let current_position = window
        .outer_position()
        .map_err(|e| e.to_string())?;

    // 目标尺寸预布局
    window.set_size(LogicalSize::new(target_size.0, target_size.1))
        .map_err(|e| e.to_string())?;

    // unveil 动画：从当前位置平滑过渡
    window.set_outer_position(current_position)
        .map_err(|e| e.to_string())?;

    // 等待动画完成
    tokio::time::sleep(Duration::from_millis(300)).await;

    Ok(())
}
```

### 7.2.3 About 窗口

```typescript
// 前端
async function openAboutWindow() {
  if (isTauriRuntime()) {
    await invoke('open_about_window');
  } else {
    window.open('/about', '_blank');
  }
}
```

```rust
// Rust
#[tauri::command]
pub fn open_about_window(app: AppHandle) -> Result<(), String> {
  // 独立 chunk 加载
  let url = format!("https://{}/about", "localhost");

  if app.get_webview_window("about").is_none() {
    WebviewWindowBuilder::new(app, "about", WebviewUrl::App("/about".into()))
        .title("关于")
        .inner_size(480.0, 360.0)
        .center()
        .build()
        .map_err(|e| e.to_string())?;
  }

  // 预同步主题
  read_window_chrome_theme_sync(&app)?;
  Ok(())
}
```

---

## 7.3 系统菜单

### 7.3.1 菜单构建

```rust
// src-tauri/src/commands/menu.rs
pub fn build_menu(app: &AppHandle) -> Result<Menu, String> {
  let file_menu = Menu::with_items(
    &app.handle(),
    &[
        MenuItem::with_id(app.handle(), "new-chat", "新对话")?,
        MenuItem::with_id(app.handle(), "save", "保存")?,
        PredefinedMenuItem::separator(),
        MenuItem::with_id(app.handle(), "quit", "退出")?,
    ],
  )?;

  let edit_menu = Menu::with_items(
    &app.handle(),
    &[
        MenuItem::with_id(app.handle(), "undo", "撤销")?,
        MenuItem::with_id(app.handle(), "redo", "重做")?,
        PredefinedMenuItem::separator(),
        MenuItem::with_id(app.handle(), "cut", "剪切")?,
        MenuItem::with_id(app.handle(), "copy", "复制")?,
        MenuItem::with_id(app.handle(), "paste", "粘贴")?,
    ],
  )?;

  // 应用主菜单
  app.set_menu(&Menu::with_items(
    &app.handle(),
    &[
        Submenu::with_items(&app.handle(), "文件", true, &file_menu)?,
        Submenu::with_items(&app.handle(), "编辑", true, &edit_menu)?,
    ],
  )?)?;

  Ok(menu)
}
```

### 7.3.2 快捷键动态更新

```rust
#[tauri::command]
pub fn set_menu_accelerator(
    app: AppHandle,
    menu_item_id: String,
    accelerator: String,
) -> Result<(), String> {
    let menu = app.menu().ok_or("No menu found")?;

    // 解析 accelerator（如 "Meta+S"）
    let key = parse_accelerator_key(&accelerator);
    let modifiers = parse_accelerator_modifiers(&accelerator);

    // 运行时动态更新快捷键
    if let Some(item) = menu.text_item_for_id(&menu_item_id) {
        item.set_accelerator(Some(key))
            .map_err(|e| e.to_string())?;
        item.set_modifiers(modifiers)
            .map_err(|e| e.to_string())?;
    }

    Ok(())
}
```

---

## 7.4 全局快捷键

### 7.4.1 注册与管理

```rust
// src-tauri/src/system/shortcut.rs
use tauri::{Manager, State};

pub struct ShortcutState {
    pub shortcuts: HashMap<String, ShortcutConfig>,
}

impl ShortcutState {
    pub fn new() -> Self {
        Self { shortcuts: HashMap::new() }
    }

    pub fn register(&mut self, id: &str, config: ShortcutConfig) -> Result<(), String> {
        self.shortcuts.insert(id.to_string(), config);
        Ok(())
    }

    pub fn unregister(&mut self, id: &str) -> Result<(), String> {
        self.shortcuts.remove(id);
        Ok(())
    }

    pub fn reload_all(&mut self, app: &AppHandle) -> Result<(), String> {
        // 清除所有快捷键
        app.clear_global_shortcuts()
            .map_err(|e| e.to_string())?;

        // 重新注册
        for (id, config) in &self.shortcuts {
            app.register_global_shortcut(config.accelerator)
                .map_err(|e| e.to_string())?
                .on_shortcut_event(move |_app| {
                    // 触发对应 action
                });
        }

        Ok(())
    }

    pub fn clear_all(&mut self, app: &AppHandle) -> Result<(), String> {
        self.shortcuts.clear();
        app.clear_global_shortcuts()
            .map_err(|e| e.to_string())?;
        Ok(())
    }
}

#[tauri::command]
pub fn register_shortcut(
    id: String,
    chord: String,
    state: State<'_, ShortcutState>,
    app: AppHandle,
) -> Result<(), String> {
    let key = parse_chord(&chord);
    state.register(&id, ShortcutConfig { id: id.clone(), chord, key })?;
    state.reload_all(&app)?;
    Ok(())
}

#[tauri::command]
pub fn reload_all_shortcuts(
    state: State<'_, ShortcutState>,
    app: AppHandle,
) -> Result<(), String> {
    state.reload_all(&app)
}

#[tauri::command]
pub fn clear_all_shortcuts(
    state: State<'_, ShortcutState>,
    app: AppHandle,
) -> Result<(), String> {
    state.clear_all(&app)
}
```

### 7.4.2 前端封装

```typescript
// utils/tauri/shortcut.ts
export async function registerShortcut(
  key: string,
  chord: string,
): Promise<void> {
  if (!isTauriRuntime()) return;
  await invoke('register_shortcut', { key, chord });
}

export async function reloadAllShortcuts(): Promise<void> {
  if (!isTauriRuntime()) return;
  await invoke('reload_all_shortcuts');
}

export async function clearAllShortcuts(): Promise<void> {
  if (!isTauriRuntime()) return;
  await invoke('clear_all_shortcuts');
}
```

### 7.4.3 快捷键范围

| Key | 范围 | 说明 |
|-----|------|------|
| 1 | Tauri 全局 | 显示/隐藏应用 |
| 2 | Tauri 全局 | 新对话 |
| 3 | Tauri 全局 | 新建知识文档 |
| 4 | Tauri 全局 | 切换窗口 |
| 5 | Tauri 全局 | 设置 |
| 6-21 | 页面内 | 知识库页面内快捷键 |

---

## 7.5 HTTP 重试

### 7.5.1 移除 isIdempotentRead 限制

```rust
// src-tauri/src/commands/http.rs
#[tauri::command]
pub async fn tauri_http_request(
    url: String,
    method: String,
    body: Option<String>,
    headers: Option<HashMap<String, String>>,
) -> Result<HttpResponse, String> {
    let client = reqwest::Client::new();
    let request = match method.as_str() {
        "GET" => client.get(&url),
        "POST" => client.post(&url),
        "PUT" => client.put(&url),
        "DELETE" => client.delete(&url),
        "PATCH" => client.patch(&url),
        "HEAD" => client.head(&url),
        _ => return Err(format!("Unsupported method: {}", method)),
    };

    let mut request = request.headers(headers.unwrap_or_default());
    if let Some(body_str) = body {
        request = request.body(body_str);
    }

    // 所有方法在 !response 且非 401 时重试 2 次
    let response = retry_http(|| request.try_clone().unwrap().send(), 2)
        .await
        .map_err(|e| e.to_string())?;

    let status = response.status();
    if status.as_u16() == 401 {
        return Err("UNAUTHORIZED".to_string());
    }

    let text = response.text().await.map_err(|e| e.to_string())?;
    Ok(HttpResponse {
        status: status.as_u16(),
        body: text,
    })
}

async fn retry_http<F, Fut, T>(f: F, max_retries: u32) -> Result<T, reqwest::Error>
where
    F: Fn() -> Fut + Clone,
    Fut: std::future::Future<Output = Result<T, reqwest::Error>>,
{
    let mut last_error = None;
    for i in 0..max_retries {
        match f().await {
            Ok(resp) => return Ok(resp),
            Err(e) => {
                if e.is_status() {
                    return Err(e);  // 401 不重试
                }
                last_error = Some(e);
                tokio::time::sleep(Duration::from_millis(500 * (i + 1) as u64)).await;
            }
        }
    }
    Err(last_error.unwrap())
}
```

---

## 7.6 拖拽与文件选择

### 7.6.1 AsyncFileDialog

```rust
// src-tauri/src/commands/file.rs
#[tauri::command]
pub fn select_files(
    input: Option<SelectFilesInput>,
) -> Result<Vec<String>, String> {
    let accept = input.and_then(|i| i.accept);
    let multiple = input.and_then(|i| i.multiple).unwrap_or(false);

    let dialog = rfd::FileDialog::new()
        .add_filter("Files", &["epub", "pdf", "md", "json"]);

    if multiple {
        let paths = dialog.pick_files();
        match paths {
            Some(paths) => Ok(paths.iter().map(|p| p.to_string_lossy().into_owned()).collect()),
            None => Err("canceled".to_string()),
        }
    } else {
        let path = dialog.pick_file();
        match path {
            Some(p) => Ok(vec![p.to_string_lossy().into_owned()]),
            None => Err("canceled".to_string()),
        }
    }
}
```

### 7.6.2 前端封装

```typescript
// utils/tauri/file.ts
export async function selectFiles(options: SelectFilesOptions): Promise<string[]> {
  if (!isTauriRuntime()) {
    // Web 端降级
    return webSelectFiles(options);
  }

  try {
    const result = await invoke<string[]>('select_files', {
      input: {
        accept: options.accept?.join(','),
        multiple: options.multiple ?? false,
      },
    });
    return result;
  } catch (e) {
    if (String(e).includes('canceled')) return [];
    throw e;
  }
}

function webSelectFiles(options: SelectFilesOptions): Promise<string[]> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = options.multiple ?? false;
    if (options.accept) input.accept = options.accept.join(',');

    input.onchange = (e) => {
      const files = (e.target as HTMLInputElement).files;
      resolve(Array.from(files || []).map(f => f.name));
    };
    input.click();
  });
}
```

---

## 7.7 macOS ATS 配置

### 7.7.1 Info.plist

```xml
<!-- src-tauri/Info.plist -->
<key>NSAppTransportSecurity</key>
<dict>
    <key>NSAllowsArbitraryLoads</key>
    <true/>
    <key>NSExceptionDomains</key>
    <dict>
        <key>localhost</key>
        <dict>
            <key>NSExceptionAllowsInsecureHTTPLoads</key>
            <true/>
        </dict>
    </dict>
</dict>
```

---

## 7.8 配置要点

### 7.8.1 tauri.conf.json

```json
{
  "$schema": "https://schema.tauri.app/config/2",
  "productName": "dnhyxc-ai",
  "version": "1.0.0",
  "app": {
    "withGlobalTauri": false,
    "windows": [
      {
        "label": "main",
        "url": "http://localhost:5173",
        "width": 1200,
        "height": 800,
        "resizable": true,
        "fullscreen": false
      }
    ],
    "security": {
      "csp": null
    }
  },
  "bundle": {
    "active": true,
    "targets": "all",
    "identifier": "ai.dnhyxc.desktop",
    "icon": ["icons/32x32.png", "icons/128x128.png", ...]
  },
  "capabilities": {
    "default": {
      "permissions": ["core:default", "shell:open", "fs:allow-read"]
    }
  }
}
```

### 7.8.2 Cargo.toml

```toml
[package]
name = "dnhyxc-ai"
version = "1.0.0"
description = "dnhyxc-ai desktop application"

[lib]
name = "dnhyxc_ai_lib"
crate-type = ["staticlib", "cdylib", "rlib"]

[build-dependencies]
tauri-build = { version = "2", features = [] }

[dependencies]
tauri = { version = "2", features = ["tray-icon", "dialog-open"] }
tauri-plugin-store = "2"
tauri-plugin-shell = "2"
tauri-plugin-dialog = "2"
reqwest = { version = "0.12", features = ["json"] }
serde = { version = "1", features = ["derive"] }
serde_json = "1"
uuid = { version = "1", features = ["v4"] }
tokio = { version = "1", features = ["full"] }
rfd = "0.15"
objc2 = { version = "0.2", features = ["NSWindow", "NSApplication"] }
```

### 7.8.3 capabilities/default.json

```json
{
  "$schema": "../gen/schemas/desktop-schema.json",
  "identifier": "default",
  "description": "default",
  "windows": ["main", "about"],
  "permissions": [
    "core:default",
    "core:window:default",
    "shell:allow-open",
    "fs:allow-read",
    "dialog:default",
    "store:default",
    "path:default",
    "os:default",
    "http:default"
  ]
}
```
