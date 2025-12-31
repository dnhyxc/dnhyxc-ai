use tauri::Runtime;

pub trait CustomInit {
    fn init_plugin(self) -> Self;
}

impl<R: Runtime> CustomInit for tauri::Builder<R> {
    fn init_plugin(self) -> Self {
        let builder = self
            .plugin(tauri_plugin_http::init())
            // 注册“opener”插件，用于在系统默认程序中打开文件或 URL
            .plugin(tauri_plugin_opener::init());

        builder
    }
}
