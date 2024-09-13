use std::process::Stdio;

use tokio::{
    io::{AsyncBufReadExt, BufReader},
    process::Command,
};

use crate::FFMPEG_PATH;

#[tauri::command]
pub async fn get_encoders() -> Result<Vec<String>, String> {
    let mut encoders = Vec::new();

    let mut command = Command::new(FFMPEG_PATH.get().unwrap());
    command
        .args(["-hide_banner", "-encoders"])
        .stdout(Stdio::piped());

    #[cfg(target_os = "windows")]
    command.creation_flags(windows_sys::Win32::System::Threading::CREATE_NO_WINDOW);
    let child = command
        .spawn()
        .map_err(|e| e.to_string())?;

    let mut reader = BufReader::new(child.stdout.unwrap());
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
