#[tauri::command]
pub async fn show_in_folder(path: String) -> Result<(), String> {
    tokio::task::spawn_blocking(move || showfile::show_path_in_file_manager(&path))
        .await
        .map_err(|e| e.to_string())
}
