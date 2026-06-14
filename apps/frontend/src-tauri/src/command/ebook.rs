use std::fs;
use std::path::Path;

use rfd::FileDialog;

const MAX_BYTES: u64 = 120 * 1024 * 1024;

/// 桌面端：选择 epub / pdf
#[tauri::command]
pub fn pick_ebook_file() -> Option<String> {
    FileDialog::new()
        .set_title("选择电子书")
        .add_filter("电子书", &["epub", "pdf"])
        .pick_file()
        .map(|path| path.to_string_lossy().to_string())
}

/// 读取电子书字节（asset URL 失败时的后备）
#[tauri::command]
pub fn read_ebook_file(path: String) -> Result<Vec<u8>, String> {
    let trimmed = path.trim();
    if trimmed.is_empty() {
        return Err("path 不能为空".to_string());
    }
    let p = Path::new(trimmed);
    if !p.exists() {
        return Err("文件不存在".to_string());
    }
    let meta = fs::metadata(p).map_err(|e| e.to_string())?;
    if meta.len() > MAX_BYTES {
        return Err(format!(
            "文件超过 {}MB 限制",
            MAX_BYTES / 1024 / 1024
        ));
    }
    fs::read(p).map_err(|e| e.to_string())
}
