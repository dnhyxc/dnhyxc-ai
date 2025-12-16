use serde::{Deserialize, Serialize};

// 定义前端传入的参数结构
#[derive(Deserialize, Clone)]
pub struct SaveFileOptions {
    pub default_name: Option<String>,
    pub content: String,
    pub filters: Option<Vec<FileFilter>>,
}

// 定义文件过滤器结构
#[derive(Deserialize, Clone)]
pub struct FileFilter {
    pub name: String,
    pub extensions: Vec<String>,
}

// 定义返回给前端的结果结构
#[derive(Serialize)]
pub struct SaveFileResult {
    pub success: bool,
    pub file_path: Option<String>,
    pub message: String,
}

// 通用下载文件选项
#[derive(Deserialize, Clone)]
pub struct DownloadFileOptions {
    pub url: String,
    pub file_name: Option<String>,
    pub save_dir: Option<String>,
    pub overwrite: Option<bool>, // 是否覆盖已存在的文件
}

// 通用下载文件结果
#[derive(Serialize, Clone)]
pub struct DownloadFileResult {
    pub success: bool,
    pub file_path: Option<String>,
    pub message: String,
    pub file_size: Option<u64>,
    pub content_type: Option<String>,
}

// 文件信息
#[derive(Serialize, Clone)]
pub struct FileInfo {
    pub file_name: String,
    pub file_size: u64,
    pub content_type: Option<String>,
    pub is_downloadable: bool,
}
