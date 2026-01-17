use tauri::Runtime;

use crate::system::shortcut::handle_shortcut;

pub trait CustomInit {
    fn init_plugin(self) -> Self;
}

impl<R: Runtime> CustomInit for tauri::Builder<R> {
    fn init_plugin(self) -> Self {
        let builder = self
            .plugin(tauri_plugin_http::init())
            // 注册“opener”插件，用于在系统默认程序中打开文件或 URL
            .plugin(tauri_plugin_opener::init())
            .plugin(tauri_plugin_store::Builder::default().build())
            .plugin(tauri_plugin_autostart::Builder::new().build())
            .plugin(tauri_plugin_process::init())
            .plugin(tauri_plugin_updater::Builder::new().build())
            .plugin(tauri_plugin_clipboard_manager::init())
            .plugin(
                tauri_plugin_global_shortcut::Builder::new()
                    .with_handler(handle_shortcut)
                    .build(),
            );

        // 注册全局快捷键插件
        builder
    }
}
