use tauri::{Manager, Window};

#[tauri::command]
pub async fn close_splashscreen(window: Window) {
    let splashscreen_window = window.get_webview_window("splashscreen");

    match splashscreen_window {
        Some(win) => win.close().unwrap(),
        None => { /* Window is already closed */ }
    }

    let sunderclip_window = window
        .get_webview_window("sunderclip")
        .expect("No window labelled sunderclip found");
    sunderclip_window.center().unwrap();
    sunderclip_window.maximize().unwrap();
    sunderclip_window.show().unwrap();
}
