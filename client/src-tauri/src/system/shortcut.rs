use crate::utils::common::get_store_value;
use tauri::{AppHandle, Emitter, Manager, Runtime, WebviewWindow, async_runtime};
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut, ShortcutEvent};

/// 辅助函数：将快捷键转换为字符串表示
fn shortcut_to_string(modifiers: Modifiers, key: Code) -> String {
    let mut parts = Vec::new();
    println!("modifiers: {:?}, key: {:?}", modifiers, key);

    if modifiers.contains(Modifiers::CONTROL) {
        parts.push("Control");
    }
    if modifiers.contains(Modifiers::SUPER) {
        println!("SUPER");
        parts.push("SUPER");
    }
    if modifiers.contains(Modifiers::META) {
        println!("META");
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

fn parse_shortcut(shortcut_str: &str) -> Option<Shortcut> {
    let parts: Vec<&str> = shortcut_str.split(" + ").collect();
    if parts.is_empty() {
        return None;
    }
    let key_code = match parts.last()?.to_lowercase().as_str() {
        "n" => Code::KeyN,
        "k" => Code::KeyK,
        "w" => Code::KeyW,
        "r" => Code::KeyR,
        "l" => Code::KeyL,
        "f" => Code::KeyF,
        "g" => Code::KeyG,
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
fn load_shortcuts_from_store(app_handle: &AppHandle) -> Vec<Shortcut> {
    async_runtime::block_on(async move {
        let mut shortcuts = Vec::new();

        for i in 1..=4 {
            let key = format!("shortcut_{}", i);
            match get_store_value(app_handle, &key).await {
                Ok(shortcut_str) => {
                    if let Some(shortcut) = parse_shortcut(&shortcut_str) {
                        shortcuts.push(shortcut);
                    }
                }
                Err(_) => continue,
            }
        }

        shortcuts
    })
}

/// 注册单个快捷键
#[tauri::command]
pub fn register_shortcut(app: tauri::AppHandle, shortcut_str: String) -> Result<(), String> {
    let shortcut = parse_shortcut(&shortcut_str)
        .ok_or_else(|| format!("Invalid shortcut format: {}", shortcut_str))?;

    println!("Registering shortcut: {:?}", shortcut);

    if let Err(e) = app.global_shortcut().register(shortcut.clone()) {
        return Err(format!(
            "Failed to register shortcut {:?}: {:?}",
            shortcut, e
        ));
    }

    println!("Shortcut registered successfully: {:?}", shortcut);
    Ok(())
}

/// 重新加载所有快捷键配置（从 store 读取）
#[tauri::command]
pub fn reload_all_shortcuts(app: tauri::AppHandle) -> Result<(), String> {
    let shortcuts = load_shortcuts_from_store(&app);

    println!("Reload all shortcuts--------: {:?}", shortcuts);

    for shortcut in &shortcuts {
        if let Err(e) = app.global_shortcut().register(shortcut.clone()) {
            return Err(format!(
                "Failed to register shortcut {:?}: {:?}",
                shortcut, e
            ));
        }
    }

    println!("All shortcuts reloaded: {:?}", shortcuts);
    Ok(())
}

/// 清空所有已注册的快捷键
#[tauri::command]
pub fn clear_all_shortcuts(app: tauri::AppHandle) -> Result<(), String> {
    println!("Clearing all shortcuts");

    if let Err(e) = app.global_shortcut().unregister_all() {
        return Err(format!("Failed to clear all shortcuts: {:?}", e));
    }

    println!("All shortcuts cleared successfully");
    Ok(())
}

pub fn setup_global_shortcut(
    app: &AppHandle,
    window: &WebviewWindow,
) -> Result<(), Box<dyn std::error::Error>> {
    let app_handle = app.clone();

    // 从 store 中读取快捷键配置并解析
    let shortcuts = load_shortcuts_from_store(app);

    println!("Shortcuts: {:?}", shortcuts);

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
    // TODO: 注册时先要暂停监听
    match (shortcut.mods, shortcut.key) {
        (mods, Code::KeyW) if mods == Modifiers::SUPER => {
            println!("cmd+w");
            app.get_webview_window("main").unwrap().close().unwrap();
            let _ = app.emit("shortcut-triggered", "cmd+w");
        }
        (mods, Code::KeyN) if mods == Modifiers::CONTROL => {
            println!("ctrl+n");
            let _ = app.emit("shortcut-triggered", "ctrl+n");
        }
        (mods, Code::KeyK) if mods == Modifiers::SUPER => {
            println!("cmd+k");
            let _ = app.emit("shortcut-triggered", "cmd+k");
        }
        (mods, Code::KeyR) if mods == Modifiers::SUPER => {
            let _ = app.emit("shortcut-triggered", "cmd+r");
            let window = app.get_webview_window("main").unwrap();
            window.eval("window.location.reload()").ok();
        }
        (mods, Code::KeyL) if mods == Modifiers::SUPER | Modifiers::SHIFT => {
            println!("cmd+shift+l");
            let _ = app.emit("shortcut-triggered", "cmd+shift+l");
        }
        // 其他快捷键...
        _ => (),
    };

    let shortcut_str = shortcut_to_string(shortcut.mods, shortcut.key);

    println!("Shortcut triggered shortcut_str: {}", shortcut_str);

    let modifiers_str = format!("{:?}", shortcut.mods);

    println!("Shortcut triggered modifiers_str: {}", modifiers_str);

    let shortcut_info = serde_json::json!({
        "shortcut": shortcut_str,
        "modifiers": modifiers_str,
        "key": format!("{:?}", shortcut.key),
    });

    let _ = app.emit("shortcut-triggered", shortcut_info);
}
