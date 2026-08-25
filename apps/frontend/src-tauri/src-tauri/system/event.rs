use crate::utils::common::get_store_value;
use tauri::{Emitter, Runtime, WindowEvent};

const WINDOW_FULLSCREEN_EVENT: &str = "host://window-fullscreen";

fn emit_window_fullscreen<R: Runtime>(window: &tauri::WebviewWindow<R>) {
	let fs = window.is_fullscreen().unwrap_or(false);
	let _ = window.emit(WINDOW_FULLSCREEN_EVENT, fs);
}

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
							let _ = app_handle_clone.exit(0);
						}
						"1" | _ => {
							// 最小化到托盘或默认行为
							let _ = window_clone.hide();
						}
					}
				} else {
					// 获取 closeType 失败，默认最小化到托盘
					let _ = window_clone.hide();
				}
			});
		}
		// 用户用系统手势/绿钮退出全屏时立刻通知前端收起影院态
		WindowEvent::Resized(_) => {
			emit_window_fullscreen(&window);
			// macOS：resize 早于 is_fullscreen 落定，短延迟再报一次
			let win = window.clone();
			std::thread::spawn(move || {
				std::thread::sleep(std::time::Duration::from_millis(80));
				emit_window_fullscreen(&win);
			});
		}
		_ => {}
	});
}

/// 菜单/快捷键切换全屏后同步前端影院态
pub fn emit_window_fullscreen_state<R: Runtime>(window: &tauri::WebviewWindow<R>) {
	emit_window_fullscreen(window);
}
