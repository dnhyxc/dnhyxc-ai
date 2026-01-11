use crate::utils::common::get_store_value;
use tauri::WindowEvent;

/// 设置窗口事件处理器
pub fn setup_window_events(main_window: tauri::WebviewWindow, app_handle: tauri::AppHandle) {
    let window = main_window.clone();
    let app_handle = app_handle.clone();

    main_window.on_window_event(move |event| match event {
        WindowEvent::CloseRequested { api, .. } => {
            // 先阻止默认关闭行为
            api.prevent_close();

            // 获取前端设置的 closeType
            let app_handle_clone = app_handle.clone();
            let window_clone = window.clone();

            tauri::async_runtime::spawn(async move {
                if let Ok(close_type) = get_store_value(&app_handle_clone, "closeType").await {
                    match close_type.as_str() {
                        "2" => {
                            // 直接退出
                            println!("直接退出应用");
                            let _ = app_handle_clone.exit(0);
                        }
                        "1" | _ => {
                            // 最小化到托盘或默认行为
                            println!("最小化到托盘");
                            let _ = window_clone.hide();
                        }
                    }
                } else {
                    // 获取 closeType 失败，默认最小化到托盘
                    let _ = window_clone.hide();
                }
            });
        }
        _ => {}
    });
}
