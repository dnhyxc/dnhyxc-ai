## 启动项目

```bash
pnpm tauri dev
```

## 打包

```bash
pnpm tauri build
```

## 自定义 title

[自定义 title](https://v2.tauri.app/zh-cn/learn/window-customization/#macos-%E5%85%B7%E6%9C%89%E8%87%AA%E5%AE%9A%E4%B9%89%E7%AA%97%E5%8F%A3%E8%83%8C%E6%99%AF%E9%A2%9C%E8%89%B2%E7%9A%84%E9%80%8F%E6%98%8E%E6%A0%87%E9%A2%98%E6%A0%8F)

```rust
pub fn run() {
    // 使用默认配置创建 Tauri 应用构建器
    tauri::Builder::default()
        .setup(|app| {
            let win_builder = WebviewWindowBuilder::new(app, "main", WebviewUrl::default())
                .title("")
                .inner_size(1050.0, 700.0)
                .min_inner_size(1050.0, 700.0);
            // 仅在 macOS 时设置透明标题栏
            #[cfg(target_os = "macos")]
            let win_builder = win_builder.title_bar_style(TitleBarStyle::Transparent);
            let window = win_builder.build().unwrap();
            // 仅在构建 macOS 时设置背景颜色
            #[cfg(target_os = "macos")]
            {
                use cocoa::appkit::{NSColor, NSWindow};
                use cocoa::base::{id, nil};
                let ns_window = window.ns_window().unwrap() as id;
                unsafe {
                    let bg_color = NSColor::colorWithRed_green_blue_alpha_(nil, 1.0, 1.0, 1.0, 1.0);
                    // let bg_color = NSColor::colorWithRed_green_blue_alpha_(nil, 0.0, 0.0, 0.0, 0.0);
                    ns_window.setBackgroundColor_(bg_color);
                }
            }
            Ok(())
        })
        // 注册“opener”插件，用于在系统默认程序中打开文件或 URL
        .plugin(tauri_plugin_opener::init())
        // 注册命令处理器：将 `commands::greet` 和 `commands::open_folder` 函数暴露给前端
        .invoke_handler(tauri::generate_handler![
            commands::greet,
            commands::save_file_with_picker
        ])
        // 启动应用并加载 `tauri.conf.json` 中的上下文配置
        .run(tauri::generate_context!())
        // 如果启动失败，立即 panic 并打印错误信息
        .expect("error while running tauri application");
}
```

### tray

```rust
pub fn init_tray(app: &mut tauri::App) {
    println!("init_tray");
    use tauri::{
        // image::Image,
        menu::{MenuBuilder, MenuItem},
        tray::TrayIconBuilder,
    };

    // // 退出按钮
    // let quit_i = MenuItem::with_id(app, "quit", "Quit Coco", true, None::<&str>).unwrap();
    // // 设置按钮
    // let settings_i = MenuItem::with_id(app, "settings", "Settings...", true, None::<&str>).unwrap();
    // // 打开按钮
    // let open_i = MenuItem::with_id(app, "open", "Open Coco", true, None::<&str>).unwrap();
    // // 关于按钮
    // let about_i = MenuItem::with_id(app, "about", "About Coco", true, None::<&str>).unwrap();
    // // 隐藏按钮
    // let hide_i = MenuItem::with_id(app, "hide", "Hide Coco", true, None::<&str>).unwrap();

    // 按照一定顺序 把按钮 放到 菜单里
    // let menu = MenuBuilder::new(app)
    //     .item(&open_i)
    //     .separator() // 分割线
    //     .item(&hide_i)
    //     .item(&about_i)
    //     .item(&settings_i)
    //     .separator() // 分割线
    //     .item(&quit_i)
    //     .build()
    //     .unwrap();

    let _tray = TrayIconBuilder::with_id("tray")
        .icon(app.default_window_icon().unwrap().clone()) // 默认的图片
        // .icon(Image::from_bytes(include_bytes!("../icons/light@2x.png")).expect("REASON")) // 自定义的图片
        // .menu(&menu)
        // .on_menu_event(|app, event| match event.id.as_ref() {
        //     "open" => {
        //         println!("open");
        //     }
        //     "hide" => {
        //         println!("hide");
        //     }
        //     "about" => {
        //         println!("about");
        //     }
        //     // "settings" => {
        //     //     // windows failed to open second window, issue: https://github.com/tauri-apps/tauri/issues/11144 https://github.com/tauri-apps/tauri/issues/8196
        //     //     //#[cfg(windows)]
        //     //     let _ = app.emit("open_settings", "");
        //     //     // #[cfg(not(windows))]
        //     //     // open_settings(&app);
        //     // }
        //     "quit" => {
        //         println!("quit menu item was clicked");
        //         app.exit(0);
        //     }
        //     _ => {
        //         println!("menu item {:?} not handled", event.id);
        //     }
        // })
        .build(app)
        .unwrap();
}
```

### 实现托盘图标切换

创建一个 switch_tray_icon 命令：

```rust
#[tauri::command]
fn switch_tray_icon(app: tauri::AppHandle, is_dark_mode: bool) {
    let app_handle = app.app_handle();

    println!("is_dark_mode: {}", is_dark_mode);

    const DARK_ICON_PATH: &[u8] = include_bytes!("../icons/dark@2x.png");
    const LIGHT_ICON_PATH: &[u8] = include_bytes!("../icons/light@2x.png");

    // 根据 app 的主题切换 图标
    let icon_path: &[u8] = if is_dark_mode {
        DARK_ICON_PATH
    } else {
        LIGHT_ICON_PATH
    };

    // 获取托盘
    let tray = match app_handle.tray_by_id("tray") {
        Some(tray) => tray,
        None => {
            eprintln!("Tray with ID 'tray' not found");
            return;
        }
    };

    // 设置图标
    if let Err(e) = tray.set_icon(Some(
        tauri::image::Image::from_bytes(icon_path)
            .unwrap_or_else(|e| panic!("Failed to load icon from bytes: {}", e)),
    )) {
        eprintln!("Failed to set tray icon: {}", e);
    }
}
```

代码说明：

- 动态加载图标：根据 is_dark_mode 参数决定使用亮色或暗色图标。

- 更新托盘图标：通过 set_icon 方法更新图标。

- 错误处理：在托盘实例不存在或图标加载失败时记录错误日志。

### 前端调用 switch_tray_icon 命令

```ts
import { invoke } from "@tauri-apps/api/core";

async function switchTrayIcon(value: "dark" | "light") {
	try {
		// invoke  switch_tray_icon 事件名 isDarkMode 参数名
		await invoke("switch_tray_icon", { isDarkMode: value === "dark" });
	} catch (err) {
		console.error("Failed to switch tray icon:", err);
	}
}
```

> 参考：https://juejin.cn/post/7460781093094670386

## Menu

```rust
// 引入自定义命令模块，其中包含可供前端调用的 Rust 函数
mod clients;
mod dock;
// mod menu;
mod services;
mod tray;
mod types;
mod utils;

use tauri::menu::{CheckMenuItemBuilder, MenuBuilder, SubmenuBuilder};
use tauri::Manager;
use tauri::WindowEvent;

/// 移动端入口属性宏：当编译目标为移动平台时，自动标记该函数为 Tauri 移动端入口
#[cfg_attr(mobile, tauri::mobile_entry_point)]

// 应用程序主入口函数
// 负责初始化并启动 Tauri 应用
pub fn run() {
    // 使用默认配置创建 Tauri 应用构建器
    tauri::Builder::default()
        .setup(|app| {
            tray::init_tray(app); // 注册事件
            let file_menu = SubmenuBuilder::new(app, "File")
                .text("about", "关于应用")
                .text("logout", "退出登录")
                .text("quit", "退出应用")
                .build()?;

            // let lang_str = "en";
            // let check_sub_item_1 = CheckMenuItemBuilder::new("English")
            //     .id("en")
            //     .checked(lang_str == "en")
            //     .build(app)?;

            // let check_sub_item_2 = CheckMenuItemBuilder::new("Chinese")
            //     .id("en")
            //     .checked(lang_str == "en")
            //     // .enabled(false)
            //     .build(app)?;

            let other_item = SubmenuBuilder::new(app, "窗口")
                // .item(&check_sub_item_1)
                // .item(&check_sub_item_2)
                .text("minimize", "最小化")
                .text("close", "关闭窗口")
                .separator() // 分割线
                .text("scale", "缩放窗口")
                .text("fill", "填充窗口")
                .text("center", "居中窗口")
                .text("fullscreen", "全屏窗口")
                .build()?;

            // let default_item = SubmenuBuilder::new(app, "编辑")
            //     // 使用 Tauri 提供的原生菜单角色，以启用系统级快捷键
            //     .copy()
            //     .separator()
            //     .undo()
            //     .redo()
            //     .cut()
            //     .paste()
            //     .select_all()
            //     .build()?;

            let menu = MenuBuilder::new(app)
                .items(&[&file_menu, &other_item])
                .build()?;

            app.set_menu(menu)?;

            if let Some(main_window) = app.get_webview_window("main") {
                let window = main_window.clone();
                // 监听窗口事件
                main_window.on_window_event(move |event| match event {
                    WindowEvent::CloseRequested { api, .. } => {
                        api.prevent_close();
                        let _ = window.hide();
                    }
                    _ => {}
                });
            }

            Ok(())
        })
        // 注册“opener”插件，用于在系统默认程序中打开文件或 URL
        .plugin(tauri_plugin_opener::init())
        // 注册命令处理器：将 `clients::greet` 和 `services::open_folder` 函数暴露给前端
        .invoke_handler(tauri::generate_handler![
            clients::greet,
            services::save_file_with_picker, // 通用保存
            services::download_file,         // 通用下载
            services::download_files,        // 批量下载
            services::get_file_info,         // 获取文件信息
        ])
        .build(tauri::generate_context!())
        // 如果启动失败，立即 panic 并打印错误信息
        .expect("error while running tauri application")
        // 启动应用后的事件循环处理
        .run(|app_handle, event| {
            // macOS 平台：调用自定义的 app_event 模块处理应用事件
            #[cfg(target_os = "macos")]
            dock::dock_event(&app_handle, event);
            // 非 macOS 平台：占位使用，避免未使用的变量警告
            #[cfg(not(target_os = "macos"))]
            {
                let _ = (app_handle, event);
            }
        })
}
```

> 参考文档：
>
> [https://v2.tauri.app/zh-cn/learn/window-menu/](https://v2.tauri.app/zh-cn/learn/window-menu/)
>
> [https://docs.rs/tauri/latest/tauri/menu/struct.PredefinedMenuItem.html](https://docs.rs/tauri/latest/tauri/menu/struct.PredefinedMenuItem.html)

## Tailwind CSS 默认配色

[https://tailwindcss.com/docs/theme#theme-variable-namespaces](https://tailwindcss.com/docs/theme#theme-variable-namespaces)

## 加载线上资源

```json
{
	"$schema": "https://schema.tauri.app/config/2",
	"productName": "dnhyxc-ai",
	"version": "0.0.1",
	"identifier": "com.dnhyxc.dnhyxc-ai",
	"build": {
		"beforeDevCommand": "pnpm dev",
		"devUrl": "http://localhost:1420",
		"beforeBuildCommand": "pnpm build",
		"frontendDist": "../dist"
	},
	"app": {
		"windows": [
			{
				"label": "main",
				"title": "dnhyxc-ai",
				"width": 1050,
				"height": 720,
				"minWidth": 1050,
				"minHeight": 720,
				"hiddenTitle": true,
				"resizable": true,
				"decorations": true,
				"titleBarStyle": "Overlay",
				"center": true,
				"devtools": true,
				"url": "https://dnhyxc.cn",
				"allowLinkPreview": true
			}
		],
		"security": {
			"csp": "default-src 'self' http://101.34.214.188; connect-src 'self' http://101.34.214.188; img-src 'self' http://101.34.214.188 data:; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline';",
			"assetProtocol": {
				"enable": true,
				"scope": ["http://101.34.214.188", "https://*"]
			}
		}
	},
	"bundle": {
		"active": true,
		"targets": "all",
		"icon": [
			"icons/32x32.png",
			"icons/128x128.png",
			"icons/128x128@2x.png",
			"icons/icon.icns",
			"icons/icon.ico"
		]
	}
}
```

## Tauri2 HTML5 拖拽事件失效解决

需要在 `tauri.conf.json` 中设置 `dragDropEnabled` 为 `false`。

```json
{
	// ...
	"app": {
		"windows": [
			{
				// ...
				"dragDropEnabled": false
			}
		]
	}
}
```

```bash
export TAURI_SIGNING_PRIVATE_KEY_PASSWORD="dnh@06130614"

export TAURI_SIGNING_PRIVATE_KEY="dW50cnVzdGVkIGNvbW1lbnQ6IHJzaWduIGVuY3J5cHRlZCBzZWNyZXQga2V5ClJXUlRZMEl5cDh4RVJzb2F4azVhSVVOTWlhQ200MFJ4V0lXZjRKaWM1WEp2WWhhVlJoUUFBQkFBQUFBQUFBQUFBQUlBQUFBQWM5cmlsaVV6OTQ5cUtzdWF5ZDBGckJkK3VEN09TWUJCYndKbmNTZ09ZSm4xVEZzWkk1ZjJZeGFyT0JpL1hFT09MZXJiWklyOExUT0FZY1hFK3Z4d01YNmpBY1ZJOEVBMklHZ21ydVdoaVgxY1kwRlhGZHZaRnljY3UxdUp5YklCaFZ5MWltUkg5WlE9Cg=="
```

## Releases

https://github.com/dnhyxc/dnhyxc-ai/releases/tag/v0.0.1
