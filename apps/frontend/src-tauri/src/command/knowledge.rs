use std::env;
use std::fs;
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

use serde::Deserialize;
use tauri::AppHandle;

use crate::types::common::SaveFileResult;
use crate::utils::common::default_save_base_dir;

fn sanitize_filename(title: &str) -> String {
	let base = if title.trim().is_empty() {
		let ms = SystemTime::now()
			.duration_since(UNIX_EPOCH)
			.map(|d| d.as_millis())
			.unwrap_or(0);
		format!("未命名-{}", ms)
	} else {
		title.trim().to_string()
	};
	let safe: String = base
		.chars()
		.map(|c| match c {
			'/' | '\\' | '?' | '%' | '*' | ':' | '|' | '"' | '<' | '>' => '-',
			c if c.is_whitespace() => '_',
			c => c,
		})
		.collect();
	let trimmed: String = safe.chars().take(120).collect();
	format!("{}.md", trimmed)
}

fn is_md_file_path(p: &Path) -> bool {
	p.extension()
		.and_then(|s| s.to_str())
		.map(|e| e.eq_ignore_ascii_case("md"))
		.unwrap_or(false)
}

/// `file_path` 可为「完整 .md 文件路径」或「目录」（与前端语义一致：传文件夹则在其下生成标题.md）
fn resolve_write_path_from_file_path_arg(raw: &str, title: &str) -> Result<PathBuf, String> {
	let trimmed = raw.trim();
	if trimmed.is_empty() {
		return Err("filePath 不能为空".to_string());
	}
	let path = PathBuf::from(trimmed);

	if path.exists() {
		let meta = fs::metadata(&path).map_err(|e| e.to_string())?;
		if meta.is_dir() {
			return Ok(path.join(sanitize_filename(title)));
		}
		return Ok(path);
	}

	if trimmed.ends_with('/') || trimmed.ends_with('\\') {
		let base = trimmed.trim_end_matches(|c| c == '/' || c == '\\');
		return Ok(PathBuf::from(base).join(sanitize_filename(title)));
	}

	if is_md_file_path(&path) {
		return Ok(path);
	}

	Ok(path.join(sanitize_filename(title)))
}

/// 与前端 `invoke` 同一对象：`filePath` / `dirPath`（camelCase）→ Rust 字段
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveKnowledgeMarkdownInput {
	pub title: String,
	pub content: String,
	#[serde(default)]
	pub file_path: Option<String>,
	#[serde(default)]
	pub dir_path: Option<String>,
}

/// 未传 `file_path`/`dir_path` 时的目录：`KNOWLEDGE_DIR` 环境变量，否则为「savePath + knowledge 子目录」
async fn resolve_knowledge_dir(app: &AppHandle) -> Result<PathBuf, String> {
	if let Ok(dir) = env::var("KNOWLEDGE_DIR") {
		let p = PathBuf::from(dir.trim());
		if !p.as_os_str().is_empty() {
			return Ok(p);
		}
	}
	let base = default_save_base_dir(app).await;
	Ok(base.join("knowledge"))
}

/// 将 Markdown 写入本地。前端：`invoke('save_knowledge_markdown', { input: { title, content, filePath?, dirPath? } })`
#[tauri::command]
pub async fn save_knowledge_markdown(
	app: AppHandle,
	input: SaveKnowledgeMarkdownInput,
) -> Result<SaveFileResult, String> {
	let title = &input.title;
	let path = if let Some(ref fp) = input.file_path {
		resolve_write_path_from_file_path_arg(fp, title)?
	} else if let Some(ref dp) = input.dir_path {
		let dir = PathBuf::from(dp.trim());
		if dir.as_os_str().is_empty() {
			return Err("dirPath 不能为空".to_string());
		}
		dir.join(sanitize_filename(title))
	} else {
		let dir = resolve_knowledge_dir(&app).await?;
		dir.join(sanitize_filename(title))
	};

	if let Some(parent) = path.parent() {
		fs::create_dir_all(parent).map_err(|e| e.to_string())?;
	}
	fs::write(&path, input.content.as_bytes()).map_err(|e| e.to_string())?;
	Ok(SaveFileResult {
		success: "success".to_string(),
		file_path: Some(path.to_string_lossy().to_string()),
		message: format!("已保存至 {}", path.display()),
	})
}
