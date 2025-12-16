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
