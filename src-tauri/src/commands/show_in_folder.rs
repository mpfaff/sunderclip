use std::path::PathBuf;
use tokio::fs::metadata;
use tokio::process::Command;

#[tauri::command]
pub async fn show_in_folder(path: String) -> Result<(), ()> {
    if cfg!(target_os = "windows") {
        Command::new("explorer")
            .args(["/select,", &path]) // The comma after select is not a typo
            .status()
            .await
            .map_err(|_| ())?
            .success()
            .then(|| ())
            .ok_or(())
    } else if cfg!(target_os = "linux") {
        if path.contains(",") {
            // see https://gitlab.freedesktop.org/dbus/dbus/-/issues/76
            let new_path = match metadata(&path).await.map_err(|_| ())?.is_dir() {
                true => path,
                false => {
                    let mut path2 = PathBuf::from(path);
                    path2.pop();
                    path2.into_os_string().into_string().map_err(|_| ())?
                }
            };
            Command::new("xdg-open")
                .arg(&new_path)
                .status()
                .await
                .map_err(|_| ())?
                .success()
                .then(|| ())
                .ok_or(())
        } else {
            Command::new("dbus-send")
                .args([
                    "--session",
                    "--dest=org.freedesktop.FileManager1",
                    "--type=method_call",
                    "/org/freedesktop/FileManager1",
                    "org.freedesktop.FileManager1.ShowItems",
                    format!("array:string:\"file://{path}\"").as_str(),
                    "string:\"\"",
                ])
                .status()
                .await
                .map_err(|_| ())?
                .success()
                .then(|| ())
                .ok_or(())
        }
    } else if cfg!(target_os = "macos") {
        Command::new("open")
            .args(["-R", &path])
            .status()
            .await
            .map_err(|_| ())?
            .success()
            .then(|| ())
            .ok_or(())
    } else {
        Err(())
    }
}
