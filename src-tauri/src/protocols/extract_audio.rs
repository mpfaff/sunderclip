use std::{error::Error, process::Stdio, string::FromUtf8Error};

use serde::{Deserialize, Serialize};
use tauri::http::{self, HeaderValue};
use tokio::{io::AsyncReadExt as _, process::Command};

use crate::FFMPEG_PATH;

#[derive(Serialize, Deserialize, Debug)]
struct ExtractAudioParams {
    video_source: String,
    audio_track_index: u32,
}

#[derive(Debug)]
enum InvalidUrlError<'a> {
    MissingDelimiter {
        string: &'a str,
    },
    UnrecognizedFormat {
        string: &'a str,
    },
    UnexpectedDelimiter {
        string: &'a str,
        offset: usize,
    },
    InvalidVideoSource {
        encoded: &'a str,
        cause: FromUtf8Error,
    },
    InvalidAudioTrack {
        string: &'a str,
        cause: std::num::ParseIntError,
    },
}

impl std::fmt::Display for InvalidUrlError<'_> {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match *self {
            InvalidUrlError::MissingDelimiter { string } => {
                write!(f, "Missing delimiter in {:?}", string)
            }
            InvalidUrlError::UnrecognizedFormat { string } => {
                write!(f, "Unrecognized format in {:?}", string)
            }
            InvalidUrlError::UnexpectedDelimiter { string, offset } => {
                write!(f, "Unexpected delimiter in {:?} at {:?}", string, offset)
            }
            InvalidUrlError::InvalidVideoSource { encoded, ref cause } => {
                write!(
                    f,
                    "Invalid video source provided in {:?}: {}",
                    encoded, cause
                )
            }
            InvalidUrlError::InvalidAudioTrack { string, ref cause } => {
                write!(
                    f,
                    "Invalid audio track index provided in {:?}: {}",
                    string, cause
                )
            }
        }
    }
}
impl Error for InvalidUrlError<'_> {}

impl ExtractAudioParams {
    pub fn from_str(s: &str) -> Result<Self, InvalidUrlError<'_>> {
        let rest = s
            .strip_prefix("/")
            .ok_or_else(|| InvalidUrlError::UnrecognizedFormat { string: s })?;

        let Some((video_source, audio_track_index)) = rest.split_once("/") else {
            return Err(InvalidUrlError::MissingDelimiter { string: s });
        };

        if let Some(i) = audio_track_index.chars().position(|char| char == '/') {
            return Err(InvalidUrlError::UnexpectedDelimiter {
                string: s,
                offset: video_source.len() + i + 1 + 1,
            });
        }

        let video_source =
            urlencoding::decode(video_source).map_err(|e| InvalidUrlError::InvalidVideoSource {
                encoded: video_source,
                cause: e,
            })?;
        let audio_track_index =
            audio_track_index
                .parse()
                .map_err(|e| InvalidUrlError::InvalidAudioTrack {
                    string: s,
                    cause: e,
                })?;

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
    } = ExtractAudioParams::from_str(req.uri().path()).map_err(|e| e.to_string())?;

    let mut data: Vec<u8> = Vec::new();

    let mut command = Command::new(FFMPEG_PATH.get().unwrap());
    command
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
        .arg(&"pipe:2");
    #[cfg(target_os = "windows")]
    command.creation_flags(windows_sys::Win32::System::Threading::CREATE_NO_WINDOW);

    let child = command
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| e.to_string())?;

    child
        .stderr
        .unwrap()
        .read_to_end(&mut data)
        .await
        .map_err(|e| e.to_string())?;

    let data_length = data.len();
    let mut req = http::Response::new(data);

    let headers = req.headers_mut();
    headers.append("Content-Type", HeaderValue::from_static("audio/mp3"));
    headers.append("Accept-Ranges", HeaderValue::from_static("bytes"));
    headers.append(
        "Content-Length",
        HeaderValue::from_str(data_length.to_string().as_str()).unwrap(),
    );
    headers.append(
        "Content-Range",
        HeaderValue::from_str(format!("bytes */{}", data_length).as_str()).unwrap(),
    );
    headers.append("Connection", HeaderValue::from_static("Keep-Alive"));

    Ok(req)
}
