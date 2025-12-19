#[tauri::command]
pub fn listen_event(event: String, payload: String) {
    println!("{} {}", event, payload);
}
