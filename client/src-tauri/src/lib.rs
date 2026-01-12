use tauri::Manager;
// 声明并引入当前 crate 中的子模块：
// - menu：窗口菜单相关功能
// - services：供前端调用的文件保存、下载等后端服务
// - tray：系统托盘图标及菜单
// - types：公共类型定义
// - utils：通用工具函数（窗口居中、文件下载等）
mod command;
mod plugin;
mod system;
mod types;
mod utils;

use plugin::init::CustomInit;
use system::dock::dock_event;
use system::event::setup_window_events;
use system::menu::setup_menu;
use system::shortcut::setup_global_shortcut;
use system::tray::init_tray;
use utils::common::set_screen_center;
// use tauri::menu::{MenuBuilder, SubmenuBuilder};
use command::common::{
    clear_all_shortcuts, disable_auto_start, enable_auto_start, greet_name, is_auto_start_enabled,
    register_shortcut, reload_all_shortcuts, select_directory, select_file,
};
use command::download::{
    download_blob, download_file, download_files, get_file_info, save_file_with_picker,
};

/// 移动端入口属性宏：当编译目标为移动平台时，自动标记该函数为 Tauri 移动端入口
#[cfg_attr(mobile, tauri::mobile_entry_point)]

// 应用程序主入口函数
// 负责初始化并启动 Tauri 应用
pub fn run() {
    // 使用默认配置创建 Tauri 应用构建器
    tauri::Builder::default()
        // .plugin(tauri_plugin_autostart::Builder::new().build())
        // .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .setup(|app| {
            let main_window = app.get_webview_window("main").unwrap();
            // 启动时设置窗口居中
            set_screen_center(&main_window);
            // 注册托盘菜单
            init_tray(app);

            let _ = setup_menu(app);

            let _ = setup_global_shortcut(&app.handle(), &main_window);

            // 设置窗口事件处理器
            setup_window_events(main_window, app.handle().clone());
            Ok(())
        })
        .init_plugin()
        // 注册命令处理器：将 `clients::greet` 和 `services::open_folder` 函数暴露给前端
        .invoke_handler(tauri::generate_handler![
            greet_name,
            select_file,           // 选择文件
            select_directory,      // 选择目录
            save_file_with_picker, // 通用保存
            download_file,         // 通用下载
            download_files,        // 批量下载
            get_file_info,         // 获取文件信息
            download_blob,         // 获取文件信息
            disable_auto_start,    // 禁用开机启动
            enable_auto_start,     // 启用开机启动
            is_auto_start_enabled, // 检测开机启动
            register_shortcut,     // 注册单个快捷键
            reload_all_shortcuts,  // 重新加载所有快捷键
            clear_all_shortcuts,   // 清空所有快捷键
        ])
        .build(tauri::generate_context!())
        // 如果启动失败，立即 panic 并打印错误信息
        .expect("error while running tauri application")
        // 启动应用后的事件循环处理
        .run(|app_handle, event| {
            // 应用退出前清空 token 信息
            if let tauri::RunEvent::Exit = event {
                if let Some(webview) = app_handle.get_webview_window("main") {
                    let _ = webview.eval("localStorage.removeItem('token');");
                    let _ = webview.eval("localStorage.removeItem('userInfo');");
                    let _ = webview.eval("localStorage.removeItem('countdown_state');");
                    let _ = webview.eval("localStorage.removeItem('countdown_time');");
                }
            }
            // macOS 平台：调用自定义的 app_event 模块处理应用事件
            #[cfg(target_os = "macos")]
            dock_event(&app_handle, event);
            // 非 macOS 平台：占位使用，避免未使用的变量警告
            #[cfg(not(target_os = "macos"))]
            {
                let _ = (app_handle, event);
            }
        })
}
