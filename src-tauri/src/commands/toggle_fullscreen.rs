use tauri::{Manager, Window};

#[tauri::command]
pub async fn toggle_fullscreen(window: Window) {
    let sunderclip_window = window
        .get_webview_window("sunderclip")
        .expect("No window labelled sunderclip found");

    let is_fullscreen = sunderclip_window.is_fullscreen().unwrap();

    if is_fullscreen {
        sunderclip_window.show_menu().unwrap();
    } else {
        sunderclip_window.hide_menu().unwrap();
    }
    sunderclip_window.set_fullscreen(!is_fullscreen).unwrap();
}
