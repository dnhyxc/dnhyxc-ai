use rfd::FileDialog;
use tauri_plugin_autostart::ManagerExt;

#[tauri::command]
pub fn greet_name(name: &str) -> String {
    // 使用 format! 宏将名称嵌入到问候模板中
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[tauri::command]
pub async fn select_file() -> Result<String, String> {
    let dialog = FileDialog::new()
        .add_filter("所有文件", &["*"])
        .add_filter("文本文件", &["txt", "md", "json"])
        .add_filter("图片文件", &["png", "jpg", "jpeg", "gif", "bmp"]);

    match dialog.pick_file() {
        Some(path) => Ok(path.to_string_lossy().to_string()),
        None => Err("未选择文件".to_string()),
    }
}

#[tauri::command]
pub async fn select_directory() -> Result<String, String> {
    match FileDialog::new().pick_folder() {
        Some(path) => Ok(path.to_string_lossy().to_string()),
        None => Err("未选择目录".to_string()),
    }
}

/// 设置开机自启
#[tauri::command]
pub async fn enable_auto_start(app_handle: tauri::AppHandle) -> Result<(), String> {
    app_handle
        .autolaunch()
        .enable()
        .map_err(|e| format!("设置开机自启失败: {}", e))?;
    Ok(())
}

/// 取消开机自启
#[tauri::command]
pub async fn disable_auto_start(app_handle: tauri::AppHandle) -> Result<(), String> {
    app_handle
        .autolaunch()
        .disable()
        .map_err(|e| format!("取消开机自启失败: {}", e))?;
    Ok(())
}

/// 检查是否已设置开机自启
#[tauri::command]
pub async fn is_auto_start_enabled(app_handle: tauri::AppHandle) -> Result<bool, String> {
    let is_enabled = app_handle
        .autolaunch()
        .is_enabled()
        .map_err(|e| format!("检查开机自启状态失败: {}", e))?;
    Ok(is_enabled)
}
