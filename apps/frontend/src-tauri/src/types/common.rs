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
    pub success: String,
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
    pub id: Option<String>,      // 用于批处理下载的唯一标识符
    pub max_size: Option<u64>,   // 最大支持的文件大小
}

// 通用下载blob文件选项
#[derive(Deserialize, Clone)]
pub struct DownloadZipOptions {
    pub file_name: String,
    pub save_dir: Option<String>,
    pub overwrite: Option<bool>, // 是否覆盖已存在的文件
    pub id: Option<String>,      // 用于批处理下载的唯一标识符
}

// 通用下载文件结果
#[derive(Serialize, Clone)]
pub struct DownloadFileResult {
    pub success: String,
    pub file_path: Option<String>,
    pub file_name: String,
    pub message: String,
    pub file_size: Option<u64>,
    pub content_type: Option<String>,
    pub id: Option<String>,
}

// 文件信息
#[derive(Serialize, Clone)]
pub struct FileInfo {
    pub file_name: String,
    pub file_size: u64,
    pub content_type: Option<String>,
    pub is_downloadable: bool,
}

#[derive(Serialize)]
pub struct BatchDownloadProgress {
    /// 当前正在下载的是第几个文件（从 0 开始计数）
    pub current_index: usize,
    /// 本次批量下载任务中总共需要下载的文件数量
    pub total_files: usize,
    /// 当前下载文件的远程 URL 地址
    pub url: String,
    /// 已下载完成的字节数（随着下载进度实时累加）
    pub total_bytes: u64,
    /// 服务器返回的 Content-Length，即可预期的文件总大小（单位：字节）
    pub content_length: u64,
    /// 当前下载进度百分比，计算方式：total_bytes / content_length * 100.0
    pub percent: f64,
    /// 当前下载文件的完整保存路径（包含文件名）
    pub file_path: String,
    /// 当前下载文件的文件名（不包含路径）
    pub file_name: String,
    pub file_size: Option<u64>,
    /// 可选的下载任务唯一标识符。
    /// 当批量下载需要区分不同子任务或做回调匹配时，可传入此字段；
    /// 若无特殊需求，可留空（None）。
    pub id: Option<String>,
    pub success: String,
    pub message: String,
}

#[derive(Serialize)]
pub struct FileInfoEvent {
    pub file_name: Option<String>,
    pub file_size: Option<u64>,
    pub content_type: Option<String>,
    pub id: Option<String>,
    pub success: String,
    pub message: String,
}
