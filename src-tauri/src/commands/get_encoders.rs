use std::process::Stdio;

use tokio::{
    io::{AsyncBufReadExt, BufReader},
    process::Command,
};

use crate::{constants::CREATE_NO_WINDOW, FFMPEG_PATH};

#[tauri::command]
pub async fn get_encoders() -> Result<Vec<String>, String> {
    let mut encoders = Vec::new();

    let command = Command::new(FFMPEG_PATH.get().unwrap())
        .args(["-hide_banner", "-encoders"])
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
        if line_buf.ends_with(b"-\r\n") || line_buf.ends_with(b"-\n") {
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
        encoders.push(
            line.split(' ')
                .nth(2)
                .ok_or_else(|| format!("Invalid output from FFMPEG: {}", line))?
                .to_owned(),
        );
        line_buf.clear();
    }

    Ok(encoders)
}
