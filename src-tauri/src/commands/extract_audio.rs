use std::{error::Error, os::windows::process::CommandExt, process::Stdio, str::FromStr};

use serde::{Deserialize, Serialize};
use tauri::{
    self,
    http::{self, HeaderValue},
    AppHandle,
};
use tokio::{io::AsyncReadExt as _, process::Command};

use crate::FFMPEG_PATH;

use super::CREATE_NO_WINDOW;

#[derive(Serialize, Deserialize, Debug)]
struct ExtractAudioParams {
    video_source: String,
    audio_track_index: u32,
}

#[derive(Debug)]
struct InvalidUrlError;
impl std::fmt::Display for InvalidUrlError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        return f.write_str("Invalid URL");
    }
}
impl Error for InvalidUrlError {}

impl FromStr for ExtractAudioParams {
    type Err = InvalidUrlError;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        let Some((video_source, audio_track_index)) = s.split_once("/") else {
            return Err(InvalidUrlError);
        };

        let video_source = urlencoding::decode(video_source).map_err(|_| InvalidUrlError)?;
        let audio_track_index = audio_track_index.parse().map_err(|e| InvalidUrlError)?;

        Ok(Self {
            video_source: video_source.into_owned(),
            audio_track_index,
        })
    }
}

// extract-audio:///video_source/audio_track_index
pub async fn extract_audio_protocol(
    req: http::Request<Vec<u8>>,
) -> Result<http::Response<Vec<u8>>, String> {
    let ExtractAudioParams {
        video_source,
        audio_track_index,
    } = req
        .uri()
        .path()
        .parse::<ExtractAudioParams>()
        .map_err(|e| e.to_string())?;

    let mut data: Vec<u8> = Vec::new();

    let command = Command::new(FFMPEG_PATH.get().unwrap())
        .args([
            "-i",
            &video_source,
            "-v",
            "quiet",
            "-map",
            &format!("0:{}", audio_track_index), // Replace mp3 with some container supporting the codec
            "-f",
            "mp3",
        ])
        .arg(&"pipe:1")
        .creation_flags(CREATE_NO_WINDOW)
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| e.to_string())?;

    command
        .stderr
        .unwrap()
        .read_to_end(&mut data)
        .await
        .map_err(|e| e.to_string())?;

    let mut req = http::Response::new(data);
    req.headers_mut()
        .append("Content-Type", HeaderValue::from_static("audio/mp3"));
    Ok(req)
}
