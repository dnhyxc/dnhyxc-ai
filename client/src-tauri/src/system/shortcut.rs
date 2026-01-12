use crate::utils::common::get_store_value;
use std::sync::atomic::{AtomicBool, Ordering};
use tauri::{AppHandle, Emitter, Manager, Runtime, WebviewWindow, async_runtime};
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut, ShortcutEvent};

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
pub fn load_shortcuts_from_store(app_handle: &AppHandle) -> Vec<Shortcut> {
    async_runtime::block_on(async move {
        let mut shortcuts = Vec::new();

        for i in 1..=4 {
            let key = format!("shortcut_{}", i);
            match get_store_value(app_handle, &key).await {
                Ok(shortcut_str) => {
                    if shortcut_str.is_empty() {
                        continue;
                    }
                    if let Some(shortcut) = parse_shortcut(&shortcut_str) {
                        shortcuts.push(shortcut);
                    } else {
                        eprintln!("Failed to parse shortcut: {}", shortcut_str);
                    }
                }
                Err(_) => continue,
            }
        }

        shortcuts
    })
}

pub fn setup_global_shortcut(
    app: &AppHandle,
    window: &WebviewWindow,
) -> Result<(), Box<dyn std::error::Error>> {
    let app_handle = app.clone();

    // 从 store 中读取快捷键配置并解析
    let shortcuts = load_shortcuts_from_store(app);

    window.on_window_event(move |event| match event {
        tauri::WindowEvent::Focused(focused) => {
            if *focused {
                for shortcut in &shortcuts {
                    if let Err(e) = app_handle.global_shortcut().register(shortcut.clone()) {
                        eprintln!("Failed to register shortcut {:?}: {:?}", shortcut, e);
                    }
                }
            } else {
                for shortcut in &shortcuts {
                    // 克隆 shortcut 以获得 owned 版本
                    let owned_shortcut = shortcut.clone();
                    if let Err(e) = app_handle.global_shortcut().unregister(owned_shortcut) {
                        eprintln!("Failed to unregister shortcut {:?}: {:?}", shortcut, e);
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

    match (shortcut.mods, shortcut.key) {
        (mods, Code::KeyW) if mods == Modifiers::SUPER => {
            app.get_webview_window("main").unwrap().close().unwrap();
            let _ = app.emit("shortcut-triggered", "cmd+w");
        }
        (mods, Code::KeyN) if mods == Modifiers::CONTROL => {
            let _ = app.emit("shortcut-triggered", "ctrl+n");
        }
        (mods, Code::KeyK) if mods == Modifiers::SUPER => {
            let _ = app.emit("shortcut-triggered", "cmd+k");
        }
        (mods, Code::KeyR) if mods == Modifiers::SUPER => {
            let _ = app.emit("shortcut-triggered", "cmd+r");
            let window = app.get_webview_window("main").unwrap();
            window.eval("window.location.reload()").ok();
        }
        (mods, Code::KeyL) if mods == Modifiers::SUPER | Modifiers::SHIFT => {
            let _ = app.emit("shortcut-triggered", "cmd+shift+l");
        }
        // 其他快捷键...
        _ => (),
    };

    let shortcut_str = shortcut_to_string(shortcut.mods, shortcut.key);

    let modifiers_str = format!("{:?}", shortcut.mods);

    let shortcut_info = serde_json::json!({
        "shortcut": shortcut_str,
        "modifiers": modifiers_str,
        "key": format!("{:?}", shortcut.key),
    });

    let _ = app.emit("shortcut-triggered", shortcut_info);
}
