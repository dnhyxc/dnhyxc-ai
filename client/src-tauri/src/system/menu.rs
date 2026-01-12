use tauri::Emitter;
use tauri::Manager;
use tauri::menu::{MenuBuilder, SubmenuBuilder};

// 使用 `use crate::utils;` 会把整个 `utils` 模块（即 src/utils/mod.rs 中公开的所有项）一次性引入当前作用域，
// 后续代码里可以直接写 `utils::xxx` 来调用其中的子模块或函数。
// 这与 `use utils::common::set_screen_center;` 不同，后者只单独引入了 `utils::common` 子模块里的 `set_screen_center` 函数，
// 使得当前文件可以直接写 `set_screen_center(...)` 而无需再写完整路径。
use crate::utils;

use utils::common::set_screen_center;

pub fn setup_menu<R: tauri::Runtime>(app: &mut tauri::App<R>) -> tauri::Result<()> {
    // 创建文件菜单
    let file_menu = SubmenuBuilder::new(app, "File")
        .text("about", "关于应用")
        .separator()
        .text("logout", "退出登录")
        .text("quit", "退出应用")
        .build()?;

    // 创建窗口菜单
    let window_menu = SubmenuBuilder::new(app, "窗口")
        .text("minimize", "隐藏窗口")
        .separator()
        .text("close", "关闭窗口")
        // .separator() // 分割线
        .text("scale", "缩放窗口")
        .text("fill", "填充窗口")
        .text("center", "居中窗口")
        .separator()
        .text("fullscreen", "全屏窗口")
        .build()?;

    // 创建编辑菜单
    let edit_menu = SubmenuBuilder::new(app, "编辑")
        .text("undo", "撤回")
        .separator()
        .text("cut", "剪切")
        .text("copy", "复制")
        .text("paste", "粘贴")
        .separator()
        .text("selectAll", "全选")
        .build()?;

    // 创建主菜单
    let menu = MenuBuilder::new(app)
        .items(&[&file_menu, &window_menu, &edit_menu])
        .build()?;

    // 设置菜单
    app.set_menu(menu)?;

    // 绑定菜单事件
    app.on_menu_event(move |app_handle: &tauri::AppHandle<R>, event| {
        let win = app_handle.get_webview_window("main").unwrap();

        match event.id().0.as_str() {
            "minimize" => {
                // 使用淡出动画隐藏窗口，体验更原生
                let _ = win.minimize();
            }
            "close" => {
                let _ = win.hide();
            }
            "scale" => {
                // 立即将窗口居中，模拟原生双击缩放效果
                if win.is_maximized().unwrap_or(false) {
                    let _ = win.unmaximize();
                } else {
                    let _ = win.maximize();
                }
            }
            "center" => {
                // 获取当前显示器信息并计算居中位置
                set_screen_center(&win);
            }
            "fill" => {
                // 获取当前屏幕可用尺寸，实现填充效果
                if let Ok(Some(monitor)) = win.current_monitor() {
                    let size = monitor.size();
                    let _ = win.set_size(tauri::Size::Physical(tauri::PhysicalSize {
                        width: size.width,
                        height: size.height,
                    }));
                    let _ = win.set_position(tauri::Position::Physical(tauri::PhysicalPosition {
                        x: 0,
                        y: 0,
                    }));
                }
            }
            "fullscreen" => {
                let _ = win.set_fullscreen(true);
            }
            "quit" => {
                let _ = app_handle.exit(0);
            }
            "logout" => {
                // 向前端发送退出登录的消息
                // 前端监听方式：window.addEventListener('logout', () => { ... })
                let _ = win.emit("logout", ());
            }
            "about" => {
                let app_version = app_handle.package_info().version.to_string();
                let _ = win.emit("about", serde_json::json!({"version": app_version}));
            }
            "undo" => {
                let _ = win.eval("document.execCommand('undo')");
            }
            "cut" => {
                let _ = win.eval("document.execCommand('cut')");
            }
            "copy" => {
                let _ = win.eval("document.execCommand('copy')");
            }
            "paste" => {
                let _ = win.eval("document.execCommand('paste')");
            }
            "selectAll" => {
                let _ = win.eval("document.execCommand('selectAll')");
            }
            _ => {}
        }
    });

    Ok(())
}
