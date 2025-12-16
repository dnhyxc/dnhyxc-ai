// 需要在 Cargo.toml 中添加依赖项：rfd = "0.15.0"
use std::fs;
use std::path::Path;
use reqwest;
use tauri;
use std::path::PathBuf;
use tauri::Emitter;

// 导入 types 模块中的类型
use crate::types::{
    SaveFileOptions, 
    SaveFileResult,
    DownloadFileOptions, 
    DownloadFileResult, 
    FileInfo,
    BatchDownloadProgress
};

#[tauri::command]
pub fn greet(name: &str) -> String {
    // 使用 format! 宏将名称嵌入到问候模板中
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[tauri::command]
pub async fn save_file_with_picker(
    options: SaveFileOptions
) -> Result<SaveFileResult, String> {
    // 使用 rfd 进行文件对话框
    let file_dialog = rfd::AsyncFileDialog::new();
    
    // 设置默认文件名
    let file_dialog = if let Some(ref default_name) = options.default_name {
        file_dialog.set_file_name(default_name)
    } else {
        file_dialog
    };
    
    // 添加文件过滤器
    let file_dialog = if let Some(filters) = options.filters {
        filters.iter().fold(file_dialog, |dialog, filter| {
            dialog.add_filter(&filter.name, &filter.extensions)
        })
    } else {
        // 默认添加文本文件过滤器
        file_dialog
            .add_filter("文本文件", &["txt", "md", "json"])
            .add_filter("所有文件", &["*"])
    };
    
    // 显示保存对话框
    let result = file_dialog.save_file().await;
    
    match result {
        Some(file) => {
            let path = file.path();
            println!("保存路径: {:?}", path);
            
            // 保存文件
            match fs::write(path, &options.content) {
                Ok(_) => Ok(SaveFileResult {
                    success: true,
                    file_path: Some(path.to_string_lossy().to_string()),
                    message: "文件保存成功".to_string(),
                }),
                Err(e) => Ok(SaveFileResult {
                    success: false,
                    file_path: None,
                    message: format!("保存失败: {}", e),
                }),
            }
        }
        None => Ok(SaveFileResult {
            success: false,
            file_path: None,
            message: "用户取消了保存".to_string(),
        }),
    }
}

#[tauri::command]
pub async fn download_file(
    window: tauri::Window,  // window 应该是第一个参数
    options: DownloadFileOptions,
) -> Result<DownloadFileResult, String> {
    println!("开始下载文件: {}", options.url);
     // 1. 确定保存路径
    let save_path = match options.save_dir {
        Some(dir) => {
            // 如果提供了保存目录，则构建路径
            let file_name = match options.file_name {
                Some(name) => name,
                None => {
                    // 从 URL 中提取文件名
                    let url_filename = options.url
                        .split('/')
                        .last()
                        .unwrap_or("downloaded_file");
                    
                    // 如果 URL 中没有扩展名，尝试从 Content-Type 推断
                    if !url_filename.contains('.') {
                        // 先获取文件信息
                        match get_remote_file_info(&options.url).await {
                            Ok(info) => {
                                // 根据 Content-Type 添加扩展名
                                if let Some(content_type) = info.content_type {
                                    let extension = get_extension_from_content_type(&content_type);
                                    format!("{}{}", url_filename, extension)
                                } else {
                                    format!("{}.bin", url_filename)
                                }
                            }
                            Err(_) => format!("{}.bin", url_filename),
                        }
                    } else {
                        url_filename.to_string()
                    }
                }
            };
            Path::new(&dir).join(&file_name)
        }
        None => {
            // 1.1 确定默认文件名
            let default_file_name = match options.file_name {
                Some(name) => name,
                None => {
                    // 从 URL 中提取文件名
                    let url_filename = options.url
                        .split('/')
                        .last()
                        .unwrap_or("downloaded_file");
                    
                    // 如果 URL 中没有扩展名，尝试从 Content-Type 推断
                    if !url_filename.contains('.') {
                        // 先获取文件信息（发送 HEAD 请求）
                        match get_remote_file_info(&options.url).await {
                            Ok(info) => {
                                // 根据 Content-Type 添加扩展名
                                if let Some(content_type) = info.content_type {
                                    let extension = get_extension_from_content_type(&content_type);
                                    format!("{}{}", url_filename, extension)
                                } else {
                                    format!("{}.bin", url_filename)
                                }
                            }
                            Err(_) => format!("{}.bin", url_filename),
                        }
                    } else {
                        url_filename.to_string()
                    }
                }
            };
            
            let default_dir = PathBuf::from("/Users/dnhyxc/Documents/dnhyxc-download");
            
            // 1.2 打开文件保存对话框
            let mut file_dialog = rfd::AsyncFileDialog::new()
                .set_title("保存文件")
                .set_directory(default_dir);
            
            // 设置默认文件名
            file_dialog = file_dialog.set_file_name(&default_file_name);
            
            // 添加文件过滤器
            file_dialog = file_dialog
                .add_filter("所有文件", &["*"])
                .add_filter("图片文件", &["jpg", "jpeg", "png", "gif", "webp", "bmp"])
                .add_filter("文档文件", &["pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx"])
                .add_filter("视频文件", &["mp4", "avi", "mkv", "mov", "wmv"])
                .add_filter("音频文件", &["mp3", "wav", "flac", "aac", "ogg"])
                .add_filter("电子书", &["epub"]);
            
            // 显示保存对话框
            let result = file_dialog.save_file().await;
            
            match result {
                Some(file) => {
                    let path = file.path().to_path_buf();
                    println!("用户选择的保存路径: {:?}", path);
                    path
                }
                None => {
                    return Ok(DownloadFileResult {
                        success: false,
                        file_path: None,
                        message: "用户取消了保存".to_string(),
                        file_size: None,
                        content_type: None,
                    });
                }
            }
        }
    };

    let save_path_str = save_path.to_string_lossy().to_string();

    // 2. 检查文件是否已存在
    let overwrite = options.overwrite.unwrap_or(false);
    if save_path.exists() && !overwrite {
        return Ok(DownloadFileResult {
            success: false,
            file_path: Some(save_path_str.clone()),
            message: format!("文件已存在: {}", save_path.display()),
            file_size: None,
            content_type: None,
        });
    }

    // 3. 创建目录（如果不存在）
    if let Some(parent) = save_path.parent() {
        fs::create_dir_all(parent)
            .map_err(|e| format!("创建目录失败: {}", e))?;
    }

    // 4. 检查文件是否已存在
    let overwrite = options.overwrite.unwrap_or(false);
    if save_path.exists() && !overwrite {
        return Ok(DownloadFileResult {
            success: false,
            file_path: Some(save_path_str.clone()),
            message: format!("文件已存在: {}", save_path_str),
            file_size: None,
            content_type: None,
        });
    }

    // 5. 创建目录（如果不存在）
    if let Some(parent) = save_path.parent() {
        fs::create_dir_all(parent)
            .map_err(|e| format!("创建目录失败: {}", e))?;
    }

    // 6. 下载文件
    let client = reqwest::Client::new();
    let response = client
        .get(&options.url)
        .header("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36")
        .send()
        .await
        .map_err(|e| format!("下载请求失败: {}", e))?;

    // 7. 检查响应状态
    if !response.status().is_success() {
        return Ok(DownloadFileResult {
            success: false,
            file_path: None,
            message: format!("下载失败: HTTP状态码 {}", response.status()),
            file_size: None,
            content_type: None,
        });
    }

    // 8. 获取文件信息
    let content_length = response
        .headers()
        .get(reqwest::header::CONTENT_LENGTH)
        .and_then(|value| value.to_str().ok())
        .and_then(|s| s.parse().ok())
        .unwrap_or(0);

    let content_type = response
        .headers()
        .get(reqwest::header::CONTENT_TYPE)
        .and_then(|value| value.to_str().ok())
        .map(|s| s.to_string());

    println!("文件大小: {} 字节, 类型: {:?}", content_length, content_type);

    // 9. 检查文件大小限制（可选，例如限制 100MB）
    const MAX_FILE_SIZE: u64 = 100 * 1024 * 1024; // 100MB
    if content_length > MAX_FILE_SIZE {
        return Ok(DownloadFileResult {
            success: false,
            file_path: None,
            message: format!("文件过大 ({} > {} MB)", 
                content_length / (1024 * 1024), 
                MAX_FILE_SIZE / (1024 * 1024)),
            file_size: Some(content_length),
            content_type,
        });
    }

    // 10. 读取响应内容并写入文件（支持大文件流式写入）
    let mut file = fs::File::create(&save_path)
        .map_err(|e| format!("创建文件失败: {}", e))?;

    let mut stream = response.bytes_stream();
    let mut total_bytes: u64 = 0;
    
    use futures::StreamExt;
    use std::io::Write;
    
    while let Some(chunk) = stream.next().await {
        let chunk = chunk.map_err(|e| format!("读取数据块失败: {}", e))?;
        file.write_all(&chunk)
            .map_err(|e| format!("写入文件失败: {}", e))?;
        total_bytes += chunk.len() as u64;
        
        // 可选：显示下载进度
        if content_length > 0 {
            let percent = (total_bytes * 100) / content_length;
            // println!("下载进度: {}/{} 字节 ({}%)", total_bytes, content_length, percent);
            // 发送开始下载事件
            let progress_data = BatchDownloadProgress {
                current_index: 1,
                total_files: 1,
                url: options.url.clone(),
                total_bytes: total_bytes,
                content_length: content_length,
                percent: percent as f64,
                file_path: save_path_str.clone(),
            };
        
            let _ = window.emit("download://progress", &progress_data);
        }
    }

    // 11. 验证文件大小
    let metadata = fs::metadata(&save_path)
        .map_err(|e| format!("获取文件元数据失败: {}", e))?;

    println!("文件已保存到: {:?}, 大小: {} 字节", save_path, metadata.len());

    Ok(DownloadFileResult {
        success: true,
        file_path: Some(save_path_str.clone()),
        message: "文件下载成功".to_string(),
        file_size: Some(metadata.len()),
        content_type,
    })
}

// 辅助函数：根据 Content-Type 获取文件扩展名
fn get_extension_from_content_type(content_type: &str) -> String {
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
async fn get_remote_file_info(url: &str) -> Result<FileInfo, String> {
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

#[tauri::command]
pub async fn get_file_info(url: String) -> Result<FileInfo, String> {
    println!("获取文件信息: {}", url);
    get_remote_file_info(&url).await
}

// 批量下载文件
#[tauri::command]
pub async fn download_files(
    window: tauri::Window,
    files: Vec<DownloadFileOptions>,
) -> Result<Vec<DownloadFileResult>, String> {
    let mut results = Vec::new();
    let total_files = files.len();
    
    // 改为使用 into_iter() 来获取所有权，而不是引用
    for (index, mut file_options) in files.into_iter().enumerate() {
        // 为每个文件生成唯一ID（如果未提供）
        if file_options.id.is_none() {
            let timestamp = std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .map(|d| d.as_millis())
                .unwrap_or(0);
            file_options.id = Some(format!("batch_{}_{}", index, timestamp));
        }
        
        // 发送开始下载事件
        let progress_data = BatchDownloadProgress {
            current_index: index + 1,
            total_files,
            url: file_options.url.clone(),
            total_bytes: 0,
            content_length: 0,
            percent: 0.0,
            file_path: String::new(),
        };
        
        let _ = window.emit("download://progress", &progress_data);
        
        // 克隆 window 以便在每个下载任务中使用
        let window_clone = window.clone();
        let result = download_file(window_clone, file_options).await;
        results.push(result.unwrap_or_else(|e| DownloadFileResult {
            success: false,
            file_path: None,
            message: e,
            file_size: None,
            content_type: None,
        }));
    }
    
    Ok(results)
}