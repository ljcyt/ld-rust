use crate::api::ApiClient;
use crate::storage::{StorageManager, TaskStatus, WorkOrder};
use serde::Serialize;
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::{mpsc, Mutex};
use tokio::time::sleep;

// 任务进度事件
#[derive(Debug, Clone, Serialize)]
pub struct TaskProgressEvent {
    pub task_id: String,
    pub event_type: String, // "started", "progress", "completed", "failed"
    pub current_index: usize,
    pub total_count: usize,
    pub completed_count: usize,
    pub failed_count: usize,
    pub current_work_order: Option<String>,
    pub message: String,
    pub timestamp: chrono::DateTime<chrono::Utc>,
}

// 任务执行器
pub struct TaskExecutor {
    api_client: Arc<ApiClient>,
    storage: Arc<StorageManager>,
    progress_sender: Option<mpsc::UnboundedSender<TaskProgressEvent>>,
}

impl TaskExecutor {
    pub fn new(api_client: Arc<ApiClient>, storage: Arc<StorageManager>) -> Self {
        Self {
            api_client,
            storage,
            progress_sender: None,
        }
    }

    // 设置进度回调
    pub fn set_progress_sender(&mut self, sender: mpsc::UnboundedSender<TaskProgressEvent>) {
        self.progress_sender = Some(sender);
    }

    // 执行任务
    pub async fn execute_task(&self, task_id: &str, username: &str, password: &str, company_id: &str) -> Result<(), String> {
        // 加载任务
        let mut task = self.storage.load_task(task_id)?
            .ok_or("任务不存在")?;

        // 检查任务状态
        if task.status != TaskStatus::Pending {
            return Err("任务已经在执行或已完成".to_string());
        }

        // 每次执行任务都重新登录验证
        let login_response = self.api_client.login(username, password).await?;

        // 更新任务状态为进行中
        task.status = TaskStatus::InProgress;
        task.updated_at = chrono::Utc::now();
        self.storage.save_task(&task)?;

        // 发送开始事件
        self.send_progress_event(TaskProgressEvent {
            task_id: task_id.to_string(),
            event_type: "started".to_string(),
            current_index: 0,
            total_count: task.work_orders.len(),
            completed_count: 0,
            failed_count: 0,
            current_work_order: None,
            message: "开始执行批量任务".to_string(),
            timestamp: chrono::Utc::now(),
        });

        let mut completed_count = 0;
        let mut failed_count = 0;
        let total_count = task.work_orders.len();

        // 逐个处理工单
        let total_work_orders = task.work_orders.len();
        for index in 0..total_work_orders {
            let work_order = &mut task.work_orders[index];
            
            // 发送进度事件
            self.send_progress_event(TaskProgressEvent {
                task_id: task_id.to_string(),
                event_type: "progress".to_string(),
                current_index: index,
                total_count,
                completed_count,
                failed_count,
                current_work_order: Some(work_order.store_name.clone()),
                message: format!("正在处理第 {} 个工单: {}", index + 1, work_order.store_name),
                timestamp: chrono::Utc::now(),
            });

            // 先查询门店信息
            match self.query_store_info(company_id, &login_response.token, &work_order.store_name).await {
                Ok(store_info) => {
                    // 发送门店查询成功事件
                    self.send_progress_event(TaskProgressEvent {
                        task_id: task_id.to_string(),
                        event_type: "store_query_success".to_string(),
                        current_index: index,
                        total_count,
                        completed_count,
                        failed_count,
                        current_work_order: Some(work_order.store_name.clone()),
                        message: format!("门店 '{}' 查询成功，开始提交工单", work_order.store_name),
                        timestamp: chrono::Utc::now(),
                    });

                    // 提交工单
                    match self.submit_single_work_order(company_id, &login_response.token, &store_info.customer_id, work_order).await {
                        Ok(_) => {
                            work_order.status = "success".to_string();
                            work_order.error_message = None;
                            completed_count += 1;

                            // 发送工单提交成功事件
                            self.send_progress_event(TaskProgressEvent {
                                task_id: task_id.to_string(),
                                event_type: "work_order_success".to_string(),
                                current_index: index,
                                total_count,
                                completed_count,
                                failed_count,
                                current_work_order: Some(work_order.store_name.clone()),
                                message: format!("工单 '{}' 提交成功", work_order.store_name),
                                timestamp: chrono::Utc::now(),
                            });
                        }
                        Err(error) => {
                            work_order.status = "failed".to_string();
                            work_order.error_message = Some(error.clone());
                            failed_count += 1;

                            // 发送工单提交失败事件
                            self.send_progress_event(TaskProgressEvent {
                                task_id: task_id.to_string(),
                                event_type: "work_order_failed".to_string(),
                                current_index: index,
                                total_count,
                                completed_count,
                                failed_count,
                                current_work_order: Some(work_order.store_name.clone()),
                                message: format!("工单 '{}' 提交失败: {}", work_order.store_name, error),
                                timestamp: chrono::Utc::now(),
                            });
                        }
                    }
                }
                Err(error) => {
                    work_order.status = "failed".to_string();
                    work_order.error_message = Some(format!("门店查询失败: {}", error));
                    failed_count += 1;

                    // 发送门店查询失败事件
                    self.send_progress_event(TaskProgressEvent {
                        task_id: task_id.to_string(),
                        event_type: "store_query_failed".to_string(),
                        current_index: index,
                        total_count,
                        completed_count,
                        failed_count,
                        current_work_order: Some(work_order.store_name.clone()),
                        message: format!("门店 '{}' 查询失败: {}", work_order.store_name, error),
                        timestamp: chrono::Utc::now(),
                    });
                }
            }

            // 保存中间进度（每处理5个工单保存一次）
            if (index + 1) % 5 == 0 || index == total_work_orders - 1 {
                task.completed_count = completed_count;
                task.failed_count = failed_count;
                task.updated_at = chrono::Utc::now();
                
                // 在循环外保存任务进度，避免借用冲突
                // 这里我们暂时跳过保存，在循环结束后统一保存
            }

            // 随机延迟，避免API限流
            let delay_ms = self.calculate_delay(index);
            if delay_ms > 0 {
                // 发送延迟事件
                self.send_progress_event(TaskProgressEvent {
                    task_id: task_id.to_string(),
                    event_type: "delay".to_string(),
                    current_index: index,
                    total_count,
                    completed_count,
                    failed_count,
                    current_work_order: Some(work_order.store_name.clone()),
                    message: format!("等待 {} 秒后处理下一个工单", delay_ms / 1000),
                    timestamp: chrono::Utc::now(),
                });

                sleep(Duration::from_millis(delay_ms)).await;
            }
        }

        // 保存最终进度
        task.completed_count = completed_count;
        task.failed_count = failed_count;
        task.updated_at = chrono::Utc::now();
        
        // 保存任务进度
        if let Err(e) = self.storage.save_task(&task) {
            eprintln!("保存任务进度失败: {}", e);
        }

        // 更新最终任务状态
        task.completed_count = completed_count;
        task.failed_count = failed_count;
        task.status = if failed_count == 0 {
            TaskStatus::Completed
        } else if completed_count == 0 {
            TaskStatus::Failed
        } else {
            TaskStatus::Completed // 部分成功也算完成
        };
        task.updated_at = chrono::Utc::now();
        self.storage.save_task(&task)?;

        // 发送完成事件
        let event_type = if failed_count == 0 { "completed" } else { "completed_with_errors" };
        self.send_progress_event(TaskProgressEvent {
            task_id: task_id.to_string(),
            event_type: event_type.to_string(),
            current_index: task.work_orders.len(),
            total_count: task.work_orders.len(),
            completed_count,
            failed_count,
            current_work_order: None,
            message: format!("任务完成: 成功 {}, 失败 {}", completed_count, failed_count),
            timestamp: chrono::Utc::now(),
        });

        Ok(())
    }

    // 查询门店信息
    async fn query_store_info(
        &self,
        company_id: &str,
        token: &str,
        store_name: &str,
    ) -> Result<crate::api::StoreQueryResponse, String> {
        self.api_client.query_store(
            company_id,
            token,
            store_name,
        ).await
    }

    // 提交单个工单
    async fn submit_single_work_order(
        &self,
        company_id: &str,
        token: &str,
        customer_id: &str,
        work_order: &WorkOrder,
    ) -> Result<crate::api::WorkOrderSubmitResponse, String> {
        self.api_client.submit_work_order(
            company_id,
            token,
            customer_id,
            &work_order.store_name,
            &work_order.description,  // fault_remark
            &work_order.result,      // processes_remark
            &work_order.completion_time,  // finish_time
            &work_order.report_time,      // repairs_times
            work_order.is_remote,         // is_long
            work_order.has_sop,           // is_there_an_sop
            Some(&work_order.sop_description),  // sop_description as Option
        ).await
    }

    // 计算延迟时间（毫秒）
    fn calculate_delay(&self, index: usize) -> u64 {
        // 基础延迟：1-3秒
        let base_delay = 1000u64 + ((index % 3) as u64) * 1000u64;

        // 添加随机延迟：0-2秒
        let random_delay = ((index * 17) % 2000) as u64; // 简单的伪随机

        base_delay + random_delay
    }

    // 发送进度事件
    fn send_progress_event(&self, event: TaskProgressEvent) {
        if let Some(sender) = &self.progress_sender {
            let _ = sender.send(event);
        }
    }
}

// 任务管理器
pub struct TaskManager {
    executor: Arc<Mutex<TaskExecutor>>,
    active_tasks: Arc<Mutex<std::collections::HashMap<String, tokio::task::JoinHandle<()>>>>,
}

impl TaskManager {
    pub fn new(api_client: Arc<ApiClient>, storage: Arc<StorageManager>) -> Self {
        let executor = TaskExecutor::new(api_client, storage);
        
        Self {
            executor: Arc::new(Mutex::new(executor)),
            active_tasks: Arc::new(Mutex::new(std::collections::HashMap::new())),
        }
    }

    // 启动任务执行
    pub async fn start_task_execution(
        &self,
        task_id: String,
        username: String,
        password: String,
        company_id: String,
        progress_sender: mpsc::UnboundedSender<TaskProgressEvent>,
    ) -> Result<(), String> {
        let mut active_tasks = self.active_tasks.lock().await;

        // 检查任务是否已在执行
        if active_tasks.contains_key(&task_id) {
            return Err("任务已在执行中".to_string());
        }

        let executor = self.executor.clone();
        let task_id_clone = task_id.clone();

        // 启动异步任务
        let handle = tokio::spawn(async move {
            let mut executor_guard = executor.lock().await;
            executor_guard.set_progress_sender(progress_sender);

            if let Err(error) = executor_guard.execute_task(&task_id_clone, &username, &password, &company_id).await {
                eprintln!("任务执行失败: {}", error);
            }
        });

        active_tasks.insert(task_id, handle);
        Ok(())
    }

    // 取消任务执行
    pub async fn cancel_task_execution(&self, task_id: &str) -> Result<(), String> {
        let mut active_tasks = self.active_tasks.lock().await;
        
        if let Some(handle) = active_tasks.remove(task_id) {
            handle.abort();
            Ok(())
        } else {
            Err("任务未在执行中".to_string())
        }
    }

    // 获取活跃任务列表
    pub async fn get_active_tasks(&self) -> Vec<String> {
        let active_tasks = self.active_tasks.lock().await;
        active_tasks.keys().cloned().collect()
    }
}
