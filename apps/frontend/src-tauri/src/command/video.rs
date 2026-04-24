use rfd::FileDialog;
use serde::Serialize;
use std::fs;
use std::path::PathBuf;
use std::process::Command;
use tauri::path::BaseDirectory;
use tauri::Manager;

#[derive(Debug, Serialize)]
pub struct MediaStreamInfo {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub index: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub codec_type: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub codec_name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub width: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub height: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub r_frame_rate: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub sample_rate: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub channels: Option<i64>,
}

#[derive(Debug, Serialize)]
pub struct MediaFormatInfo {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub filename: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub duration: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub size: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub format_name: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct ProbeMediaOutput {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub format: Option<MediaFormatInfo>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub streams: Option<Vec<MediaStreamInfo>>,
}

fn get_media_cache_dir(app_handle: &tauri::AppHandle) -> Result<PathBuf, String> {
    let app_name = app_handle.package_info().name.clone();
    let base = app_handle
        .path()
        .resolve(&app_name, BaseDirectory::Cache)
        .map_err(|e| format!("无法获取缓存目录: {}", e))?;
    Ok(base.join("media"))
}

/// 选择媒体文件（多选）
#[tauri::command]
pub async fn select_media_files() -> Result<Vec<String>, String> {
    let dialog = FileDialog::new().add_filter("媒体文件", &[
        "mp4", "mov", "mkv", "webm", "avi", "mp3", "wav", "m4a", "aac", "flac", "png", "jpg",
        "jpeg", "gif",
    ]);
    match dialog.pick_files() {
        Some(paths) => Ok(paths
            .into_iter()
            .map(|p| p.to_string_lossy().to_string())
            .collect()),
        None => Ok(vec![]),
    }
}

/// 将媒体文件 stage 到应用缓存目录，便于前端通过 asset protocol 播放（避免直接读任意路径导致 500）。
///
/// 返回 stage 后的绝对路径（位于 BaseDirectory::Cache/<appName>/media）。
#[tauri::command]
pub async fn stage_media_for_playback(
    app_handle: tauri::AppHandle,
    path: String,
) -> Result<String, String> {
    let src = path.trim();
    if src.is_empty() {
        return Err("path 不能为空".to_string());
    }
    let meta = fs::metadata(src).map_err(|e| format!("读取文件失败: {}", e))?;
    if !meta.is_file() {
        return Err("目标不是文件".to_string());
    }

    let dir = get_media_cache_dir(&app_handle)?;
    fs::create_dir_all(&dir).map_err(|e| format!("创建缓存目录失败: {}", e))?;

    let file_name = PathBuf::from(src)
        .file_name()
        .and_then(|s| s.to_str())
        .unwrap_or("media.bin")
        .to_string();

    // 以 mtime+size 做简单去冲突：同名不同内容时避免覆盖
    let mtime = meta.modified().ok();
    let mtime_ms = mtime
        .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
        .map(|d| d.as_millis())
        .unwrap_or(0);
    let size = meta.len();

    let stem = file_name
        .rsplit_once('.')
        .map(|(a, _)| a)
        .unwrap_or(&file_name);
    let ext = file_name
        .rsplit_once('.')
        .map(|(_, b)| format!(".{}", b))
        .unwrap_or_else(|| "".to_string());

    let staged = dir.join(format!("{}__{}__{}{}", stem, mtime_ms, size, ext));
    if staged.exists() {
        return Ok(staged.to_string_lossy().to_string());
    }

    // 优先 hard link（同盘快），失败再 copy
    if fs::hard_link(src, &staged).is_err() {
        fs::copy(src, &staged).map_err(|e| format!("复制到缓存失败: {}", e))?;
    }

    Ok(staged.to_string_lossy().to_string())
}

/// 通过 ffprobe 读取媒体元数据（最小字段）
#[tauri::command]
pub async fn probe_media(path: String) -> Result<ProbeMediaOutput, String> {
    let p = path.trim();
    if p.is_empty() {
        return Err("path 不能为空".to_string());
    }

    let output = Command::new("ffprobe")
        .args([
            "-v",
            "error",
            "-print_format",
            "json",
            "-show_format",
            "-show_streams",
            p,
        ])
        .output()
        .map_err(|e| format!("执行 ffprobe 失败：{}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        let tail: String = stderr.chars().rev().take(2000).collect::<String>().chars().rev().collect();
        return Err(format!("ffprobe 返回失败（{}）：{}", output.status, tail));
    }

    let raw = String::from_utf8_lossy(&output.stdout);
    let v: serde_json::Value =
        serde_json::from_str(&raw).map_err(|e| format!("解析 ffprobe 输出失败：{}", e))?;

    let format = v.get("format").and_then(|f| {
        Some(MediaFormatInfo {
            filename: f.get("filename").and_then(|x| x.as_str()).map(|s| s.to_string()),
            duration: f.get("duration").and_then(|x| x.as_str()).map(|s| s.to_string()),
            size: f.get("size").and_then(|x| x.as_str()).map(|s| s.to_string()),
            format_name: f.get("format_name").and_then(|x| x.as_str()).map(|s| s.to_string()),
        })
    });

    let streams = v.get("streams").and_then(|s| s.as_array()).map(|arr| {
        arr.iter()
            .map(|st| MediaStreamInfo {
                index: st.get("index").and_then(|x| x.as_i64()),
                codec_type: st
                    .get("codec_type")
                    .and_then(|x| x.as_str())
                    .map(|s| s.to_string()),
                codec_name: st
                    .get("codec_name")
                    .and_then(|x| x.as_str())
                    .map(|s| s.to_string()),
                width: st.get("width").and_then(|x| x.as_i64()),
                height: st.get("height").and_then(|x| x.as_i64()),
                r_frame_rate: st
                    .get("r_frame_rate")
                    .and_then(|x| x.as_str())
                    .map(|s| s.to_string()),
                sample_rate: st
                    .get("sample_rate")
                    .and_then(|x| x.as_str())
                    .map(|s| s.to_string()),
                channels: st.get("channels").and_then(|x| x.as_i64()),
            })
            .collect::<Vec<_>>()
    });

    Ok(ProbeMediaOutput { format, streams })
}

