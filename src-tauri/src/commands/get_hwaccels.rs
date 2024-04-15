use std::process::Stdio;

use tokio::{
    io::{AsyncBufReadExt, BufReader},
    process::Command,
};

use crate::{constants::CREATE_NO_WINDOW, FFMPEG_PATH};

#[tauri::command]
pub async fn get_hwaccels() -> Result<Vec<String>, String> {
    let mut hw_accelerators = Vec::new();

    let command = Command::new(FFMPEG_PATH.get().unwrap())
        .args(["-hide_banner", "-hwaccels"])
        .creation_flags(CREATE_NO_WINDOW)
        .stdout(Stdio::piped())
        .spawn()
        .map_err(|e| e.to_string())?;

    let mut reader = BufReader::new(command.stdout.unwrap());
    let mut line_buf = Vec::new();

    while reader
        .read_until(b'\n', &mut line_buf)
        .await
        .map_err(|e| e.to_string())?
        != 0
    {
        if line_buf.ends_with(b":\r\n") || line_buf.ends_with(b":\n") {
            line_buf.clear();
            break;
        }
        line_buf.clear();
    }

    while reader
        .read_until(b'\n', &mut line_buf)
        .await
        .map_err(|e| e.to_string())?
        != 0
    {
        let line = std::str::from_utf8(&line_buf).map_err(|e| e.to_string())?;
        hw_accelerators.push(line.trim().to_owned());
        line_buf.clear();
    }

    Ok(hw_accelerators)
}
