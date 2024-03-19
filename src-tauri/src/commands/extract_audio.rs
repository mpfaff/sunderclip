use std::{
    io::Read,
    os::windows::process::CommandExt,
    process::{Command, Stdio},
};

use rand::{distributions::Alphanumeric, Rng};
use serde::{Deserialize, Serialize};

use tauri;

use crate::{FFMPEG_PATH, TEMP_PATH};

use super::CREATE_NO_WINDOW;

#[derive(Serialize, Deserialize, Debug)]
struct ExtractedAudio {
    audio_source: String,
}

#[tauri::command]
pub async fn extract_audio(video_source: &str, audio_track_index: i32) -> Result<String, String> {
    let mut data = String::new();

    let random_filename: String = rand::thread_rng()
        .sample_iter(&Alphanumeric)
        .take(10)
        .map(char::from)
        .collect();

    let mut random_file = TEMP_PATH.get().unwrap().clone();
    random_file.push(random_filename);
    random_file.set_extension("mp3");

    let command = Command::new(FFMPEG_PATH.get().unwrap())
        .args([
            "-i",
            video_source,
            "-map",
            format!("0:{}", audio_track_index).as_str(), // Replace mp3 with some container supporting the codec
        ])
        .arg(&random_file)
        .creation_flags(CREATE_NO_WINDOW)
        .stdout(Stdio::piped())
        .spawn()
        .map_err(|e| e.to_string())?;

    command
        .stdout
        .unwrap()
        .read_to_string(&mut data)
        .map_err(|e| e.to_string())?;

    let extracted_audio = ExtractedAudio {
        audio_source: random_file.into_os_string().into_string().unwrap(),
    };

    Ok(serde_json::to_string(&extracted_audio).unwrap())
}
