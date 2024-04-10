use std::process::Stdio;

use tauri::{Manager, Window};
use tokio::{
    io::{AsyncReadExt, BufReader},
    process::Command,
};

use crate::FFMPEG_PATH;

use super::CREATE_NO_WINDOW;

struct RenderResult {
    file_size: f64,
}

#[tauri::command]
pub async fn render(
    window: Window,
    input_filepath: &str,
    output_filepath: &str,
    v_codec_id: &str,
    a_codec_id: &str,
    audio_tracks: Vec<u32>,
    codec_rate_control: Vec<&str>,
    trim_start: f64,
    trim_end: f64,
) -> Result<(), String> {
    let mut command = Command::new(FFMPEG_PATH.get().unwrap());

    command.args([
        "-i",
        input_filepath,
        "-c:v",
        v_codec_id,
        "-c:a",
        a_codec_id,
        "-ss",
        trim_start.to_string().as_str(),
        "-t",
        trim_end.to_string().as_str(),
        "-map",
        "0:v",
    ]);

    command.arg("-filter_complex");
    for i in &audio_tracks {
        // Bit lazy code, it is currently 12AM, also this won't work yet
        // FIXME
        if i == &audio_tracks.len() {
            command.arg(format!("[0:{}]", i));
        } else {
            command.arg(format!("[0:{}]amerge=inputs={}[a]", i, &audio_tracks.len()));
        }
    }
    command.args(["-map", "[a]"]);

    command.args(codec_rate_control);
    command.args(["-progress", "pipe:1"]);
    command.arg(output_filepath);

    let child = command
        .creation_flags(CREATE_NO_WINDOW)
        .stdout(Stdio::piped())
        .spawn()
        .map_err(|e| e.to_string())?;

    let mut reader = BufReader::new(child.stdout.unwrap());
    let mut line_buf = Vec::new();

    while reader
        .read_buf(&mut line_buf)
        .await
        .map_err(|e| e.to_string())?
        != 0
    {
        let line = std::str::from_utf8(&line_buf).map_err(|e| e.to_string())?;
        window.emit("export_progress", line).unwrap();

        line_buf.clear();
    }

    Ok(())
}
