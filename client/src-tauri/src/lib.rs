// 引入自定义命令模块，其中包含可供前端调用的 Rust 函数
mod commands;
mod dock;
mod tray;
mod types;
mod utils;

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

            // 窗口获取焦点时，显示窗口
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
        // 注册命令处理器：将 `commands::greet` 和 `commands::open_folder` 函数暴露给前端
        .invoke_handler(tauri::generate_handler![
            commands::greet,
            commands::save_file_with_picker, // 通用保存
            commands::download_file,         // 通用下载
            commands::download_files,        // 批量下载
            commands::get_file_info,         // 获取文件信息
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
