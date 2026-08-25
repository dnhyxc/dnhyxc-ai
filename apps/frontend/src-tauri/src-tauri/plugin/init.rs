use tauri::Runtime;
use tauri::plugin::{Builder as PluginBuilder, TauriPlugin};

use crate::system::shortcut::handle_shortcut;

/// `dragDropEnabled: false` 时 WKWebView 会把落盘文件当导航打开（顶掉 SPA）。
/// 拦截 `file://`，拖放仍走 HTML5，由页面自己的 drop 区处理。
fn block_file_drop_navigation<R: Runtime>() -> TauriPlugin<R> {
    PluginBuilder::new("block-file-drop-nav")
        .on_navigation(|_webview, url| url.scheme() != "file")
        .build()
}

pub trait CustomInit {
    fn init_plugin(self) -> Self;
}

impl<R: Runtime> CustomInit for tauri::Builder<R> {
    fn init_plugin(self) -> Self {
        let builder = self
            .plugin(block_file_drop_navigation())
            .plugin(tauri_plugin_http::init())
            // 注册“opener”插件，用于在系统默认程序中打开文件或 URL
            .plugin(tauri_plugin_opener::init())
            .plugin(tauri_plugin_store::Builder::default().build())
            .plugin(tauri_plugin_autostart::Builder::new().build())
            .plugin(tauri_plugin_process::init())
            .plugin(tauri_plugin_updater::Builder::new().build())
            .plugin(tauri_plugin_clipboard_manager::init())
            .plugin(tauri_plugin_fs::init())
            .plugin(
                tauri_plugin_global_shortcut::Builder::new()
                    .with_handler(handle_shortcut)
                    .build(),
            );

        // 注册全局快捷键插件
        builder
    }
}
