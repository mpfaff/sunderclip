use std::process::Stdio;

use tauri::{Manager, Window};
use tokio::{
    io::{AsyncBufReadExt, BufReader},
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
        (trim_end - trim_start).to_string().as_str(),
        "-map",
        "0:v",
    ]);

    command.arg("-filter_complex");
    let mut audio_command = String::new().to_owned();
    for i in audio_tracks.iter() {
        if *i != audio_tracks.len() as u32 {
            audio_command.push_str(&format!("[0:{}]", i).to_owned());
        } else {
            audio_command
                .push_str(&format!("[0:{}]amerge=inputs={}[a]", i, &audio_tracks.len()).to_owned())
        }
    }
    command.arg(audio_command);
    command.args(["-ac", "2"]); // Stereo audio channels
    command.args(["-map", "[a]"]);

    command.args(codec_rate_control);
    command.args(["-progress", "pipe:1"]);
    command.arg(output_filepath);

    println!("{:?}", &command);

    let child = command
        .creation_flags(CREATE_NO_WINDOW)
        .stdout(Stdio::piped())
        .spawn()
        .map_err(|e| e.to_string())?;

    let mut reader = BufReader::new(child.stdout.unwrap());
    let mut lines = String::new();

    const PROGRESS_LINES: u8 = 12;
    let mut current_line: u8 = 0;

    while reader
        .read_line(&mut lines)
        .await
        .map_err(|e| e.to_string())?
        != 0
    {
        current_line += 1;

        if current_line >= PROGRESS_LINES {
            window.emit("export_progress", &lines).unwrap();

            lines.clear();
            current_line = 0;
        }
    }

    Ok(())
}
