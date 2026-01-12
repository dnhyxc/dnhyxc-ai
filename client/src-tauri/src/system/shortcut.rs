use crate::utils::common::get_store_value;
use std::collections::HashMap;
use std::sync::{Mutex, LazyLock};
use std::sync::atomic::{AtomicBool, Ordering};
use tauri::{AppHandle, Emitter, Manager, Runtime, WebviewWindow, async_runtime};
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut, ShortcutEvent};

pub static SHORTCUT_HANDLING_ENABLED: AtomicBool = AtomicBool::new(true);

#[derive(Debug, Clone)]
pub struct ShortcutAction {
    pub shortcut: Shortcut,
    pub key: i32,
}

pub static SHORTCUT_KEY_MAPPING: LazyLock<Mutex<HashMap<(Modifiers, Code), i32>>> = LazyLock::new(|| Mutex::new(HashMap::new()));

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
    let key_code = match parts.last()?.to_lowercase().as_str() {
        "a" => Code::KeyA,
        "b" => Code::KeyB,
        "c" => Code::KeyC,
        "d" => Code::KeyD,
        "e" => Code::KeyE,
        "f" => Code::KeyF,
        "g" => Code::KeyG,
        "h" => Code::KeyH,
        "i" => Code::KeyI,
        "j" => Code::KeyJ,
        "k" => Code::KeyK,
        "l" => Code::KeyL,
        "m" => Code::KeyM,
        "n" => Code::KeyN,
        "o" => Code::KeyO,
        "p" => Code::KeyP,
        "q" => Code::KeyQ,
        "r" => Code::KeyR,
        "s" => Code::KeyS,
        "t" => Code::KeyT,
        "u" => Code::KeyU,
        "v" => Code::KeyV,
        "w" => Code::KeyW,
        "x" => Code::KeyX,
        "y" => Code::KeyY,
        "z" => Code::KeyZ,
        "0" => Code::Digit0,
        "1" => Code::Digit1,
        "2" => Code::Digit2,
        "3" => Code::Digit3,
        "4" => Code::Digit4,
        "5" => Code::Digit5,
        "6" => Code::Digit6,
        "7" => Code::Digit7,
        "8" => Code::Digit8,
        "9" => Code::Digit9,
        _ => return None,
    };
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

        for i in 1..=4 {
            let key = format!("shortcut_{}", i);
            match get_store_value(app_handle, &key).await {
                Ok(shortcut_str) => {
                    if shortcut_str.is_empty() {
                        continue;
                    }
                    if let Some(shortcut) = parse_shortcut(&shortcut_str) {
                        let modifiers = shortcut.mods;
                        let code = shortcut.key;
                        mapping.insert((modifiers, code), i);
                        shortcut_actions.push(ShortcutAction {
                            shortcut,
                            key: i,
                        });
                    } else {
                        eprintln!("Failed to parse shortcut: {}", shortcut_str);
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
                    if let Err(e) = app_handle.global_shortcut().register(shortcut_action.shortcut.clone()) {
                        eprintln!("Failed to register shortcut {:?}: {:?}", shortcut_action.shortcut, e);
                    }
                }
            } else {
                for shortcut_action in &shortcut_actions {
                    // 克隆 shortcut 以获得 owned 版本
                    let owned_shortcut = shortcut_action.shortcut.clone();
                    if let Err(e) = app_handle.global_shortcut().unregister(owned_shortcut) {
                        eprintln!("Failed to unregister shortcut {:?}: {:?}", shortcut_action.shortcut, e);
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
        if let Some(&key) = mapping.get(&(modifiers, code)) {
            match key {
                1 => {
                    if let Some(window) = app.get_webview_window("main") {
                        let _ = window.close();
                        let _ = app.emit("shortcut-triggered", "hide");
                    }
                }
                2 => {
                    if let Some(window) = app.get_webview_window("main") {
                        let _ = window.eval("window.location.reload()");
                        let _ = app.emit("shortcut-triggered", "reload");
                    }
                }
                3 => {
                    let _ = app.emit("shortcut-triggered", "new_workflow");
                }
                4 => {
                    let _ = app.emit("shortcut-triggered", "open_subwindow");
                }
                _ => {}
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
