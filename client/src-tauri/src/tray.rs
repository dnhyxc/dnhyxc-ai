use tauri::tray::TrayIconEvent;
use tauri::Manager;
pub fn init_tray(app: &mut tauri::App) {
    println!("init_tray");
    use tauri::{
        image::Image,
        // menu::{MenuBuilder, MenuItem},
        tray::TrayIconBuilder,
    };

    let _tray = TrayIconBuilder::with_id("tray")
        // .icon(app.default_window_icon().unwrap().clone()) // 默认的图片
        .icon(Image::from_bytes(include_bytes!("../icons/32x32.png")).expect("REASON")) // 自定义的图片
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click { .. } = event {
                let app = tray.app_handle();
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.show();
                    let _ = window.set_focus();
                }
            }
        })
        .build(app)
        .unwrap();
}
