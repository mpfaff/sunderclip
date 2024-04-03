use std::process::Stdio;

use tokio::{
    io::{AsyncBufReadExt, BufReader},
    process::Command,
};

use crate::FFMPEG_PATH;

use super::CREATE_NO_WINDOW;

#[tauri::command]
pub async fn get_encoders() -> Result<Vec<String>, String> {
    let mut encoders = Vec::new();

    let command = Command::new(FFMPEG_PATH.get().unwrap())
        .args(["-hide_banner", "-encoders"])
        .creation_flags(CREATE_NO_WINDOW)
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| e.to_string())?;

    let mut reader = BufReader::new(command.stderr.unwrap());
    let mut line_buf = Vec::new();
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
                .ok_or("Invalid output from FFMPEG")?
                .to_owned(),
        );
        line_buf.clear();
    }

    Ok(encoders)
}
