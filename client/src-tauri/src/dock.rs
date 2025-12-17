#[cfg(target_os = "macos")]
use tauri::{AppHandle, Manager, RunEvent, Runtime};

/// 当应用在 macOS 系统上重新打开时，如果没有可见窗口，会优先显示已存在的 home 窗口。
#[cfg(target_os = "macos")]
/// 处理 Tauri 应用生命周期事件，主要用于 macOS 平台。
/// 当用户点击 Dock 图标或系统触发 Reopen 事件时，如果当前没有任何可见窗口，
/// 本函数会尝试将名为 "main" 的主窗口显示出来，并置于最前端。
///
/// # 参数
/// - `app_handle`: 对当前应用实例的句柄，可用于获取窗口、管理状态等。
/// - `event`: 系统或框架派发的事件，这里只关心 `RunEvent::Reopen`。
///
/// # 说明
/// 1. 仅对 `RunEvent::Reopen` 事件进行处理，其余事件直接忽略。
/// 2. 通过 `app_handle.get_webview_window("main")` 获取主窗口：
///    - 如果窗口存在，则依次执行：
///      - `show()`: 确保窗口处于显示状态（非隐藏）。
///      - `unminimize()`: 如果窗口被最小化，则恢复。
///      - `set_focus()`: 将窗口置于最前并获取焦点。
///    - 如果窗口不存在，则不做任何操作。
/// 3. 使用 `let _ = ...` 忽略可能的错误，避免程序崩溃。
pub fn dock_event<R: Runtime>(app_handle: &AppHandle<R>, event: RunEvent) {
    match event {
        // macOS 上用户点击 Dock 图标或系统触发重新打开应用时发送的事件
        RunEvent::Reopen { .. } => {
            // 直接尝试获取 home 窗口，如果存在则显示并置于最顶部
            if let Some(home_window) = app_handle.get_webview_window("main") {
                let _ = home_window.show();
                let _ = home_window.unminimize();
                let _ = home_window.set_focus();
            }
        }
        // 其他事件不做处理
        _ => {}
    }
}
