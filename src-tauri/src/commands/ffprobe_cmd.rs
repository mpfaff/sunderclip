use std::{
    io::Read,
    os::windows::process::CommandExt,
    process::{Command, Stdio},
};

use crate::{constants::CREATE_NO_WINDOW, FFPROBE_PATH};

#[tauri::command]
pub async fn ffprobe_cmd(filepath: &str) -> Result<String, String> {
    let mut json = String::new();

    let command = Command::new(FFPROBE_PATH.get().unwrap())
        .args([
            "-v",
            "quiet",
            "-print_format",
            "json",
            "-show_format",
            "-show_streams",
            filepath,
        ])
        .creation_flags(CREATE_NO_WINDOW)
        .stdout(Stdio::piped())
        .spawn()
        .map_err(|e| e.to_string())?;

    command
        .stdout
        .unwrap()
        .read_to_string(&mut json)
        .map_err(|e| e.to_string())?;

    Ok(json)
}
