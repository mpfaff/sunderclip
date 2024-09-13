# Sunderclip

Sunderclip is a lightweight video trimming app with the intention of addressing the inconvenience of video compression.
Specifically, finding the optimal compression bitrate to squeeze a video under a given file size limit while maintaining the highest quality possible, particularly for sharing online.

Sunderclip automates this process during video export, providing a simple and quick user-interface to allow for fast trimming.

Note: This project may become scarcely maintained after its first release.

## Features

- [x] Multi-audio stream support
- [x] Playback of web-compatible codecs and containers: MP4, OGG, WEBM
- [x] Automatic video compression for maximum quality in a user-specified file size limit
- [x] Hardware acceleration for video encoding including: Nvidia NVENC, AMD AMF, Intel QSV
- [x] Many codecs for encoding
- [ ] Resizable UI panels
- [ ] Playback of all codecs
- [ ] Project saving

## Technologies

- [Tauri](https://tauri.app/) beta
- [Solid JS](https://www.solidjs.com/)
- [TypeScript](https://www.typescriptlang.org/)
- [FFMPEG](https://ffmpeg.org/)

## Story

The idea of Sunderclip came about from my personal experiences of having to constantly adjust the bitrate and re-run FFMPEG commands on my Lethal Company game-play clips for quickly sharing with my friends on Discord, all while being unable to see the video in my terminal or hear all the audio streams in the clip.

If you also have encountered similar issues, I hope this app helps you!

Fun fact: this project will serve as my final project for computer science.

## Building

1. Make sure you have the latest beta of tauri-cli installed
2. Run `tauri build` to build in release mode or `tauri dev` to run a dev build

