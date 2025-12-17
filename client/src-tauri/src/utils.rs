use reqwest;
use crate::types::FileInfo;

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
    }.to_string()
}

// 辅助函数：获取远程文件信息
pub async fn get_remote_file_info(url: &str) -> Result<FileInfo, String> {
    let client = reqwest::Client::new();
    let response = client
        .head(url)
        .header("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36")
        .send()
        .await
        .map_err(|e| format!("获取文件信息失败: {}", e))?;

    if !response.status().is_success() {
        return Err(format!("HTTP状态码 {}", response.status()));
    }

    // 获取文件名
    let file_name = url
        .split('/')
        .last()
        .unwrap_or("unknown_file")
        .to_string();

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