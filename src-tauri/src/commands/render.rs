use std::{
    collections::HashMap,
    process::Stdio,
    sync::{atomic::AtomicU32, LazyLock},
};

use serde_json::json;
use tauri::{Manager, Window};
use tokio::{
    io::{AsyncBufReadExt, BufReader},
    process::Command,
    sync::Mutex,
};

use crate::FFMPEG_PATH;

use super::CREATE_NO_WINDOW;

struct RenderTask {
    canceller: tokio::sync::oneshot::Sender<()>,
}

static RENDER_TASKS: LazyLock<Mutex<HashMap<u32, RenderTask>>> = LazyLock::new(Default::default);
static NEXT_RENDER_TASK: AtomicU32 = AtomicU32::new(0);

#[tauri::command]
pub async fn start_render(
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

    if audio_tracks.len() < 2 {
        if audio_tracks.len() == 1 {
            command.args(["-map", format!("0:{}", audio_tracks[0]).as_str()]);
        }
    } else {
        let mut audio_command = String::new().to_owned();
        for i in audio_tracks.iter() {
            if *i == 0 {
                command.arg("-filter_complex");
            }

            if *i != audio_tracks.len() as u32 {
                audio_command.push_str(&format!("[0:{}]", *i).to_owned());
            } else {
                audio_command.push_str(
                    &format!("[0:{}]amerge=inputs={}[a]", *i, &audio_tracks.len()).to_owned(),
                );

                command.arg(&audio_command);
                command.args(["-ac", "2"]); // Stereo audio channels
                command.args(["-map", "[a]"]);
            }
        }
    }

    command.args(codec_rate_control);

    command.args(["-progress", "pipe:1"]);
    command.arg(output_filepath);

    let id = NEXT_RENDER_TASK.fetch_add(1, std::sync::atomic::Ordering::Relaxed);
    let (canceller, mut rx) = tokio::sync::oneshot::channel();
    {
        let mut render_tasks = RENDER_TASKS.lock().await;
        render_tasks.insert(id, RenderTask { canceller });
    }
    tokio::task::spawn(async move {
        // let window = window.clone();
        let result = async {
            let child = command
                .creation_flags(CREATE_NO_WINDOW)
                .stdout(Stdio::piped())
                .spawn()
                .map_err(|e| e.to_string())?;

            let mut reader = BufReader::new(child.stdout.unwrap());
            let mut lines = String::new();

            const PROGRESS_LINES: u8 = 12;
            let mut current_line: u8 = 0;

            loop {
                let mut read_line_fut = reader.read_line(&mut lines);
                tokio::select! {
                    result = read_line_fut => {
                        if result.map_err(|e| e.to_string())? == 0 {
                            break;
                        }

                        current_line += 1;

                        if current_line >= PROGRESS_LINES {
                            window.emit("export_progress", &lines).unwrap();

                            lines.clear();
                            current_line = 0;
                        }
                    }
                    _ = &mut rx => {
                        return Err("Cancelled".into());
                    }
                }
            }

            Ok::<_, String>(())
        }
        .await;

        match result {
            Ok(()) => {}
            Err(e) => {
                window
                    .emit("export_progress", format!("error:{e}"))
                    .unwrap();
            }
        }
    });
    Ok(())
}

#[tauri::command]
pub async fn cancel_render() {}
