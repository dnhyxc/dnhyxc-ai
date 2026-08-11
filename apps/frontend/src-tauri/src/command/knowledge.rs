use std::env;
use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::time::{SystemTime, UNIX_EPOCH};

use serde::{Deserialize, Serialize};
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
	/// 为 true 时允许覆盖已存在的同名文件
	#[serde(default)]
	pub overwrite: bool,
	/// 编辑已有条目且标题已改时传入：与 `title` 对应的原磁盘文件名，用于重命名旧 .md，避免产生重复文件
	#[serde(default)]
	pub previous_title: Option<String>,
}

/// 删除知识 Markdown：与保存相同的 `filePath`/`dirPath` + `title` 解析目标文件
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DeleteKnowledgeMarkdownInput {
	pub title: String,
	#[serde(default)]
	pub file_path: Option<String>,
	#[serde(default)]
	pub dir_path: Option<String>,
}

/// 解析后的保存目标路径（`content` / `overwrite` 不参与计算）
async fn compute_save_target_path(
	app: &AppHandle,
	input: &SaveKnowledgeMarkdownInput,
) -> Result<PathBuf, String> {
	let title = &input.title;
	if let Some(ref fp) = input.file_path {
		resolve_write_path_from_file_path_arg(fp, title)
	} else if let Some(ref dp) = input.dir_path {
		let dir = PathBuf::from(dp.trim());
		if dir.as_os_str().is_empty() {
			return Err("dirPath 不能为空".to_string());
		}
		Ok(dir.join(sanitize_filename(title)))
	} else {
		let dir = resolve_knowledge_dir(app).await?;
		Ok(dir.join(sanitize_filename(title)))
	}
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

/// 查询即将写入的完整路径及是否已存在同名文件（供前端二次确认）
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct KnowledgeMarkdownTarget {
	pub path: String,
	pub exists: bool,
}

#[tauri::command]
pub async fn resolve_knowledge_markdown_target(
	app: AppHandle,
	input: SaveKnowledgeMarkdownInput,
) -> Result<KnowledgeMarkdownTarget, String> {
	let path = compute_save_target_path(&app, &input).await?;
	let exists = path.exists()
		&& fs::metadata(&path)
			.map(|m| m.is_file())
			.unwrap_or(false);
	Ok(KnowledgeMarkdownTarget {
		path: path.to_string_lossy().to_string(),
		exists,
	})
}

/// 将 Markdown 写入本地。覆盖已存在文件须 `overwrite: true`
#[tauri::command]
pub async fn save_knowledge_markdown(
	app: AppHandle,
	input: SaveKnowledgeMarkdownInput,
) -> Result<SaveFileResult, String> {
	let path = compute_save_target_path(&app, &input).await?;

	let mut renamed_from_previous = false;
	if let Some(ref prev_raw) = input.previous_title {
		let prev = prev_raw.trim();
		let cur = input.title.trim();
		if !prev.is_empty() && prev != cur {
			let old_input = SaveKnowledgeMarkdownInput {
				title: prev_raw.clone(),
				content: String::new(),
				file_path: input.file_path.clone(),
				dir_path: input.dir_path.clone(),
				overwrite: false,
				previous_title: None,
			};
			let old_path = compute_save_target_path(&app, &old_input).await?;
			if old_path != path && old_path.exists() {
				let meta = fs::metadata(&old_path).map_err(|e| e.to_string())?;
				if !meta.is_file() {
					return Err("原知识文件路径不是普通文件".to_string());
				}
				if path.exists() {
					let pmeta = fs::metadata(&path).map_err(|e| e.to_string())?;
					if !pmeta.is_file() {
						return Err("目标路径已存在且非文件".to_string());
					}
					if !input.overwrite {
						return Err(format!(
							"文件已存在：{}",
							path.to_string_lossy()
						));
					}
					fs::remove_file(&old_path).map_err(|e| e.to_string())?;
				} else {
					fs::rename(&old_path, &path).map_err(|e| e.to_string())?;
					renamed_from_previous = true;
				}
			}
		}
	}

	if path.exists() {
		let meta = fs::metadata(&path).map_err(|e| e.to_string())?;
		if meta.is_file() && !input.overwrite && !renamed_from_previous {
			return Err(format!(
				"文件已存在：{}",
				path.to_string_lossy()
			));
		}
	}

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

/// 按与保存一致的路径规则删除本地 Markdown 文件
#[tauri::command]
pub async fn delete_knowledge_markdown(
	app: AppHandle,
	input: DeleteKnowledgeMarkdownInput,
) -> Result<SaveFileResult, String> {
	let save_like = SaveKnowledgeMarkdownInput {
		title: input.title,
		content: String::new(),
		file_path: input.file_path,
		dir_path: input.dir_path,
		overwrite: false,
		previous_title: None,
	};
	let path = compute_save_target_path(&app, &save_like).await?;

	if !path.exists() {
		return Err(format!("文件不存在：{}", path.display()));
	}
	let meta = fs::metadata(&path).map_err(|e| e.to_string())?;
	if !meta.is_file() {
		return Err("目标不是可删除的文件".to_string());
	}
	if !is_md_file_path(&path) {
		return Err("仅允许删除 .md 文件".to_string());
	}

	fs::remove_file(&path).map_err(|e| e.to_string())?;
	Ok(SaveFileResult {
		success: "success".to_string(),
		file_path: Some(path.to_string_lossy().to_string()),
		message: format!("已删除 {}", path.display()),
	})
}

/// 递归收集目录下（含子目录）的 `.md` 文件路径
fn collect_md_files(dir: &Path, out: &mut Vec<PathBuf>) -> Result<(), String> {
	let rd = fs::read_dir(dir).map_err(|e| e.to_string())?;
	for ent in rd {
		let ent = ent.map_err(|e| e.to_string())?;
		let name = ent.file_name();
		if name.to_string_lossy().starts_with('.') {
			continue;
		}
		let p = ent.path();
		let meta = ent.metadata().map_err(|e| e.to_string())?;
		if meta.is_dir() {
			collect_md_files(&p, out)?;
		} else if meta.is_file() && is_md_file_path(&p) {
			out.push(p);
		}
	}
	Ok(())
}

/// 列出指定目录（或默认知识库目录）下所有 Markdown 文件
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListKnowledgeMarkdownInput {
	#[serde(default)]
	pub dir_path: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct KnowledgeMarkdownFileEntry {
	pub path: String,
	pub title: String,
	pub updated_at_ms: u64,
}

#[tauri::command]
pub async fn list_knowledge_markdown_files(
	app: AppHandle,
	input: ListKnowledgeMarkdownInput,
) -> Result<Vec<KnowledgeMarkdownFileEntry>, String> {
	let dir = match input.dir_path.as_ref().map(|s| s.trim()).filter(|s| !s.is_empty()) {
		Some(d) => PathBuf::from(d),
		None => resolve_knowledge_dir(&app).await?,
	};
	if !dir.exists() {
		return Err(format!("目录不存在：{}", dir.display()));
	}
	let meta = fs::metadata(&dir).map_err(|e| e.to_string())?;
	if !meta.is_dir() {
		return Err("路径不是目录".to_string());
	}
	let mut paths: Vec<PathBuf> = Vec::new();
	collect_md_files(&dir, &mut paths)?;
	paths.sort_by(|a, b| {
		let ta = fs::metadata(a).and_then(|m| m.modified()).ok();
		let tb = fs::metadata(b).and_then(|m| m.modified()).ok();
		tb.cmp(&ta)
	});
	let mut out = Vec::with_capacity(paths.len());
	for p in paths {
		let title = p
			.file_stem()
			.and_then(|s| s.to_str())
			.unwrap_or("未命名")
			.to_string();
		let updated_at_ms = fs::metadata(&p)
			.ok()
			.and_then(|m| m.modified().ok())
			.and_then(|t| t.duration_since(UNIX_EPOCH).ok())
			.map(|d| d.as_millis() as u64)
			.unwrap_or(0);
		out.push(KnowledgeMarkdownFileEntry {
			path: p.to_string_lossy().to_string(),
			title,
			updated_at_ms,
		});
	}
	Ok(out)
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReadKnowledgeMarkdownFileInput {
	pub file_path: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ReadKnowledgeMarkdownFileResult {
	pub content: String,
}

/// 读取单个 `.md` 文件正文（UTF-8）
#[tauri::command]
pub fn read_knowledge_markdown_file(
	input: ReadKnowledgeMarkdownFileInput,
) -> Result<ReadKnowledgeMarkdownFileResult, String> {
	let trimmed = input.file_path.trim();
	if trimmed.is_empty() {
		return Err("filePath 不能为空".to_string());
	}
	let p = PathBuf::from(trimmed);
	if !p.exists() || !p.is_file() {
		return Err("文件不存在或不是普通文件".to_string());
	}
	if !is_md_file_path(&p) {
		return Err("仅允许读取 .md 文件".to_string());
	}
	let content = fs::read_to_string(&p).map_err(|e| e.to_string())?;
	Ok(ReadKnowledgeMarkdownFileResult { content })
}

// —— 本地 .md 用 Cursor / Trae（用户所称 tare）打开 ——

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum DetectedMarkdownEditor {
	Cursor,
	Trae,
}

#[cfg(target_os = "macos")]
fn frontmost_application_name() -> Option<String> {
	let script =
		r#"tell application "System Events" to get name of first application process whose frontmost is true"#;
	let output = Command::new("osascript").args(["-e", script]).output().ok()?;
	if !output.status.success() {
		return None;
	}
	let s = String::from_utf8(output.stdout).ok()?;
	let t = s.trim();
	if t.is_empty() {
		None
	} else {
		Some(t.to_string())
	}
}

/// Windows：前台窗口所属进程名（小写），失败则 None
#[cfg(target_os = "windows")]
fn frontmost_application_name() -> Option<String> {
	let ps = concat!(
		"$pid = [uint32]0; ",
		"Add-Type -MemberDefinition '[DllImport(\"user32.dll\")]public static extern System.IntPtr GetForegroundWindow();",
		"[DllImport(\"user32.dll\")]public static extern uint GetWindowThreadProcessId(System.IntPtr h,out uint p);' ",
		"-Name U -Namespace W; ",
		"[void][W.U]::GetWindowThreadProcessId([W.U]::GetForegroundWindow(),[ref]$pid); ",
		"(Get-Process -Id $pid -ErrorAction SilentlyContinue).ProcessName",
	);
	let output = Command::new("powershell")
		.args(["-NoProfile", "-STA", "-Command", ps])
		.output()
		.ok()?;
	if !output.status.success() {
		return None;
	}
	let s = String::from_utf8(output.stdout).ok()?;
	let t = s.trim().to_lowercase();
	if t.is_empty() {
		None
	} else {
		Some(t)
	}
}

#[cfg(all(unix, not(target_os = "macos")))]
fn frontmost_application_name() -> Option<String> {
	None
}

/// 子进程退出码 0 视为成功（如 pgrep 找到进程）
fn command_exit_zero(program: &str, args: &[&str]) -> bool {
	Command::new(program)
		.args(args)
		.status()
		.ok()
		.is_some_and(|s| s.success())
}

/// macOS：用「系统事件」进程名 + `ps` 命令行（含 Cursor.app）+ `pgrep` 多重判定；Electron 常只有 Helper 进程带完整路径，`pgrep -x Cursor` 易漏检
#[cfg(target_os = "macos")]
fn is_cursor_running_applescript() -> bool {
	let Some(out) = Command::new("/usr/bin/osascript")
		.args([
			"-e",
			r#"tell application "System Events""#,
			"-e",
			r#"repeat with procName in (name of every process)"#,
			"-e",
			r#"set t to procName as string"#,
			"-e",
			r#"if t contains "Cursor" then return true"#,
			"-e",
			r#"end repeat"#,
			"-e",
			r#"end tell"#,
			"-e",
			r#"return false"#,
		])
		.output()
		.ok()
	else {
		return false;
	};
	if !out.status.success() {
		return false;
	}
	String::from_utf8_lossy(&out.stdout)
		.trim()
		.eq_ignore_ascii_case("true")
}

#[cfg(target_os = "macos")]
fn is_cursor_running_ps() -> bool {
	let Ok(output) = Command::new("/bin/ps")
		.args(["-ax", "-o", "command="])
		.output()
	else {
		return false;
	};
	String::from_utf8_lossy(&output.stdout).lines().any(|line| {
		// 典型：.../Cursor.app/...；无路径时仍有 Electron Helper 进程名
		line.contains("Cursor.app/")
			|| line.contains("Cursor Helper")
			|| line.contains("MacOS/Cursor")
	})
}

#[cfg(target_os = "macos")]
fn is_cursor_running() -> bool {
	is_cursor_running_applescript()
		|| is_cursor_running_ps()
		|| command_exit_zero("/usr/bin/pgrep", &["-x", "Cursor"])
		|| command_exit_zero("/usr/bin/pgrep", &["-f", "Cursor.app"])
		|| command_exit_zero("/usr/bin/pgrep", &["-x", "cursor"])
}

/// Cursor 稳定版常见 Bundle ID（Todesktop 分发）；若变更可再补 `open -a Cursor`
#[cfg(target_os = "macos")]
const CURSOR_MACOS_BUNDLE_ID: &str = "com.todesktop.230313mzl4w4u92";

/// macOS：优先按 Bundle ID 打开，再 `open -a Cursor`，再尝试 PATH 中的 `cursor` CLI
#[cfg(target_os = "macos")]
fn spawn_open_cursor_macos(path: &Path) -> Result<(), String> {
	let path_str = path.to_str().ok_or("路径包含无效字符")?;
	if Command::new("/usr/bin/open")
		.args(["-b", CURSOR_MACOS_BUNDLE_ID, "--", path_str])
		.status()
		.map(|s| s.success())
		.unwrap_or(false)
	{
		return Ok(());
	}
	if spawn_open_editor("Cursor", path).is_ok() {
		return Ok(());
	}
	Command::new("cursor")
		.arg(path_str)
		.spawn()
		.map_err(|e| format!("无法用 Cursor 打开文件: {e}"))?;
	Ok(())
}

#[cfg(target_os = "windows")]
fn is_cursor_running() -> bool {
	let Ok(output) = Command::new("tasklist").args(["/FO", "CSV", "/NH"]).output() else {
		return false;
	};
	String::from_utf8_lossy(&output.stdout)
		.to_lowercase()
		.contains("cursor.exe")
}

#[cfg(all(unix, not(target_os = "macos")))]
fn is_cursor_running() -> bool {
	command_exit_zero("pgrep", &["-x", "cursor"])
		|| command_exit_zero("pgrep", &["-f", "/Cursor.app/"])
		|| command_exit_zero("pgrep", &["-f", "cursor"])
}

#[cfg(target_os = "macos")]
fn is_trae_running() -> bool {
	for name in ["Trae", "Trae CN"] {
		if command_exit_zero("/usr/bin/pgrep", &["-x", name]) {
			return true;
		}
	}
	command_exit_zero("/usr/bin/pgrep", &["-f", "Trae.app"])
}

#[cfg(target_os = "windows")]
fn is_trae_running() -> bool {
	let Ok(output) = Command::new("tasklist").args(["/FO", "CSV", "/NH"]).output() else {
		return false;
	};
	let lower = String::from_utf8_lossy(&output.stdout).to_lowercase();
	lower.contains("trae.exe")
}

#[cfg(all(unix, not(target_os = "macos")))]
fn is_trae_running() -> bool {
	command_exit_zero("pgrep", &["-x", "trae"]) || command_exit_zero("pgrep", &["-f", "trae"])
}

/// 1) 前台为 Cursor → Cursor；2) 前台为 Trae → Trae；3) 否则看谁已在运行（**优先 Cursor**，解决本应用前台时误走 Trae）；4) 都未运行则默认 Trae
fn detect_markdown_editor() -> DetectedMarkdownEditor {
	if let Some(name) = frontmost_application_name() {
		let lower = name.to_lowercase();
		if lower.contains("cursor") {
			return DetectedMarkdownEditor::Cursor;
		}
		if lower.contains("trae") {
			return DetectedMarkdownEditor::Trae;
		}
	}
	if is_cursor_running() {
		return DetectedMarkdownEditor::Cursor;
	}
	if is_trae_running() {
		return DetectedMarkdownEditor::Trae;
	}
	// 进程检测失败时（如未授权自动化 System Events）：按是否安装 Cursor.app / Trae.app 兜底
	#[cfg(target_os = "macos")]
	if let Some(kind) = detect_editor_by_cursor_trae_installed() {
		return kind;
	}
	DetectedMarkdownEditor::Trae
}

#[cfg(target_os = "macos")]
fn macos_app_bundle_present(name: &str) -> bool {
	let home = env::var("HOME").unwrap_or_default();
	[
		format!("/Applications/{name}.app"),
		format!("{home}/Applications/{name}.app"),
	]
	.iter()
	.any(|p| Path::new(p).is_dir())
}

/// 仅当能明确判断「只装了其一」或「两者都装了」时用；双装优先 Cursor
#[cfg(target_os = "macos")]
fn detect_editor_by_cursor_trae_installed() -> Option<DetectedMarkdownEditor> {
	let cursor = macos_app_bundle_present("Cursor");
	let trae = macos_app_bundle_present("Trae") || macos_app_bundle_present("Trae CN");
	match (cursor, trae) {
		(true, false) => Some(DetectedMarkdownEditor::Cursor),
		(false, true) => Some(DetectedMarkdownEditor::Trae),
		(true, true) => Some(DetectedMarkdownEditor::Cursor),
		_ => None,
	}
}

#[cfg(target_os = "macos")]
fn spawn_open_editor(app_bundle_name: &str, path: &Path) -> Result<(), String> {
	let path_str = path.to_str().ok_or("路径包含无效字符")?;
	let status = Command::new("/usr/bin/open")
		.args(["-a", app_bundle_name, "--", path_str])
		.status()
		.map_err(|e| format!("无法启动 {app_bundle_name}: {e}"))?;
	if status.success() {
		Ok(())
	} else {
		Err(format!("open -a {app_bundle_name} 退出码非 0"))
	}
}

#[cfg(not(target_os = "macos"))]
fn spawn_open_editor(cli_name: &str, path: &Path) -> Result<(), String> {
	let path_str = path.to_str().ok_or("路径包含无效字符")?;
	Command::new(cli_name)
		.arg(path_str)
		.spawn()
		.map_err(|e| format!("无法启动 {cli_name}: {e}"))?;
	Ok(())
}

fn open_markdown_with_detected_editor(path: &Path) -> Result<DetectedMarkdownEditor, String> {
	let kind = detect_markdown_editor();
	match kind {
		DetectedMarkdownEditor::Cursor => {
			#[cfg(target_os = "macos")]
			{
				spawn_open_cursor_macos(path)?;
			}
			#[cfg(not(target_os = "macos"))]
			{
				spawn_open_editor("cursor", path)?;
			}
			Ok(DetectedMarkdownEditor::Cursor)
		}
		DetectedMarkdownEditor::Trae => {
			#[cfg(target_os = "macos")]
			{
				if spawn_open_editor("Trae", path).is_err() {
					// 部分安装为「Trae CN」等显示名
					spawn_open_editor("Trae CN", path)?;
				}
			}
			#[cfg(not(target_os = "macos"))]
			{
				spawn_open_editor("trae", path)?;
			}
			Ok(DetectedMarkdownEditor::Trae)
		}
	}
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OpenKnowledgeMarkdownInEditorInput {
	pub file_path: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OpenKnowledgeMarkdownInEditorResult {
	/// 实际用于打开的编辑器：`Cursor` 或 `Trae`
	pub opened_with: String,
}

/// 在检测到的编辑器中打开本地 `.md`：前台名 → 运行中进程（优先 Cursor）→ macOS 再按已安装 .app 兜底；打开时 macOS Cursor 用 Bundle ID / open -a / CLI，Trae 支持 Trae CN
#[tauri::command]
pub fn open_knowledge_markdown_in_editor(
	input: OpenKnowledgeMarkdownInEditorInput,
) -> Result<OpenKnowledgeMarkdownInEditorResult, String> {
	let trimmed = input.file_path.trim();
	if trimmed.is_empty() {
		return Err("filePath 不能为空".to_string());
	}
	let p = PathBuf::from(trimmed);
	if !p.exists() || !p.is_file() {
		return Err("文件不存在或不是普通文件".to_string());
	}
	if !is_md_file_path(&p) {
		return Err("仅允许打开 .md 文件".to_string());
	}
	let used = open_markdown_with_detected_editor(&p)?;
	let opened_with = match used {
		DetectedMarkdownEditor::Cursor => "Cursor",
		DetectedMarkdownEditor::Trae => "Trae",
	};
	Ok(OpenKnowledgeMarkdownInEditorResult {
		opened_with: opened_with.to_string(),
	})
}
