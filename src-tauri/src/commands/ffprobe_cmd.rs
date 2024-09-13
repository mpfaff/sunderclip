use std::{
    io::Read,
    process::{Command, Stdio},
};

use crate::FFPROBE_PATH;

#[tauri::command]
pub async fn ffprobe_cmd(filepath: &str) -> Result<String, String> {
    let mut json = String::new();

    let mut command = Command::new(FFPROBE_PATH.get().unwrap());
    command.args([
        "-v",
        "quiet",
        "-print_format",
        "json",
        "-show_format",
        "-show_streams",
        filepath,
    ]);
    #[cfg(target_os = "windows")]
    command.creation_flags(windows_sys::Win32::System::Threading::CREATE_NO_WINDOW);
    let child = command.stdout(Stdio::piped())
        .spawn()
        .map_err(|e| e.to_string())?;

    child
        .stdout
        .unwrap()
        .read_to_string(&mut json)
        .map_err(|e| e.to_string())?;

    Ok(json)
}
