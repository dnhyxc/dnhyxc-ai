#[tauri::command]
pub fn greet(name: &str) -> String {
    // 使用 format! 宏将名称嵌入到问候模板中
    format!("Hello, {}! You've been greeted from Rust!", name)
}
