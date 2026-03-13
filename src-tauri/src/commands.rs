use crate::api::{ApiClient, LoginResponse};
use crate::storage::{StorageManager, UserCredentials, Task, TaskStatus, WorkOrder, WorkOrderStats};
use crate::excel::{ExcelProcessor, ExcelParseResult};
use crate::task_executor::{TaskManager, TaskProgressEvent};
use chrono::{Utc, Duration};
use tokio::sync::mpsc;
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tauri::State;
use uuid::Uuid;

// 应用状态
pub struct AppState {
    pub api_client: Arc<ApiClient>,
    pub storage: Arc<StorageManager>,
    pub task_manager: Arc<TaskManager>,
}

impl AppState {
    pub fn new() -> Result<Self, String> {
        let api_client = Arc::new(ApiClient::new());
        let storage = Arc::new(StorageManager::new()?);
        let task_manager = Arc::new(TaskManager::new(api_client.clone(), storage.clone()));

        Ok(Self {
            api_client,
            storage,
            task_manager,
        })
    }
}

// 登录命令
#[tauri::command]
pub async fn login(
    state: State<'_, Arc<AppState>>,
    username: String,
    password: String,
) -> Result<LoginResponse, String> {
    let login_result = state.api_client.login(&username, &password).await?;
    
    // 保存用户凭证
    let credentials = UserCredentials {
        token: login_result.token.clone(),
        company_id: login_result.company_id.clone(),
        user_id: login_result.user_id.clone(),
        username: username.clone(),
        expires_at: Utc::now() + Duration::hours(24), // 24小时过期
    };
    
    state.storage.save_credentials(&credentials)?;
    
    Ok(login_result)
}

// 获取当前用户信息
#[tauri::command]
pub async fn get_current_user(
    state: State<'_, Arc<AppState>>,
) -> Result<Option<UserCredentials>, String> {
    state.storage.load_credentials()
}

// 登出命令
#[tauri::command]
pub async fn logout(
    state: State<'_, Arc<AppState>>,
) -> Result<(), String> {
    state.storage.clear_credentials()
}

// 门店查询命令
#[derive(Debug, Deserialize)]
pub struct QueryStoreRequest {
    pub customer_name: String,
    pub username: String,
    pub password: String,
    #[allow(dead_code)]
    pub company_id: String,
}

#[tauri::command]
pub async fn query_store(
    state: State<'_, Arc<AppState>>,
    request: QueryStoreRequest,
) -> Result<crate::api::StoreQueryResponse, String> {
    // 首先尝试使用已保存的凭证
    let credentials = match state.storage.load_credentials()? {
        Some(creds) => {
            // 检查凭证是否过期
            if creds.expires_at > Utc::now() {
                creds
            } else {
                // 凭证过期，重新登录
                let login_response = state.api_client.login(
                    &request.username,
                    &request.password,
                ).await?;

                let new_credentials = UserCredentials {
                    token: login_response.token.clone(),
                    company_id: login_response.company_id.clone(),
                    user_id: login_response.user_id.clone(),
                    username: request.username.clone(),
                    expires_at: Utc::now() + Duration::hours(24),
                };

                state.storage.save_credentials(&new_credentials)?;
                new_credentials
            }
        }
        None => {
            // 没有保存的凭证，需要登录
            let login_response = state.api_client.login(
                &request.username,
                &request.password,
            ).await?;

            let new_credentials = UserCredentials {
                token: login_response.token.clone(),
                company_id: login_response.company_id.clone(),
                user_id: login_response.user_id.clone(),
                username: request.username.clone(),
                expires_at: Utc::now() + Duration::hours(24),
            };

            state.storage.save_credentials(&new_credentials)?;
            new_credentials
        }
    };

    state.api_client.query_store(
        &credentials.company_id,
        &credentials.token,
        &request.customer_name,
    ).await
}

// 工单提交命令
#[derive(Debug, Deserialize)]
pub struct SubmitWorkOrderRequest {
    // 登录信息
    pub username: String,
    pub password: String,
    pub company_id: String,
    // 工单信息
    pub customer_id: String,
    pub customer_name: String,
    pub description: String,
    pub result: String,
    pub completion_time: String,
    pub report_time: String,
    pub is_remote: i32,
    pub has_sop: i32,
    pub sop_description: String,
}

#[tauri::command]
pub async fn submit_work_order(
    state: State<'_, Arc<AppState>>,
    request: SubmitWorkOrderRequest,
) -> Result<crate::api::WorkOrderSubmitResponse, String> {
    // 每次提交都重新登录验证
    let login_response = state.api_client.login(
        &request.username,
        &request.password,
    ).await?;

    // 使用新获取的token提交工单
    state.api_client.submit_work_order(
        &request.company_id,
        &login_response.token,
        &request.customer_id,
        &request.customer_name,
        &request.description,  // fault_remark
        &request.result,      // processes_remark
        &request.completion_time,  // finish_time
        &request.report_time,      // repairs_times
        request.is_remote,         // is_long
        request.has_sop,           // is_there_an_sop
        Some(&request.sop_description),  // sop_description as Option
    ).await
}

// Excel文件解析命令
#[tauri::command]
pub async fn parse_excel_file(
    _state: State<'_, Arc<AppState>>,
    file_path: String,
) -> Result<ExcelParseResult, String> {
    let processor = ExcelProcessor::new();
    processor.parse_excel_file(&file_path)
}

// 获取Excel模板数据
#[tauri::command]
pub async fn get_excel_template() -> Result<Vec<Vec<String>>, String> {
    Ok(ExcelProcessor::generate_template_data())
}

// 创建任务命令
#[derive(Debug, Deserialize)]
pub struct CreateTaskRequest {
    pub work_orders: Vec<WorkOrderInput>,
}

#[derive(Debug, Deserialize)]
pub struct WorkOrderInput {
    pub store_name: String,
    pub description: String,
    pub result: String,
    pub completion_time: String,
    pub report_time: String,
    pub is_remote: i32,
    pub has_sop: i32,
    pub sop_description: String,
}

#[tauri::command]
pub async fn create_task(
    state: State<'_, Arc<AppState>>,
    request: CreateTaskRequest,
) -> Result<String, String> {
    let credentials = state.storage.load_credentials()?
        .ok_or("用户未登录")?;
    
    let task_id = Uuid::new_v4().to_string();
    let now = Utc::now();
    
    let work_orders: Vec<WorkOrder> = request.work_orders
        .into_iter()
        .map(|wo| WorkOrder {
            store_name: wo.store_name,
            description: wo.description,
            result: wo.result,
            completion_time: wo.completion_time,
            report_time: wo.report_time,
            is_remote: wo.is_remote,
            has_sop: wo.has_sop,
            sop_description: wo.sop_description,
            status: "pending".to_string(),
            error_message: None,
        })
        .collect();
    
    let task = Task {
        id: task_id.clone(),
        user_id: credentials.user_id,
        status: TaskStatus::Pending,
        total_count: work_orders.len(),
        completed_count: 0,
        failed_count: 0,
        created_at: now,
        updated_at: now,
        work_orders,
    };
    
    state.storage.save_task(&task)?;
    
    Ok(task_id)
}

// 获取任务列表
#[tauri::command]
pub async fn get_tasks(
    state: State<'_, Arc<AppState>>,
) -> Result<Vec<Task>, String> {
    let credentials = state.storage.load_credentials()?
        .ok_or("用户未登录")?;
    
    state.storage.get_user_tasks(&credentials.user_id)
}

// 获取任务详情
#[tauri::command]
pub async fn get_task(
    state: State<'_, Arc<AppState>>,
    task_id: String,
) -> Result<Option<Task>, String> {
    state.storage.load_task(&task_id)
}

// 任务进度更新结构
#[derive(Debug, Serialize)]
pub struct TaskProgress {
    pub task_id: String,
    pub completed_count: usize,
    pub failed_count: usize,
    pub current_work_order: Option<String>,
    pub is_completed: bool,
}

// 执行任务命令
#[derive(Debug, Deserialize)]
pub struct ExecuteTaskRequest {
    pub task_id: String,
    pub username: String,
    pub password: String,
    pub company_id: String,
}

#[tauri::command]
pub async fn execute_task(
    state: State<'_, Arc<AppState>>,
    request: ExecuteTaskRequest,
) -> Result<(), String> {
    // 创建进度通道
    let (progress_sender, mut progress_receiver) = mpsc::unbounded_channel::<TaskProgressEvent>();

    // 启动任务执行
    state.task_manager.start_task_execution(
        request.task_id.clone(),
        request.username,
        request.password,
        request.company_id,
        progress_sender
    ).await?;

    // 这里可以添加进度监听逻辑
    // 目前简单返回，实际应用中可能需要WebSocket或其他方式推送进度
    tokio::spawn(async move {
        while let Some(event) = progress_receiver.recv().await {
            // 可以在这里处理进度事件，比如发送到前端
            println!("任务进度: {:?}", event);
        }
    });

    Ok(())
}

// 取消任务执行
#[tauri::command]
pub async fn cancel_task(
    state: State<'_, Arc<AppState>>,
    task_id: String,
) -> Result<(), String> {
    state.task_manager.cancel_task_execution(&task_id).await
}

// 获取活跃任务列表
#[tauri::command]
pub async fn get_active_tasks(
    state: State<'_, Arc<AppState>>,
) -> Result<Vec<String>, String> {
    Ok(state.task_manager.get_active_tasks().await)
}

// 获取统计数据
#[tauri::command]
pub async fn get_statistics(
    state: State<'_, Arc<AppState>>,
) -> Result<WorkOrderStats, String> {
    state.storage.load_stats()
}

// 更新统计数据
#[tauri::command]
pub async fn update_statistics(
    state: State<'_, Arc<AppState>>,
    success_count: u32,
    failed_count: u32,
) -> Result<(), String> {
    state.storage.log_stats(success_count, failed_count)
}

// 重置统计数据
#[tauri::command]
pub async fn reset_statistics(
    state: State<'_, Arc<AppState>>,
) -> Result<(), String> {
    state.storage.reset_stats()
}
