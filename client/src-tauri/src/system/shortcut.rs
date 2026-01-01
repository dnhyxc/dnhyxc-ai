use tauri::{AppHandle, Emitter, Manager, Runtime, WebviewWindow};
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut, ShortcutEvent};

pub fn setup_global_shortcut(
    app: &AppHandle,
    main_window: &WebviewWindow,
) -> Result<(), Box<dyn std::error::Error>> {
    let app_handle = app.clone();

    // 定义所有需要在窗口聚焦时注册的快捷键
    let shortcuts = vec![
        Shortcut::new(Some(Modifiers::CONTROL), Code::KeyN),
        Shortcut::new(Some(Modifiers::META), Code::KeyK),
        Shortcut::new(Some(Modifiers::META), Code::KeyW),
        Shortcut::new(Some(Modifiers::META | Modifiers::SHIFT), Code::KeyL),
    ];

    main_window.on_window_event(move |event| match event {
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

    println!("Global shortcut setup completed");
    Ok(())
}

/// 全局快捷键处理函数
pub fn handle_shortcut<R: Runtime>(
    app: &tauri::AppHandle<R>,
    shortcut: &tauri_plugin_global_shortcut::Shortcut,
    _event: ShortcutEvent,
) {
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
        (mods, Code::KeyL) if mods == Modifiers::SUPER | Modifiers::SHIFT => {
            println!("cmd+shift+l");
            let _ = app.emit("shortcut-triggered", "cmd+shift+l");
        }
        // 其他快捷键...
        _ => (),
    }
}
