use crate::constant::common::get_key_code;
use crate::utils::common::get_store_value;
use std::collections::HashMap;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{LazyLock, Mutex};
use tauri::{AppHandle, Emitter, Manager, Runtime, WebviewWindow, async_runtime};
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut, ShortcutEvent};

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum ShortcutActionType {
    Hide,
    Reload,
    NewWorkflow,
    OpenSubWindow,
    HideOrShowApp,
}

#[derive(Debug, Clone)]
pub struct ShortcutAction {
    pub shortcut: Shortcut,
    pub key: i32,
}

impl ShortcutActionType {
    fn from_key(key: i32) -> Option<Self> {
        match key {
            1 => Some(ShortcutActionType::Hide),
            2 => Some(ShortcutActionType::HideOrShowApp),
            3 => Some(ShortcutActionType::Reload),
            4 => Some(ShortcutActionType::NewWorkflow),
            5 => Some(ShortcutActionType::OpenSubWindow),
            _ => None,
        }
    }
}

pub static SHORTCUT_KEY_MAPPING: LazyLock<Mutex<HashMap<(Modifiers, Code), ShortcutActionType>>> =
    LazyLock::new(|| Mutex::new(HashMap::new()));

pub const MAX_SHORTCUT_KEY: i32 = 5;

pub static SHORTCUT_HANDLING_ENABLED: AtomicBool = AtomicBool::new(true);

/// 辅助函数：将快捷键转换为字符串表示
fn shortcut_to_string(modifiers: Modifiers, key: Code) -> String {
    let mut parts = Vec::new();

    if modifiers.contains(Modifiers::CONTROL) {
        parts.push("Control");
    }
    if modifiers.contains(Modifiers::SUPER) {
        parts.push("SUPER");
    }
    if modifiers.contains(Modifiers::META) {
        parts.push("META");
    }
    if modifiers.contains(Modifiers::ALT) {
        parts.push("Alt");
    }
    if modifiers.contains(Modifiers::SHIFT) {
        parts.push("Shift");
    }

    let key_str = format!("{:?}", key);
    parts.push(&key_str);

    parts.join(" + ")
}

pub fn parse_shortcut(shortcut_str: &str) -> Option<Shortcut> {
    let parts: Vec<&str> = shortcut_str.split(" + ").collect();
    if parts.is_empty() {
        return None;
    }
    let key_code = get_key_code(parts.last()?)?;
    let mut modifiers = Modifiers::empty();
    for part in &parts[..parts.len() - 1] {
        match part.to_lowercase().as_str() {
            "control" => modifiers |= Modifiers::CONTROL,
            "meta" | "super" => modifiers |= Modifiers::META,
            "alt" => modifiers |= Modifiers::ALT,
            "shift" => modifiers |= Modifiers::SHIFT,
            _ => continue,
        }
    }
    if modifiers.is_empty() {
        return None;
    }
    Some(Shortcut::new(Some(modifiers), key_code))
}

/// 从 store 中读取并解析快捷键配置
pub fn load_shortcuts_from_store(app_handle: &AppHandle) -> Vec<ShortcutAction> {
    async_runtime::block_on(async move {
        let mut shortcut_actions = Vec::new();
        let mut mapping = SHORTCUT_KEY_MAPPING.lock().unwrap();
        mapping.clear();

        for i in 1..=MAX_SHORTCUT_KEY {
            let key = format!("shortcut_{}", i);
            match get_store_value(app_handle, &key).await {
                Ok(shortcut_str) => {
                    if shortcut_str.is_empty() {
                        continue;
                    }
                    if let Some(action_type) = ShortcutActionType::from_key(i) {
                        if let Some(shortcut) = parse_shortcut(&shortcut_str) {
                            let modifiers = shortcut.mods;
                            let code = shortcut.key;
                            mapping.insert((modifiers, code), action_type);
                            shortcut_actions.push(ShortcutAction { shortcut, key: i });
                        } else {
                            eprintln!("Failed to parse shortcut: {}", shortcut_str);
                        }
                    }
                }
                Err(_) => continue,
            }
        }

        shortcut_actions
    })
}

pub fn setup_global_shortcut(
    app: &AppHandle,
    window: &WebviewWindow,
) -> Result<(), Box<dyn std::error::Error>> {
    let app_handle = app.clone();

    // 从 store 中读取快捷键配置并解析
    let shortcut_actions = load_shortcuts_from_store(app);

    window.on_window_event(move |event| match event {
        tauri::WindowEvent::Focused(focused) => {
            if *focused {
                for shortcut_action in &shortcut_actions {
                    if let Err(e) = app_handle
                        .global_shortcut()
                        .register(shortcut_action.shortcut.clone())
                    {
                        eprintln!(
                            "Failed to register shortcut {:?}: {:?}",
                            shortcut_action.shortcut, e
                        );
                    }
                }
            } else {
                for shortcut_action in &shortcut_actions {
                    let modifiers = shortcut_action.shortcut.mods;
                    let code = shortcut_action.shortcut.key;

                    if let Ok(mapping) = SHORTCUT_KEY_MAPPING.lock() {
                        if let Some(&action_type) = mapping.get(&(modifiers, code)) {
                            if action_type == ShortcutActionType::HideOrShowApp {
                                continue;
                            }
                        }
                    }

                    let owned_shortcut = shortcut_action.shortcut.clone();
                    if let Err(e) = app_handle.global_shortcut().unregister(owned_shortcut) {
                        eprintln!(
                            "Failed to unregister shortcut {:?}: {:?}",
                            shortcut_action.shortcut, e
                        );
                    }
                }
            }
        }
        _ => {}
    });
    Ok(())
}

/// 全局快捷键处理函数 - 动态处理所有注册的快捷键
pub fn handle_shortcut<R: Runtime>(
    app: &tauri::AppHandle<R>,
    shortcut: &tauri_plugin_global_shortcut::Shortcut,
    _event: ShortcutEvent,
) {
    if !SHORTCUT_HANDLING_ENABLED.load(Ordering::SeqCst) {
        return;
    }

    let modifiers = shortcut.mods;
    let code = shortcut.key;

    if let Ok(mapping) = SHORTCUT_KEY_MAPPING.lock() {
        if let Some(&action_type) = mapping.get(&(modifiers, code)) {
            match action_type {
                ShortcutActionType::Hide => {
                    if let Some(window) = app.get_webview_window("main") {
                        let _ = window.close();
                        let _ = app.emit("shortcut-triggered", "hide");
                    }
                }
                ShortcutActionType::Reload => {
                    if let Some(window) = app.get_webview_window("main") {
                        let _ = window.eval("window.location.reload()");
                        let _ = app.emit("shortcut-triggered", "reload");
                    }
                }
                ShortcutActionType::NewWorkflow => {
                    let _ = app.emit("shortcut-triggered", "new_workflow");
                }
                ShortcutActionType::OpenSubWindow => {
                    let _ = app.emit("shortcut-triggered", "open_subwindow");
                }
                ShortcutActionType::HideOrShowApp => {
                    if let Some(window) = app.get_webview_window("main") {
                        if window.is_visible().unwrap_or(true) {
                            // let _ = window.hide();
                            let _ = app.emit("shortcut-triggered", "hide");
                        } else {
                            let _ = window.show();
                            let _ = window.set_focus();
                            let _ = app.emit("shortcut-triggered", "show");
                        }
                    }
                }
            }
        } else {
            let shortcut_str = shortcut_to_string(shortcut.mods, shortcut.key);
            let modifiers_str = format!("{:?}", shortcut.mods);
            let shortcut_info = serde_json::json!({
                "shortcut": shortcut_str,
                "modifiers": modifiers_str,
                "key": format!("{:?}", shortcut.key),
            });
            let _ = app.emit("shortcut-triggered", shortcut_info);
        }
    }
}
