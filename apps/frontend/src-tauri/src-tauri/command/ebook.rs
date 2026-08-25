use std::fs;
use std::path::Path;

const MAX_UPLOAD_BYTES: u64 = 120 * 1024 * 1024;
/// 本地打开阅读允许更大体积（上传仍受 MAX_UPLOAD_BYTES 约束）
const MAX_OPEN_BYTES: u64 = 512 * 1024 * 1024;

/// 读取电子书字节（asset URL 失败时的后备）
/// `for_upload`: true 时按上传上限校验，false/None 时按阅读上限校验
#[tauri::command]
pub fn read_ebook_file(path: String, for_upload: Option<bool>) -> Result<Vec<u8>, String> {
    let trimmed = path.trim();
    if trimmed.is_empty() {
        return Err("path 不能为空".to_string());
    }
    let p = Path::new(trimmed);
    if !p.exists() {
        return Err("文件不存在".to_string());
    }
    let meta = fs::metadata(p).map_err(|e| e.to_string())?;
    let max_bytes = if for_upload.unwrap_or(false) {
        MAX_UPLOAD_BYTES
    } else {
        MAX_OPEN_BYTES
    };
    if meta.len() > max_bytes {
        return Err(format!(
            "文件超过 {}MB 限制",
            max_bytes / 1024 / 1024
        ));
    }
    fs::read(p).map_err(|e| e.to_string())
}
