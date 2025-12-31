use tauri::Manager;
use tauri::tray::TrayIconEvent;
pub fn init_tray(app: &mut tauri::App) {
    #[cfg(target_os = "macos")]
    use tauri::{
        image::Image,
        menu::{MenuBuilder, MenuId, MenuItem},
        tray::TrayIconBuilder,
    };

    // 为 macOS 创建原生菜单
    let open_id = MenuId::new("open_main");
    let exit_id = MenuId::new("exit_app");
    let setting_id = MenuId::new("setting_app");

    // 退出按钮
    let quit = MenuItem::with_id(app, exit_id.clone(), "退出应用", true, None::<&str>).unwrap();
    // 设置按钮
    let settings =
        MenuItem::with_id(app, setting_id.clone(), "打开设置", true, None::<&str>).unwrap();
    // 打开按钮
    let open = MenuItem::with_id(app, open_id.clone(), "显示应用", true, None::<&str>).unwrap();

    let menu = MenuBuilder::new(app)
        .item(&open)
        .item(&settings)
        .item(&quit)
        .build()
        .unwrap();

    let _tray = TrayIconBuilder::with_id("tray")
        .icon(Image::from_bytes(include_bytes!("../../icons/32x32.png")).expect("REASON")) // 自定义的图片
        .menu(&menu)
        .show_menu_on_left_click(false) // 禁止鼠标左键显示菜单
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click { button, .. } = event {
                let app = tray.app_handle();

                match button {
                    tauri::tray::MouseButton::Left => {
                        // println!("Left click");
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                    tauri::tray::MouseButton::Right => {
                        // println!("Right click");
                    }
                    _ => {}
                }
            }
            if let TrayIconEvent::Enter { .. } = event {
                // let app = tray.app_handle();
            }
        })
        .on_menu_event(move |app, event| {
            let id = event.id();
            if id == &open_id {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.show();
                    let _ = window.unminimize();
                    let _ = window.set_focus();
                }
            } else if id == &exit_id {
                // 退出应用
                let _ = app.exit(0);
            } else if id == &setting_id {
                // 设置应用
                println!("设置");
            }
        })
        .build(app)
        .unwrap();
}
