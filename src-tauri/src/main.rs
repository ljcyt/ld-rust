// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

// 在开发模式下也隐藏控制台窗口
#[cfg(target_os = "windows")]
fn hide_console_window() {
    unsafe {
        use winapi::um::wincon::FreeConsole;
        FreeConsole();
    }
}

fn main() {
    #[cfg(target_os = "windows")]
    hide_console_window();
    
    app_lib::run();
}
