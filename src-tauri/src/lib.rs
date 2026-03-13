mod api;
mod storage;
mod commands;
mod excel;
mod task_executor;
mod retry;

use commands::AppState;
use std::sync::Arc;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // 初始化应用状态
    let app_state = Arc::new(
        AppState::new().expect("Failed to initialize app state")
    );

    tauri::Builder::default()
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            Ok(())
        })
        .manage(app_state)
        .invoke_handler(tauri::generate_handler![
            commands::login,
            commands::get_current_user,
            commands::logout,
            commands::query_store,
            commands::submit_work_order,
            commands::parse_excel_file,
            commands::get_excel_template,
            commands::create_task,
            commands::get_tasks,
            commands::get_task,
            commands::execute_task,
            commands::cancel_task,
            commands::get_active_tasks,
            commands::get_statistics,
            commands::update_statistics,
            commands::reset_statistics
        ])
        .on_window_event(|_window, event| {
            // 处理窗口事件，减少警告
            match event {
                tauri::WindowEvent::CloseRequested { .. } => {
                    // 窗口关闭事件处理
                }
                _ => {}
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
