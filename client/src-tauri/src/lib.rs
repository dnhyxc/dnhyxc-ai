// use tauri::{TitleBarStyle, WebviewUrl, WebviewWindowBuilder};

// 引入自定义命令模块，其中包含可供前端调用的 Rust 函数
mod commands;
mod types;
mod utils;

/// 移动端入口属性宏：当编译目标为移动平台时，自动标记该函数为 Tauri 移动端入口
#[cfg_attr(mobile, tauri::mobile_entry_point)]

// 应用程序主入口函数
// 负责初始化并启动 Tauri 应用
pub fn run() {
    // 使用默认配置创建 Tauri 应用构建器
    tauri::Builder::default()
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
        // 启动应用并加载 `tauri.conf.json` 中的上下文配置
        .run(tauri::generate_context!())
        // 如果启动失败，立即 panic 并打印错误信息
        .expect("error while running tauri application");
}
