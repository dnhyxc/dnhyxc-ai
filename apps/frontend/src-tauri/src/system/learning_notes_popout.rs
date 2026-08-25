//! 托管关窗：创建时 attach on_window_event；❌ → prevent → 通知前端 → destroy。

use std::collections::HashSet;
use std::sync::{LazyLock, Mutex};

use tauri::{Emitter, Manager, WindowEvent};

pub const LEARNING_NOTES_POPOUT_LABEL: &str = "learning-notes-popout";

const HOST_CLOSE_HOOK: &str = "globalThis.__DNHYXC_HOST_WINDOW_CLOSE__";
pub const HOST_CLOSE_EVENT: &str = "host://host-window-close";

static ALLOW_CLOSE: LazyLock<Mutex<HashSet<String>>> =
	LazyLock::new(|| Mutex::new(HashSet::new()));
static ATTACHED: LazyLock<Mutex<HashSet<String>>> = LazyLock::new(|| Mutex::new(HashSet::new()));

pub fn managed_label(label: &str) -> bool {
	label == LEARNING_NOTES_POPOUT_LABEL
}

fn notify_frontend_close(app: &tauri::AppHandle, label: &str) {
	let Some(win) = app.get_webview_window(label) else {
		return;
	};
	let _ = win.emit(HOST_CLOSE_EVENT, label);
	let script = format!(
		"try{{const f={HOST_CLOSE_HOOK};if(typeof f==='function')f({label:?});}}catch(e){{console.error('[hostWindowClose]',e)}}"
	);
	let _ = win.eval(&script);
}

fn on_close_requested(label: &str, event: &WindowEvent, app: &tauri::AppHandle) {
	let WindowEvent::CloseRequested { api, .. } = event else {
		return;
	};
	let allow = ALLOW_CLOSE
		.lock()
		.ok()
		.and_then(|mut g| g.remove(label).then_some(()))
		.is_some();
	if allow {
		return;
	}
	api.prevent_close();
	notify_frontend_close(app, label);
}

/// RunEvent 全局兜底
pub fn handle_close_requested(
	label: &str,
	event: &WindowEvent,
	app: &tauri::AppHandle,
) {
	if !managed_label(label) {
		return;
	}
	on_close_requested(label, event, app);
}

/// 子窗 tauri://created 后由前端 invoke，绑定该 WebviewWindow 的 CloseRequested
#[tauri::command]
pub fn attach_managed_window_close(app: tauri::AppHandle, label: String) -> Result<(), String> {
	if !managed_label(&label) {
		return Ok(());
	}
	{
		let mut attached = ATTACHED.lock().map_err(|e| e.to_string())?;
		if !attached.insert(label.clone()) {
			return Ok(());
		}
	}

	let win = app
		.get_webview_window(&label)
		.ok_or_else(|| format!("window not found: {label}"))?;

	let app_handle = app.clone();
	let label_for = label;
	win.on_window_event(move |event| {
		on_close_requested(&label_for, event, &app_handle);
	});

	Ok(())
}

#[tauri::command]
pub fn close_webview_window(app: tauri::AppHandle, label: String) -> Result<(), String> {
	let win = app
		.get_webview_window(&label)
		.ok_or_else(|| format!("window not found: {label}"))?;
	if let Ok(mut g) = ALLOW_CLOSE.lock() {
		g.insert(label);
	}
	win.destroy().map_err(|e| e.to_string())
}
