use crate::system::shortcut::{
    SHORTCUT_HANDLING_ENABLED, load_shortcuts_from_store, parse_shortcut,
};
use rfd::FileDialog;
use serde::Deserialize;
use std::fs;
use std::sync::atomic::Ordering;
use tauri::Manager;
use tauri::path::BaseDirectory;
use tauri_plugin_autostart::ManagerExt;
use tauri_plugin_global_shortcut::GlobalShortcutExt;

#[tauri::command]
pub fn greet_name(name: &str) -> String {
    // 使用 format! 宏将名称嵌入到问候模板中
    format!("Hello, {}! You've been greeted from Rust!", name)
}

/// 通用文件选择入参（与前端 camelCase 对齐）
#[derive(Debug, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SelectFilesInput {
    /// HTML 风格 accept，如 `.mp4,.webm`；空/省略则不限制
    #[serde(default)]
    pub accept: Option<String>,
    /// 多选；默认 false
    #[serde(default)]
    pub multiple: Option<bool>,
    /// 对话框标题
    #[serde(default)]
    pub title: Option<String>,
}

/// 从 accept 抽出扩展名（去掉点、小写）；仅识别 `.ext` 规则
fn parse_accept_extensions(accept: &str) -> Vec<String> {
    let mut out = Vec::new();
    for part in accept.split(',') {
        let s = part.trim();
        if !s.starts_with('.') || s.len() < 2 {
            continue;
        }
        let ext = s[1..].trim().to_lowercase();
        if ext.is_empty() || ext.contains('*') || ext.contains('/') {
            continue;
        }
        if !out.iter().any(|e| e == &ext) {
            out.push(ext);
        }
    }
    out
}

/// 通用选文件：支持 accept 过滤与单/多选；取消返回 `canceled`
#[tauri::command]
pub fn select_files(input: Option<SelectFilesInput>) -> Result<Vec<String>, String> {
    let input = input.unwrap_or_default();
    let multiple = input.multiple.unwrap_or(false);
    let mut dialog = FileDialog::new();

    if let Some(title) = input
        .title
        .as_deref()
        .map(str::trim)
        .filter(|t| !t.is_empty())
    {
        dialog = dialog.set_title(title);
    }

    let exts = input
        .accept
        .as_deref()
        .map(parse_accept_extensions)
        .unwrap_or_default();
    if !exts.is_empty() {
        let refs: Vec<&str> = exts.iter().map(String::as_str).collect();
        dialog = dialog.add_filter("Files", &refs);
    }

    if multiple {
        match dialog.pick_files() {
            Some(paths) if !paths.is_empty() => Ok(paths
                .into_iter()
                .map(|p| p.to_string_lossy().into_owned())
                .collect()),
            _ => Err("canceled".to_string()),
        }
    } else {
        match dialog.pick_file() {
            Some(path) => Ok(vec![path.to_string_lossy().into_owned()]),
            None => Err("canceled".to_string()),
        }
    }
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

/// 读取用户选中的 `.json` 导入文件（UTF-8）
#[tauri::command]
pub fn read_english_learning_import_json_file(file_path: String) -> Result<String, String> {
    let trimmed = file_path.trim();
    if trimmed.is_empty() {
        return Err("filePath 不能为空".to_string());
    }
    let lower = trimmed.to_lowercase();
    if !lower.ends_with(".json") {
        return Err("仅允许读取 .json 文件".to_string());
    }
    let p = std::path::Path::new(trimmed);
    if !p.exists() || !p.is_file() {
        return Err("文件不存在或不是普通文件".to_string());
    }
    fs::read_to_string(p).map_err(|e| e.to_string())
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

/// 清空所有已注册的快捷键
#[tauri::command]
pub fn clear_all_shortcuts(app: tauri::AppHandle) -> Result<(), String> {
    if let Err(e) = app.global_shortcut().unregister_all() {
        return Err(format!("Failed to clear all shortcuts: {:?}", e));
    }
    Ok(())
}

/// 注册单个快捷键
#[tauri::command]
pub fn register_shortcut(
    app: tauri::AppHandle,
    shortcut_str: String,
    current_key: Option<i32>,
) -> Result<(), String> {
    SHORTCUT_HANDLING_ENABLED.store(false, Ordering::SeqCst);

    let shortcut = parse_shortcut(&shortcut_str)
        .ok_or_else(|| format!("Invalid shortcut format: {}", shortcut_str))?;

    let shortcut_actions = load_shortcuts_from_store(&app);

    for shortcut_action in &shortcut_actions {
        if Some(shortcut_action.key) != current_key && shortcut_action.shortcut == shortcut {
            SHORTCUT_HANDLING_ENABLED.store(true, Ordering::SeqCst);
            return Err(format!("快捷键 '{}' 已被使用", shortcut_str));
        }
    }

    if let Err(_e) = app.global_shortcut().register(shortcut.clone()) {
        SHORTCUT_HANDLING_ENABLED.store(true, Ordering::SeqCst);
    }

    SHORTCUT_HANDLING_ENABLED.store(true, Ordering::SeqCst);
    Ok(())
}

/// 注册窗口菜单快捷键同步命令
#[tauri::command]
pub fn sync_window_menu_shortcuts(app: tauri::AppHandle) -> Result<(), String> {
	crate::system::menu::sync_window_menu_accelerators(&app);
	Ok(())
}

/// 重新加载所有快捷键配置（从 store 读取）
#[tauri::command]
pub fn reload_all_shortcuts(app: tauri::AppHandle) -> Result<(), String> {
	SHORTCUT_HANDLING_ENABLED.store(false, Ordering::SeqCst);

	let _ = app.global_shortcut().unregister_all();

	let shortcut_actions = load_shortcuts_from_store(&app);

	for shortcut_action in &shortcut_actions {
		let _ = app
			.global_shortcut()
			.register(shortcut_action.shortcut.clone());
	}

	crate::system::menu::sync_window_menu_accelerators(&app);

	SHORTCUT_HANDLING_ENABLED.store(true, Ordering::SeqCst);
	Ok(())
}

/// 获取应用缓存目录
fn get_cache_dir(app_handle: &tauri::AppHandle) -> Result<std::path::PathBuf, String> {
	let app_name = app_handle.package_info().name.clone();
	app_handle
		.path()
		.resolve(&app_name, BaseDirectory::Cache)
		.map_err(|e| format!("无法获取缓存目录: {}", e))
}

/// 清除缓存
#[tauri::command]
pub async fn clear_updater_cache(app_handle: tauri::AppHandle) -> Result<(), String> {
    let cache_path = get_cache_dir(&app_handle)?;

    if cache_path.exists() {
        fs::remove_dir_all(&cache_path).map_err(|e| format!("清除缓存失败: {}", e))?;
    }

    Ok(())
}

/// 获取缓存大小（字节）
#[tauri::command]
pub async fn get_cache_size(app_handle: tauri::AppHandle) -> Result<u64, String> {
    let cache_path = get_cache_dir(&app_handle)?;

    if !cache_path.exists() {
        return Ok(0);
    }

    let size = get_dir_size(&cache_path).map_err(|e| format!("计算缓存大小失败: {}", e))?;
    Ok(size)
}

/// 递归计算目录大小
fn get_dir_size(path: &std::path::Path) -> std::io::Result<u64> {
    let mut size = 0;
    for entry in std::fs::read_dir(path)? {
        let entry = entry?;
        let path = entry.path();
        if path.is_file() {
            size += entry.metadata()?.len();
        } else if path.is_dir() {
            size += get_dir_size(&path)?;
        }
    }
    Ok(size)
}
