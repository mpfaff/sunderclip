// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

#[cfg(target_os = "windows")]
const FFMPEG_BIN: &'static [u8] = include_bytes!("ffmpeg/windows/ffmpeg.exe.zst");
#[cfg(target_os = "windows")]
const FFPROBE_BIN: &'static [u8] = include_bytes!("ffmpeg/windows/ffprobe.exe.zst");

#[cfg(target_os = "macos")]
const FFMPEG_BIN: &'static [u8] = include_bytes!("ffmpeg/macos/ffmpeg.zst");
#[cfg(target_os = "macos")]
const FFPROBE_BIN: &'static [u8] = include_bytes!("ffmpeg/macos/ffprobe.zst");

#[cfg(target_os = "linux")]
const FFMPEG_BIN: &'static [u8] = include_bytes!("ffmpeg/linux/ffmpeg.zst");
#[cfg(target_os = "linux")]
const FFPROBE_BIN: &'static [u8] = include_bytes!("ffmpeg/linux/ffprobe.zst");

use std::{
    fs::{create_dir, File},
    io::BufWriter,
    path::PathBuf,
    sync::{Arc, OnceLock},
};

use tauri::{
    http::{self, HeaderValue},
    menu::{Menu, MenuEvent, MenuItem, Submenu},
    App, Manager, Window, Wry,
};

static FFMPEG_HOME: OnceLock<PathBuf> = OnceLock::new();
static FFPROBE_PATH: OnceLock<PathBuf> = OnceLock::new();
static FFMPEG_PATH: OnceLock<PathBuf> = OnceLock::new();
static TEMP_PATH: OnceLock<PathBuf> = OnceLock::new();

mod commands;
mod protocols;

fn get_app_temp_data_dir(app: &App) -> PathBuf {
    let temp_data_path = app
        .handle()
        .path()
        .temp_dir()
        .expect("Failed to get local temp directory");

    return temp_data_path;
}

fn get_app_local_data_dir(app: &App) -> PathBuf {
    let local_data_path = app
        .handle()
        .path()
        .app_local_data_dir()
        .expect("Failed to get local data directory");

    return local_data_path;
}

fn setup(app: &mut App) -> Result<(), Box<dyn std::error::Error>> {
    let mut temp_data_path = get_app_temp_data_dir(app);
    temp_data_path.push(&app.package_info().name);

    if !temp_data_path.exists() {
        create_dir(temp_data_path.as_path()).expect("Failed to create app temp data directory");
    }
    TEMP_PATH.set(temp_data_path).unwrap();

    let local_data_path = get_app_local_data_dir(app);

    if !local_data_path.exists() {
        create_dir(local_data_path.as_path()).expect("Failed to create app local data directory");
    }

    let mut ffmpeg_home = local_data_path;
    ffmpeg_home.push("ffmpeg");

    if !ffmpeg_home.exists() {
        create_dir(ffmpeg_home.as_path()).expect("Failed to create ffmpeg home");
    }

    let mut ffmpeg_path = ffmpeg_home.clone();
    ffmpeg_path.push("ffmpeg");
    #[cfg(target_os = "windows")]
    ffmpeg_path.set_extension("exe");

    let mut ffprobe_path = ffmpeg_home.clone();
    ffprobe_path.push("ffprobe");
    #[cfg(target_os = "windows")]
    ffprobe_path.set_extension("exe");

    if !ffmpeg_path.exists() {
        zstd::stream::copy_decode(
            FFMPEG_BIN,
            BufWriter::new(File::create(ffmpeg_path.as_path()).unwrap()),
        )
        .unwrap();
    }
    if !ffprobe_path.exists() {
        zstd::stream::copy_decode(
            FFPROBE_BIN,
            BufWriter::new(File::create(ffprobe_path.as_path()).unwrap()),
        )
        .unwrap();
    }

    FFMPEG_HOME.set(ffmpeg_home).unwrap();
    FFPROBE_PATH.set(ffprobe_path).unwrap();
    FFMPEG_PATH.set(ffmpeg_path).unwrap();

    Ok(())
}

fn create_menu(app: &App) -> Menu<Wry> {
    let new_btn = MenuItem::with_id(app, "new_proj", "New Project", true, None::<&str>).unwrap();
    let quit_btn = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>).unwrap();
    let submenu_file = Submenu::new(app, "File", true).unwrap();
    submenu_file.append_items(&[&new_btn, &quit_btn]).unwrap();

    let prefs_btn = MenuItem::with_id(app, "prefs", "Preferences", true, None::<&str>).unwrap();
    let submenu_options = Submenu::new(app, "Options", true).unwrap();
    submenu_options.append_items(&[&prefs_btn]).unwrap();

    let zoom_in_btn = MenuItem::with_id(app, "zoom_in", "Zoom In", true, None::<&str>).unwrap();
    let zoom_out_btn = MenuItem::with_id(app, "zoom_out", "Zoom Out", true, None::<&str>).unwrap();
    let submenu_view = Submenu::new(app, "View", true).unwrap();
    submenu_view
        .append_items(&[&zoom_in_btn, &zoom_out_btn])
        .unwrap();

    let submenu_edit = Submenu::new(app, "Edit", true).unwrap();

    let submenu_help = Submenu::new(app, "Help", true).unwrap();

    let menu = Menu::new(app).unwrap();
    menu.append_items(&[
        &submenu_file,
        &submenu_edit,
        &submenu_view,
        &submenu_options,
        &submenu_help,
    ])
    .unwrap();
    return menu;
}

fn handle_menu(window: &Window, event: MenuEvent) {
    match event.id.as_ref() {
        "quit" => {
            std::process::exit(0);
        }

        s => {
            window.emit(s, None::<()>).unwrap();
        }
    }
}

fn main() {
    let runtime = Arc::new(
        tokio::runtime::Builder::new_multi_thread()
            .enable_all()
            .build()
            .unwrap(),
    );

    tauri::Builder::default()
        .plugin(tauri_plugin_clipboard_manager::init())
        .register_asynchronous_uri_scheme_protocol("extract-audio", {
            let runtime = Arc::clone(&runtime);
            move |_app, req, resp| {
                runtime.spawn(async move {
                    let mut res = protocols::extract_audio::extract_audio_protocol(req)
                        .await
                        .unwrap_or_else(|e| {
                            http::Response::builder()
                                .status(400)
                                .body(Vec::from(e))
                                .unwrap()
                        });
                    res.headers_mut()
                        .append("Access-Control-Allow-Origin", HeaderValue::from_static("*"));
                    resp.respond(res)
                });
            }
        })
        .setup(|app| {
            setup(app)?;

            let sunderclip_window = app.get_webview_window("sunderclip").unwrap();

            sunderclip_window.on_menu_event(handle_menu);
            sunderclip_window.set_menu(create_menu(app))?;

            Ok(())
        })
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![
            commands::close_splashscreen::close_splashscreen,
            commands::ffprobe_cmd::ffprobe_cmd,
            commands::toggle_fullscreen::toggle_fullscreen,
            commands::get_encoders::get_encoders,
            commands::get_hwaccels::get_hwaccels,
            commands::render::start_render,
            commands::render::cancel_render,
            commands::show_in_folder::show_in_folder
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
