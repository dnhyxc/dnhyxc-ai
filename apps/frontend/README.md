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

## Auto Update

```ts
import { fetch } from "@tauri-apps/plugin-http";
import { relaunch } from "@tauri-apps/plugin-process";
import { check, type Update } from "@tauri-apps/plugin-updater";
import { Toast } from "@/components/ui/sonner";

interface CheckForUpdatesOptions {
	getProgress?: (progress: number) => void;
	getTotal?: (total: number) => void;
	onRelaunch?: (relaunch: () => Promise<void>) => void;
	setLoading?: (loading: boolean) => void;
	onReset?: () => void;
	onFinished?: () => void;
}

export type UpdateType = Update;

export const checkVersion = async () => {
	try {
		const update = await check();
		const latestVersion = await getLatestUpdateInfo();
		if (
			latestVersion &&
			update &&
			compareVersions(latestVersion.version, update.version) > 0
		) {
			return { ...update, ...latestVersion };
		}
		return update;
	} catch (error: any) {
		Toast({
			type: "error",
			title: "检查更新失败",
			message: error?.message || String(error),
		});
	}
};

export const getLatestUpdateInfo = async (): Promise<Update | null> => {
	try {
		const response = await fetch(
			"https://github.com/dnhyxc/dnhyxc-ai/releases/download/v0.0.1/latest.json"
		);
		if (!response.ok) {
			throw new Error(`获取失败: ${response.status}`);
		}
		const latestJson = await response.json();
		return latestJson;
	} catch (error: any) {
		console.error("获取最新版本失败:", error);
		return null;
	}
};

const compareVersions = (v1: string, v2: string): number => {
	const parts1 = v1.split(".").map(Number);
	const parts2 = v2.split(".").map(Number);
	for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
		const part1 = parts1[i] || 0;
		const part2 = parts2[i] || 0;
		if (part1 !== part2) {
			return part1 - part2;
		}
	}
	return 0;
};

export const checkForUpdates = async (options?: CheckForUpdatesOptions) => {
	try {
		const update = await check();
		if (update) {
			options?.setLoading?.(true);
			await update.downloadAndInstall((event) => {
				switch (event.event) {
					case "Started":
						options?.getTotal?.(event.data.contentLength || 0);
						break;
					case "Progress":
						options?.getProgress?.(event.data.chunkLength);
						break;
					case "Finished":
						options?.onFinished?.();
						break;
				}
			});
			options?.onRelaunch?.(relaunch);
		}
	} catch (error: any) {
		Toast({
			type: "error",
			title: "更新失败",
			message: error?.message || String(error),
		});
		options?.onReset?.();
	}
};
```

## 设置允许加载 http 的资源

### main

```rust
 #[cfg(target_os = "macos")]
        {
            let out_dir = std::env::var("OUT_DIR").unwrap();
            let dest_path = std::path::PathBuf::from(out_dir).join("Info.plist");

            let info_plist = r#"<?xml version="1.0" encoding="UTF-8"?>
            <!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
            <plist version="1.0">
            <dict>
                <key>CFBundleDevelopmentRegion</key>
                <string>$(DEVELOPMENT_LANGUAGE)</string>
                <key>CFBundleExecutable</key>
                <string>$(EXECUTABLE_NAME)</string>
                <key>CFBundleIdentifier</key>
                <string>$(PRODUCT_BUNDLE_IDENTIFIER)</string>
                <key>CFBundleInfoDictionaryVersion</key>
                <string>6.0</string>
                <key>CFBundleName</key>
                <string>$(PRODUCT_NAME)</string>
                <key>CFBundlePackageType</key>
                <string>$(PRODUCT_BUNDLE_PACKAGE_TYPE)</string>
                <key>CFBundleShortVersionString</key>
                <string>$(MARKETING_VERSION)</string>
                <key>CFBundleVersion</key>
                <string>$(CURRENT_PROJECT_VERSION)</string>
                <key>LSRequiresIPhoneOS</key>
                <true/>
                <key>NSAppTransportSecurity</key>
                <dict>
                    <key>NSAllowsArbitraryLoads</key>
                    <true/>
                </dict>
                <key>UILaunchStoryboardName</key>
                <string>LaunchScreen</string>
                <key>UIRequiredDeviceCapabilities</key>
                <array>
                    <string>armv7</string>
                </array>
                <key>UISupportedInterfaceOrientations</key>
                <array>
                    <string>UIInterfaceOrientationPortrait</string>
                    <string>UIInterfaceOrientationLandscapeLeft</string>
                    <string>UIInterfaceOrientationLandscapeRight</string>
                </array>
                <key>UISupportedInterfaceOrientations~ipad</key>
                <array>
                    <string>UIInterfaceOrientationPortrait</string>
                    <string>UIInterfaceOrientationPortraitUpsideDown</string>
                    <string>UIInterfaceOrientationLandscapeLeft</string>
                    <string>UIInterfaceOrientationLandscapeRight</string>
                </array>
            </dict>
            </plist>
            "#;

            std::fs::write(&dest_path, info_plist).expect("Failed to write Info.plist");
            println!("cargo:rustc-env=TAURI_BUNDLE_MACOS_PLIST={}", dest_path.display());
        }
```

### tauri.conf.json

```json
// 这是 Tauri v2 的配置文件，采用 JSON 格式，遵循官方提供的 JSON Schema 进行校验
{
	// 指向 Tauri v2 官方 JSON Schema，用于 IDE 自动补全与语法校验
	"$schema": "https://schema.tauri.app/config/2",

	// 应用名称，打包后生成的可执行文件、安装包均以此为名
	"productName": "dnhyxc-ai",

	// 当前应用版本号，遵循语义化版本规范（SemVer）
	"version": "0.0.85",

	// 应用唯一标识符，采用反向域名风格，用于操作系统级别识别（如 macOS 的 bundle ID、Windows 的注册表路径）
	"identifier": "com.dnhyxc.dnhyxc-ai",

	// 构建阶段相关配置
	"build": {
		// 开发阶段启动前端开发服务器的命令，Tauri 会在 dev 前自动执行
		"beforeDevCommand": "pnpm dev",

		// 开发服务器地址，Tauri 会等待该地址可访问后才启动窗口
		"devUrl": "http://127.0.0.1:9002",

		// 正式构建前对前端进行打包的命令
		"beforeBuildCommand": "pnpm build",

		// 前端产物目录，相对于 tauri.conf.json 文件所在目录的上一级
		"frontendDist": "../dist"
	},

	// 应用运行时行为配置
	"app": {
		// 窗口数组，可配置多窗口，此处仅定义主窗口
		"windows": [
			{
				// 窗口标签，代码中可通过 label 获取该窗口实例
				"label": "main",

				// 窗口标题，显示在系统任务栏/窗口栏
				"title": "dnhyxc-ai",

				// 窗口初始宽高
				"width": 1050,
				"height": 720,

				// 窗口最小尺寸限制，防止用户拖太小
				"minWidth": 1050,
				"minHeight": 720,

				// 隐藏原生标题栏，配合 titleBarStyle: 'Overlay' 实现自定义标题栏
				"hiddenTitle": true,

				// 禁止拖放文件到窗口
				"dragDropEnabled": false,

				// 允许用户调整窗口大小
				"resizable": true,

				// 显示系统窗口边框（最大化、最小化、关闭按钮）
				"decorations": true,

				// 标题栏风格：Overlay 表示标题栏覆盖在窗口内容之上，适合自定义
				"titleBarStyle": "Overlay",

				// 启动时自动居中屏幕
				"center": true,

				// 窗口背景不透明，设为 true 可实现毛玻璃等特效
				"transparent": false
			}
		],

		// TODO:新增 macOS 平台专用：允许调用私有 API，用于实现某些系统级功能（需额外审核）
		"macOSPrivateApi": true,

		// 安全策略配置
		"security": {
			// 内容安全策略（CSP），限制页面可加载的资源来源，降低 XSS 风险
			// default-src 'self'：默认仅允许同源
			// img-src/media-src 扩展了 data:、https:、http:，允许加载网络图片与媒体
			// script-src 'self'：仅允许执行同源脚本
			// style-src 'self' 'unsafe-inline'：允许内联样式，便于 UI 框架动态注入样式
			// connect-src：允许向任意 https/http 接口发起请求（如 AI 后端 API）
			// TODO:新增
			"csp": "default-src 'self'; img-src 'self' data: https: http:; media-src 'self' data: https: http:; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self' https: http:"
		}
	},

	// 打包与分发配置
	"bundle": {
		// 启用打包功能
		"active": true,

		// 目标平台：all 表示同时打 Windows、macOS、Linux 包
		"targets": "all",

		// 生成用于自动更新的签名文件（配合 updater 插件）
		"createUpdaterArtifacts": true,

		// TODO: 新增 macOS 平台专用：启用加固运行时（Hardened Runtime），提高安全性
		"macOS": {
			"hardenedRuntime": true
		},

		// 多尺寸图标路径，打包时会自动选取合适尺寸
		"icon": [
			"icons/32x32.png",
			"icons/128x128.png",
			"icons/128x128@2x.png",
			"icons/icon.icns",
			"icons/icon.ico"
		]
	},

	// 插件配置
	"plugins": {
		// 内置自动更新插件
		"updater": {
			// 公钥，用于验证下载的更新包签名（base64 编码）
			"pubkey": "dW50cnVzdGVkIGNvbW1lbnQ6IG1pbmlzaWduIHB1YmxpYyBrZXk6IEIxM0JDRThDMjM4QUNBREYKUldUZnlvb2pqTTQ3c2RMUlNlR1JnTjJRTjM3YzRkaE9kZXNJTklwZTdjOTRvaTZ6TVZ0aE5ydjYK",

			// 更新服务器地址，Tauri 会轮询该地址获取 latest.json 版本信息
			"endpoints": [
				"https://github.com/dnhyxc/dnhyxc-ai-app/releases/download/latest/latest.json"
			]
		}
	}
}
```

### Cargo.toml

```toml
[package]
name = "dnhyxc-ai"
version = "0.1.0"
description = "dnhyxc-ai"
authors = ["dnhyxc"]
edition = "2024"

# See more keys and their definitions at https://doc.rust-lang.org/cargo/reference/manifest.html

[lib]
# The `_lib` suffix may seem redundant but it is necessary
# to make the lib name unique and wouldn't conflict with the bin name.
# This seems to be only an issue on Windows, see https://github.com/rust-lang/cargo/issues/8519
name = "dnhyxc_ai_lib"
crate-type = ["staticlib", "cdylib", "rlib"]

[build-dependencies]
tauri-build = { version = "2", features = [] }

[dependencies]
tauri = { version = "2", features = ["macos-private-api", "tray-icon", "image-png"] }
tauri-plugin-opener = "2.5.3"
tauri-plugin-single-instance = "2.3.7"
serde = { version = "1", features = ["derive"] }
serde_json = "1.0.149"
tauri-plugin-clipboard-manager = "2"
tauri-plugin-process = "2"
[target."cfg(target_os = \"macos\")".dependencies]
tauri-plugin-http = { version = "2.5.6", features = [
  "unsafe-headers",
  "rustls-tls",
] }

cocoa = "0.26.1"
rfd = "0.17.2"
reqwest = { version = "0.13.1", features = ["json", "stream"] }
tokio = { version = "1.49.0", features = ["full", "rt"] }
futures = "0.3"

[target.'cfg(not(any(target_os = "android", target_os = "ios")))'.dependencies]
tauri-plugin-autostart = "2"
tauri-plugin-global-shortcut = "2"
tauri-plugin-store = "2.4.2"
tauri-plugin-updater = "2"
```

### capabilities/default.json

```json
{
	"$schema": "../gen/schemas/desktop-schema.json",
	"identifier": "default",
	"description": "Capability for the main window",
	"windows": ["main", "child-window", "about"],
	"permissions": [
		"core:default",
		"opener:default",
		"core:window:default",
		"core:window:allow-start-dragging",
		"core:webview:allow-create-webview-window",
		"core:window:allow-set-focus",
		"core:window:allow-set-theme",
		"http:default",
		"http:allow-fetch",
		"store:allow-load",
		"store:default",
		"clipboard-manager:allow-clear",
		"clipboard-manager:allow-read-image",
		"clipboard-manager:allow-read-text",
		"clipboard-manager:allow-write-html",
		"clipboard-manager:allow-write-image",
		"clipboard-manager:allow-write-text",
		"process:default",
		"process:allow-restart",
		{
			"identifier": "http:default",
			"allow": [
				{
					"url": "http://101.34.214.188:9112/*"
				},
				{
					"url": "http://localhost:9112/*"
				},
				{
					"url": "https://github.com/*"
				},
				{
					"url": "http://t80w8cw4d.hd-bkt.clouddn.com/*"
				}
			],
			"description": "dnhyxc-ai nest api"
		}
	]
}
```

### 清理缓存

```bash
cd /Users/dnhyxc/Documents/code/dnhyxc-ai/apps/frontend/src-tauri && cargo clean
```

### tiptop

```json
{
	"@tiptap/extension-color": "^3.15.3",
	"@tiptap/extension-highlight": "^3.15.3",
	"@tiptap/extension-history": "^3.15.3",
	"@tiptap/extension-image": "^3.15.3",
	"@tiptap/extension-link": "^3.15.3",
	"@tiptap/extension-placeholder": "^3.15.3",
	"@tiptap/extension-text-align": "^3.15.3",
	"@tiptap/extension-text-style": "^3.15.3",
	"@tiptap/extension-typography": "^3.15.3",
	"@tiptap/extension-underline": "^3.15.3",
	"@tiptap/pm": "^3.15.3",
	"@tiptap/react": "^3.15.3",
	"@tiptap/starter-kit": "^3.15.3"
	"lowlight": "^3.3.0",
}
```

完整 package.json

```json
{
	"name": "@dnhyxc-ai/frontend",
	"private": true,
	"version": "0.0.1",
	"type": "module",
	"author": "dnhyxc <dnhyxc@gmail.com>",
	"scripts": {
		"dev": "vite",
		"build": "tsc && vite build",
		"preview": "vite preview",
		"tauri": "tauri"
	},
	"dependencies": {
		"@hookform/resolvers": "^5.2.2",
		"@radix-ui/react-alert-dialog": "^1.1.15",
		"@radix-ui/react-checkbox": "^1.3.3",
		"@radix-ui/react-dialog": "^1.1.15",
		"@radix-ui/react-dropdown-menu": "^2.1.16",
		"@radix-ui/react-label": "^2.1.8",
		"@radix-ui/react-navigation-menu": "^1.2.14",
		"@radix-ui/react-progress": "^1.1.8",
		"@radix-ui/react-radio-group": "^1.3.8",
		"@radix-ui/react-scroll-area": "^1.2.10",
		"@radix-ui/react-slot": "^1.2.4",
		"@tauri-apps/api": "^2",
		"@tauri-apps/plugin-autostart": "~2",
		"@tauri-apps/plugin-clipboard-manager": "^2.3.2",
		"@tauri-apps/plugin-global-shortcut": "~2",
		"@tauri-apps/plugin-http": "^2.5.4",
		"@tauri-apps/plugin-opener": "^2",
		"@tauri-apps/plugin-process": "~2",
		"@tauri-apps/plugin-store": "^2.4.1",
		"@tauri-apps/plugin-updater": "~2",
		"@tiptap/extension-color": "^3.15.3",
		"@tiptap/extension-highlight": "^3.15.3",
		"@tiptap/extension-history": "^3.15.3",
		"@tiptap/extension-image": "^3.15.3",
		"@tiptap/extension-link": "^3.15.3",
		"@tiptap/extension-placeholder": "^3.15.3",
		"@tiptap/extension-text-align": "^3.15.3",
		"@tiptap/extension-text-style": "^3.15.3",
		"@tiptap/extension-typography": "^3.15.3",
		"@tiptap/extension-underline": "^3.15.3",
		"@tiptap/pm": "^3.15.3",
		"@tiptap/react": "^3.15.3",
		"@tiptap/starter-kit": "^3.15.3",
		"axios": "^1.13.2",
		"class-variance-authority": "^0.7.1",
		"clsx": "^2.1.1",
		"crypto-js": "^4.2.0",
		"embla-carousel-autoplay": "^8.6.0",
		"embla-carousel-react": "^8.6.0",
		"js-md5": "^0.8.3",
		"lowlight": "^3.3.0",
		"lucide-react": "^0.561.0",
		"mobx": "^6.15.0",
		"mobx-react": "^9.2.1",
		"next-themes": "^0.4.6",
		"qiniu-js": "^3.4.3",
		"query-string": "^9.3.1",
		"react": "^19.1.0",
		"react-dom": "^19.1.0",
		"react-hook-form": "^7.69.0",
		"react-router": "^7.10.1",
		"sonner": "^2.0.7",
		"tailwind-merge": "^3.4.0",
		"zod": "^4.2.1"
	},
	"devDependencies": {
		"@tailwindcss/vite": "^4.1.18",
		"@tauri-apps/cli": "^2",
		"@types/crypto-js": "^4.2.2",
		"@types/react": "^19.1.8",
		"@types/react-dom": "^19.1.6",
		"@vitejs/plugin-react": "^4.6.0",
		"tailwindcss": "^4.1.18",
		"tw-animate-css": "^1.4.0",
		"vite": "^7.0.4"
	},
	"packageManager": "pnpm@10.8.1"
}
```
