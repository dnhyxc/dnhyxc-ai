use std::sync::Mutex;

/// 全局剪贴板锁（arboard 的 Clipboard 非 Send，跨线程访问需加锁）
static CLIPBOARD_LOCK: Mutex<()> = Mutex::new(());

/// 读取剪贴板 HTML 内容（含 <img src> 等富文本结构）。
/// 用于桌面端图文混合粘贴：前端拿到 HTML 后解析 img 标签插入编辑器。
/// macOS 下读 public.html flavor，Windows 下读 HTML Format，Linux 下读 text/html。
#[tauri::command]
pub fn read_clipboard_html() -> Result<Option<String>, String> {
    let _guard = CLIPBOARD_LOCK.lock().map_err(|e| e.to_string())?;
    let mut clipboard = arboard::Clipboard::new().map_err(|e| e.to_string())?;
    // arboard 公共 API：get().html() 读 HTML flavor，无 HTML 时抛错，返回 None
    match clipboard.get().html() {
        Ok(html) if !html.is_empty() => Ok(Some(html)),
        Ok(_) => Ok(None),
        Err(_) => Ok(None),
    }
}
