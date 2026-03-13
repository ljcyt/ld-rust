use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use chrono::{DateTime, Utc, Datelike};

// 用户凭证结构
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct UserCredentials {
    pub token: String,
    pub company_id: String,
    pub user_id: String,
    pub username: String,
    pub expires_at: DateTime<Utc>,
}

// 任务状态枚举
#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
pub enum TaskStatus {
    Pending,
    InProgress,
    Completed,
    Failed,
}

// 任务数据结构
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Task {
    pub id: String,
    pub user_id: String,
    pub status: TaskStatus,
    pub total_count: usize,
    pub completed_count: usize,
    pub failed_count: usize,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub work_orders: Vec<WorkOrder>,
}

// 工单数据结构
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct WorkOrder {
    pub store_name: String,
    pub description: String,
    pub result: String,
    pub completion_time: String,
    pub report_time: String,
    pub is_remote: i32,
    pub has_sop: i32,
    pub sop_description: String,
    pub status: String, // "pending", "success", "failed"
    pub error_message: Option<String>,
}

// 统计数据结构
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct WorkOrderStats {
    #[serde(rename = "totalProcessed")]
    pub total_processed: u32,
    #[serde(rename = "totalSuccess")]
    pub total_success: u32,
    #[serde(rename = "totalFailed")]
    pub total_failed: u32,
    #[serde(rename = "successRate")]
    pub success_rate: f64,
    #[serde(rename = "todayProcessed")]
    pub today_processed: u32,
    #[serde(rename = "todaySuccess")]
    pub today_success: u32,
    #[serde(rename = "thisWeekProcessed")]
    pub this_week_processed: u32,
    #[serde(rename = "thisWeekSuccess")]
    pub this_week_success: u32,
    #[serde(rename = "thisMonthProcessed")]
    pub this_month_processed: u32,
    #[serde(rename = "thisMonthSuccess")]
    pub this_month_success: u32,
    #[serde(rename = "lastUpdated")]
    pub last_updated: String,
}

// 统计日志条目
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct StatsLogEntry {
    pub timestamp: String,
    pub action: String, // "success", "failed"
    pub count: u32,
}

// 存储管理器
pub struct StorageManager {
    app_data_dir: PathBuf,
}

impl StorageManager {
    pub fn new() -> Result<Self, String> {
        let app_data_dir = dirs::data_dir()
            .ok_or("无法获取应用数据目录")?
            .join("haidilao-workorder");

        // 确保目录存在
        fs::create_dir_all(&app_data_dir)
            .map_err(|e| format!("创建应用数据目录失败: {}", e))?;

        Ok(Self { app_data_dir })
    }

    // 保存用户凭证
    pub fn save_credentials(&self, credentials: &UserCredentials) -> Result<(), String> {
        let credentials_path = self.app_data_dir.join("credentials.json");
        let json = serde_json::to_string_pretty(credentials)
            .map_err(|e| format!("序列化凭证失败: {}", e))?;
        
        fs::write(credentials_path, json)
            .map_err(|e| format!("保存凭证失败: {}", e))
    }

    // 加载用户凭证
    pub fn load_credentials(&self) -> Result<Option<UserCredentials>, String> {
        let credentials_path = self.app_data_dir.join("credentials.json");
        
        if !credentials_path.exists() {
            return Ok(None);
        }

        let json = fs::read_to_string(credentials_path)
            .map_err(|e| format!("读取凭证文件失败: {}", e))?;
        
        let credentials: UserCredentials = serde_json::from_str(&json)
            .map_err(|e| format!("解析凭证失败: {}", e))?;

        // 检查是否过期
        if credentials.expires_at < Utc::now() {
            return Ok(None);
        }

        Ok(Some(credentials))
    }

    // 清除用户凭证
    pub fn clear_credentials(&self) -> Result<(), String> {
        let credentials_path = self.app_data_dir.join("credentials.json");
        
        if credentials_path.exists() {
            fs::remove_file(credentials_path)
                .map_err(|e| format!("删除凭证文件失败: {}", e))?;
        }

        Ok(())
    }

    // 保存任务
    pub fn save_task(&self, task: &Task) -> Result<(), String> {
        let tasks_dir = self.app_data_dir.join("tasks");
        fs::create_dir_all(&tasks_dir)
            .map_err(|e| format!("创建任务目录失败: {}", e))?;

        let task_path = tasks_dir.join(format!("{}.json", task.id));
        let json = serde_json::to_string_pretty(task)
            .map_err(|e| format!("序列化任务失败: {}", e))?;
        
        fs::write(task_path, json)
            .map_err(|e| format!("保存任务失败: {}", e))
    }

    // 加载任务
    pub fn load_task(&self, task_id: &str) -> Result<Option<Task>, String> {
        let task_path = self.app_data_dir.join("tasks").join(format!("{}.json", task_id));
        
        if !task_path.exists() {
            return Ok(None);
        }

        let json = fs::read_to_string(task_path)
            .map_err(|e| format!("读取任务文件失败: {}", e))?;
        
        let task: Task = serde_json::from_str(&json)
            .map_err(|e| format!("解析任务失败: {}", e))?;

        Ok(Some(task))
    }

    // 获取用户的所有任务
    pub fn get_user_tasks(&self, user_id: &str) -> Result<Vec<Task>, String> {
        let tasks_dir = self.app_data_dir.join("tasks");
        
        if !tasks_dir.exists() {
            return Ok(Vec::new());
        }

        let mut tasks = Vec::new();
        let entries = fs::read_dir(tasks_dir)
            .map_err(|e| format!("读取任务目录失败: {}", e))?;

        for entry in entries {
            let entry = entry.map_err(|e| format!("读取目录项失败: {}", e))?;
            let path = entry.path();
            
            if path.extension().and_then(|s| s.to_str()) == Some("json") {
                let json = fs::read_to_string(&path)
                    .map_err(|e| format!("读取任务文件失败: {}", e))?;
                
                if let Ok(task) = serde_json::from_str::<Task>(&json) {
                    if task.user_id == user_id {
                        tasks.push(task);
                    }
                }
            }
        }

        // 按创建时间排序
        tasks.sort_by(|a, b| b.created_at.cmp(&a.created_at));
        Ok(tasks)
    }

    // 获取统计数据日志文件路径
    fn get_stats_log_path(&self) -> PathBuf {
        // 统一使用应用数据目录，避免在用户主目录创建文件
        self.app_data_dir.join("ld.log")
    }

    // 迁移旧的日志文件到新位置
    fn migrate_old_log_file(&self) -> Result<(), String> {
        // 检查Windows用户主目录中的旧日志文件
        if cfg!(target_os = "windows") {
            if let Some(user_profile) = std::env::var_os("USERPROFILE") {
                let old_log_path = PathBuf::from(user_profile).join("ld.log");
                let new_log_path = self.get_stats_log_path();
                
                // 如果旧文件存在且新文件不存在，则迁移
                if old_log_path.exists() && !new_log_path.exists() {
                    fs::copy(&old_log_path, &new_log_path)
                        .map_err(|e| format!("迁移日志文件失败: {}", e))?;
                    
                    // 可选：删除旧文件（注释掉以保留备份）
                    // fs::remove_file(&old_log_path)
                    //     .map_err(|e| format!("删除旧日志文件失败: {}", e))?;
                    
                    println!("已迁移日志文件从 {:?} 到 {:?}", old_log_path, new_log_path);
                }
            }
        }
        Ok(())
    }

    // 记录统计数据
    pub fn log_stats(&self, success_count: u32, failed_count: u32) -> Result<(), String> {
        let log_path = self.get_stats_log_path();
        let now = Utc::now().format("%Y-%m-%d %H:%M:%S").to_string();
        
        // 使用更健壮的文件写入方式
        let mut entries = Vec::new();
        
        if success_count > 0 {
            entries.push(StatsLogEntry {
                timestamp: now.clone(),
                action: "success".to_string(),
                count: success_count,
            });
        }

        if failed_count > 0 {
            entries.push(StatsLogEntry {
                timestamp: now,
                action: "failed".to_string(),
                count: failed_count,
            });
        }

        // 使用原子写入方式，避免文件损坏
        if !entries.is_empty() {
            let mut content = String::new();
            
            // 如果文件存在，先读取现有内容
            if log_path.exists() {
                content = fs::read_to_string(&log_path)
                    .map_err(|e| format!("读取统计日志文件失败: {}", e))?;
                
                // 确保内容以换行符结尾
                if !content.is_empty() && !content.ends_with('\n') {
                    content.push('\n');
                }
            }
            
            // 添加新的条目
            for entry in entries {
                let json_line = serde_json::to_string(&entry)
                    .map_err(|e| format!("序列化统计条目失败: {}", e))?;
                content.push_str(&json_line);
                content.push('\n');
            }
            
            // 原子写入整个文件
            fs::write(&log_path, content)
                .map_err(|e| format!("写入统计日志文件失败: {}", e))?;
        }

        Ok(())
    }

    // 读取统计数据
    pub fn load_stats(&self) -> Result<WorkOrderStats, String> {
        // 先尝试迁移旧的日志文件
        if let Err(e) = self.migrate_old_log_file() {
            println!("迁移日志文件时出现警告: {}", e);
        }
        
        let log_path = self.get_stats_log_path();
        
        if !log_path.exists() {
            return Ok(WorkOrderStats {
                total_processed: 0,
                total_success: 0,
                total_failed: 0,
                success_rate: 0.0,
                today_processed: 0,
                today_success: 0,
                this_week_processed: 0,
                this_week_success: 0,
                this_month_processed: 0,
                this_month_success: 0,
                last_updated: Utc::now().to_rfc3339(),
            });
        }

        let content = fs::read_to_string(&log_path)
            .map_err(|e| format!("读取统计日志文件失败: {}", e))?;
        
        let mut total_success = 0u32;
        let mut total_failed = 0u32;
        let mut today_success = 0u32;
        let mut today_failed = 0u32;
        let mut week_success = 0u32;
        let mut week_failed = 0u32;
        let mut month_success = 0u32;
        let mut month_failed = 0u32;

        let now = Utc::now();
        let today = now.date_naive();
        let week_start = now.date_naive() - chrono::Duration::days(now.weekday().num_days_from_monday() as i64);
        let month_start = chrono::NaiveDate::from_ymd_opt(now.year(), now.month(), 1).unwrap();

        for line in content.lines() {
            if line.trim().is_empty() {
                continue;
            }

            let entry: StatsLogEntry = serde_json::from_str(line)
                .map_err(|e| format!("解析统计日志条目失败: {}", e))?;

            let entry_date = chrono::NaiveDateTime::parse_from_str(&entry.timestamp, "%Y-%m-%d %H:%M:%S")
                .map_err(|e| format!("解析时间戳失败: {}", e))?
                .date();

            match entry.action.as_str() {
                "success" => {
                    total_success += entry.count;
                    if entry_date == today {
                        today_success += entry.count;
                    }
                    if entry_date >= week_start {
                        week_success += entry.count;
                    }
                    if entry_date >= month_start {
                        month_success += entry.count;
                    }
                }
                "failed" => {
                    total_failed += entry.count;
                    if entry_date == today {
                        today_failed += entry.count;
                    }
                    if entry_date >= week_start {
                        week_failed += entry.count;
                    }
                    if entry_date >= month_start {
                        month_failed += entry.count;
                    }
                }
                _ => {}
            }
        }

        let total_processed = total_success + total_failed;
        let success_rate = if total_processed > 0 {
            (total_success as f64 / total_processed as f64) * 100.0
        } else {
            0.0
        };

        Ok(WorkOrderStats {
            total_processed,
            total_success,
            total_failed,
            success_rate,
            today_processed: today_success + today_failed,
            today_success,
            this_week_processed: week_success + week_failed,
            this_week_success: week_success,
            this_month_processed: month_success + month_failed,
            this_month_success: month_success,
            last_updated: Utc::now().to_rfc3339(),
        })
    }

    // 重置统计数据
    pub fn reset_stats(&self) -> Result<(), String> {
        let log_path = self.get_stats_log_path();
        if log_path.exists() {
            fs::remove_file(&log_path)
                .map_err(|e| format!("删除统计日志文件失败: {}", e))?;
        }
        Ok(())
    }
}
