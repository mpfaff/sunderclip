use std::{ops::Sub, time::Duration};

use tauri::{Manager, Window};
use tokio::time::sleep;

use crate::START_TIME;

#[tauri::command]
pub async fn close_splashscreen(window: Window) {
    // The following code adds artificial delay incase the window starts too fast which causes
    // const MIN_CLOSE_DELAY_MS: u64 = 300;
    // the splashscreen to be unreadable
    // let start_time_diff = Duration::from_millis(MIN_CLOSE_DELAY_MS)
    //     .sub(START_TIME.elapsed())
    //     .max(Duration::from_millis(0));

    let sunderclip_window = window
        .get_webview_window("sunderclip")
        .expect("no windows?");
    sunderclip_window.center().unwrap();
    sunderclip_window.maximize().unwrap();
    sunderclip_window.show().unwrap();

    // sleep(start_time_diff).await;

    let splashscreen_window = window.get_webview_window("splashscreen");

    match splashscreen_window {
        Some(win) => win.close().unwrap(),
        None => { /* Window is already closed */ }
    }
}
