use reqwest;
use std::path::Path;
use std::path::PathBuf;
use tauri;

use crate::types::common::{DownloadZipOptions, FileInfo};

// 设置窗口居中
pub fn set_screen_center<R: tauri::Runtime>(window: &tauri::WebviewWindow<R>) {
    // let window = app.get_webview_window("main").unwrap();
    if let Ok(Some(monitor)) = window.current_monitor() {
        let size = monitor.size();
        let physical_size = window.outer_size().unwrap_or_default();
        let x = (size.width - physical_size.width) / 2;
        let y = (size.height - physical_size.height) / 2;
        let _ = window.set_position(tauri::Position::Physical(tauri::PhysicalPosition {
            x: x.try_into().unwrap_or(0),
            y: y.try_into().unwrap_or(0),
        }));
    }
}

// 辅助函数：根据 Content-Type 获取文件扩展名
pub fn get_extension_from_content_type(content_type: &str) -> String {
    match content_type {
        "application/pdf" => ".pdf",
        "image/jpeg" | "image/jpg" => ".jpg",
        "image/png" => ".png",
        "image/gif" => ".gif",
        "image/webp" => ".webp",
        "application/zip" => ".zip",
        "application/x-rar-compressed" => ".rar",
        "application/x-7z-compressed" => ".7z",
        "application/x-tar" => ".tar",
        "application/gzip" => ".gz",
        "application/x-bzip2" => ".bz2",
        "text/plain" => ".txt",
        "text/html" => ".html",
        "text/css" => ".css",
        "text/javascript" => ".js",
        "application/json" => ".json",
        "application/xml" => ".xml",
        "video/mp4" => ".mp4",
        "video/mpeg" => ".mpeg",
        "video/quicktime" => ".mov",
        "video/x-msvideo" => ".avi",
        "audio/mpeg" => ".mp3",
        "audio/wav" => ".wav",
        "audio/ogg" => ".ogg",
        "application/msword" => ".doc",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document" => ".docx",
        "application/vnd.ms-excel" => ".xls",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" => ".xlsx",
        "application/vnd.ms-powerpoint" => ".ppt",
        "application/vnd.openxmlformats-officedocument.presentationml.presentation" => ".pptx",
        "application/epub+zip" => ".epub",
        _ => ".bin", // 默认二进制文件
    }
    .to_string()
}

// 辅助函数：获取远程文件信息
pub async fn get_remote_file_info(url: &str) -> Result<FileInfo, String> {
    let client = reqwest::Client::new();
    let response = client
        .head(url)
        .header(
            "User-Agent",
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        )
        .send()
        .await
        .map_err(|e| format!("获取文件信息失败: {}", e))?;

    if !response.status().is_success() {
        return Err(format!("HTTP状态码 {}", response.status()));
    }

    // 获取文件名
    let file_name = url.split('/').last().unwrap_or("unknown_file").to_string();

    // 获取文件大小
    let file_size = response
        .headers()
        .get(reqwest::header::CONTENT_LENGTH)
        .and_then(|value| value.to_str().ok())
        .and_then(|s| s.parse().ok())
        .unwrap_or(0);

    // 获取内容类型
    let content_type = response
        .headers()
        .get(reqwest::header::CONTENT_TYPE)
        .and_then(|value| value.to_str().ok())
        .map(|s| s.to_string());

    Ok(FileInfo {
        file_name,
        file_size,
        content_type: content_type.clone(),
        is_downloadable: response.status().is_success(),
    })
}

/// 为 blob 数据确定保存路径
pub async fn determine_save_path_for_blob(options: &DownloadZipOptions) -> Result<PathBuf, String> {
    // 确定文件名
    let file_name = options.file_name.clone();

    // 确定保存路径
    let save_path = match &options.save_dir {
        Some(dir) => Path::new(dir).join(&file_name),
        None => {
            let default_dir = PathBuf::from("/Users/dnhyxc/Documents/dnhyxc-download");

            let file_dialog = rfd::AsyncFileDialog::new()
                .set_title("保存文件")
                .set_directory(default_dir)
                .set_file_name(&file_name);

            match file_dialog.save_file().await {
                Some(file) => {
                    let path = file.path().to_path_buf();
                    println!("用户选择的保存路径: {:?}", path);
                    path
                }
                None => {
                    return Err("用户取消了保存".to_string());
                }
            }
        }
    };

    Ok(save_path)
}
