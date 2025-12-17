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
