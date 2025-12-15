// Learn more about Tauri commands at https://tauri.app/v1/guides/features/command
/// 向指定名称的用户发送问候语
/// 
/// # 参数
/// * `name` - 需要问候的用户名称，类型为字符串切片（&str）
/// 
/// # 返回值
/// 返回一个格式化的问候字符串，包含传入的名称和固定提示信息
/// 
/// # 示例
/// ```
/// let greeting = greet("Alice");
/// assert_eq!(greeting, "Hello, Alice! You've been greeted from Rust!");
/// ```
/// 

#[tauri::command]
pub fn greet(name: &str) -> String {
    // 使用 format! 宏将名称嵌入到问候模板中
    format!("Hello, {}! You've been greeted from Rust!", name)
}