use std::io::Cursor;
use std::path::Path;
use std::sync::Mutex;
use base64::Engine as _;

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

/// 读取剪贴板图片位图，编码为 PNG 并返回 base64 字符串（含 data URL 前缀）。
/// 用于单独复制图片/截图场景：arboard 读 ImageData → png crate 编码 → base64。
/// 剪贴板无图片时 readImage 抛错，返回 None。
#[tauri::command]
pub fn read_clipboard_image_base64() -> Result<Option<String>, String> {
    let _guard = CLIPBOARD_LOCK.lock().map_err(|e| e.to_string())?;
    let mut clipboard = arboard::Clipboard::new().map_err(|e| e.to_string())?;
    let img = match clipboard.get_image() {
        Ok(img) => img,
        Err(_) => return Ok(None),
    };
    let width = img.width;
    let height = img.height;
    if width == 0 || height == 0 || img.bytes.is_empty() {
        return Ok(None);
    }
    // RGBA 字节编码为 PNG
    let mut png_buf = Cursor::new(Vec::new());
    {
        let mut encoder = png::Encoder::new(&mut png_buf, width as u32, height as u32);
        encoder.set_color(png::ColorType::Rgba);
        encoder.set_depth(png::BitDepth::Eight);
        let mut writer = encoder
            .write_header()
            .map_err(|e| format!("png header: {}", e))?;
        writer
            .write_image_data(&img.bytes)
            .map_err(|e| format!("png write: {}", e))?;
    }
    let png_bytes = png_buf.into_inner();
    let b64 = base64::engine::general_purpose::STANDARD.encode(&png_bytes);
    Ok(Some(format!("data:image/png;base64,{}", b64)))
}

/// 判断文件扩展名是否为常见图片格式。
fn is_image_ext(path: &Path) -> bool {
    let ext = path
        .extension()
        .and_then(|e| e.to_str())
        .map(|e| e.to_ascii_lowercase())
        .unwrap_or_default();
    matches!(
        ext.as_str(),
        "png" | "jpg" | "jpeg" | "gif" | "bmp" | "webp" | "ico" | "tiff" | "tif"
    )
}

/// 根据扩展名猜测 MIME 类型，用于 data URL 前缀。
fn mime_of(path: &Path) -> &'static str {
    let ext = path
        .extension()
        .and_then(|e| e.to_str())
        .map(|e| e.to_ascii_lowercase())
        .unwrap_or_default();
    match ext.as_str() {
        "png" => "image/png",
        "jpg" | "jpeg" => "image/jpeg",
        "gif" => "image/gif",
        "bmp" => "image/bmp",
        "webp" => "image/webp",
        "ico" => "image/x-icon",
        "tiff" | "tif" => "image/tiff",
        _ => "application/octet-stream",
    }
}

/// 读取剪贴板文件列表中的图片文件，逐个编码为 data URL 返回。
/// 用于多图粘贴场景（如从 Finder 选中多个图片文件复制、从富文本应用复制多图）：
/// arboard get_image 只能读单张位图，file_list 能拿到所有文件路径。
/// 非图片文件、读取失败的单项会被跳过，不影响其他图片。
#[tauri::command]
pub fn read_clipboard_image_files_base64() -> Result<Vec<String>, String> {
    let _guard = CLIPBOARD_LOCK.lock().map_err(|e| e.to_string())?;
    let mut clipboard = arboard::Clipboard::new().map_err(|e| e.to_string())?;
    let paths = match clipboard.get().file_list() {
        Ok(paths) if !paths.is_empty() => paths,
        _ => return Ok(Vec::new()),
    };
    let mut result: Vec<String> = Vec::new();
    for path in paths {
        if !is_image_ext(&path) {
            continue;
        }
        let bytes = match std::fs::read(&path) {
            Ok(b) => b,
            Err(_) => continue,
        };
        let mime = mime_of(&path);
        let b64 = base64::engine::general_purpose::STANDARD.encode(&bytes);
        result.push(format!("data:{};base64,{}", mime, b64));
    }
    Ok(result)
}
