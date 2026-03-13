use std::time::Duration;
use tokio::time::sleep;

/// 重试配置
#[derive(Debug, Clone)]
pub struct RetryConfig {
    /// 最大重试次数
    pub max_retries: u32,
    /// 初始延迟时间（毫秒）
    pub initial_delay_ms: u64,
    /// 最大延迟时间（毫秒）
    pub max_delay_ms: u64,
    /// 退避乘数
    pub backoff_multiplier: f64,
}

impl Default for RetryConfig {
    fn default() -> Self {
        Self {
            max_retries: 3,
            initial_delay_ms: 1000,  // 1秒
            max_delay_ms: 10000,     // 10秒
            backoff_multiplier: 2.0,
        }
    }
}

/// 重试错误类型
#[derive(Debug, thiserror::Error)]
pub enum RetryError {
    #[error("重试次数已达上限: {attempts}")]
    MaxRetriesExceeded { attempts: u32 },
}

/// 执行带重试的操作
pub async fn retry_with_backoff<F, T, E>(
    operation: F,
    config: RetryConfig,
) -> Result<T, RetryError>
where
    F: Fn() -> std::pin::Pin<Box<dyn std::future::Future<Output = Result<T, E>> + Send>>,
    E: std::fmt::Display,
{
    let mut delay_ms = config.initial_delay_ms;

    for attempt in 0..=config.max_retries {
        match operation().await {
            Ok(result) => return Ok(result),
            Err(_error) => {
                if attempt == config.max_retries {
                    break;
                }

                // 计算下次延迟时间（指数退避）
                sleep(Duration::from_millis(delay_ms)).await;
                delay_ms = (delay_ms as f64 * config.backoff_multiplier) as u64;
                delay_ms = delay_ms.min(config.max_delay_ms);
            }
        }
    }

    Err(RetryError::MaxRetriesExceeded { 
        attempts: config.max_retries + 1 
    })
}


/// 为 API 调用创建重试包装器
pub async fn api_call_with_retry<F, T>(
    api_call: F,
    operation_name: &str,
) -> Result<T, String>
where
    F: Fn() -> std::pin::Pin<Box<dyn std::future::Future<Output = Result<T, String>> + Send>>,
{
    let config = RetryConfig::default();
    
    match retry_with_backoff(api_call, config).await {
        Ok(result) => Ok(result),
        Err(RetryError::MaxRetriesExceeded { attempts }) => {
            Err(format!("{} 重试 {} 次后仍然失败", operation_name, attempts))
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_retry_success_on_first_attempt() {
        let mut call_count = 0;
        let operation = || {
            call_count += 1;
            Box::pin(async move { Ok("success") })
        };

        let result = retry_with_backoff(operation, RetryConfig::default()).await;
        assert!(result.is_ok());
        assert_eq!(call_count, 1);
    }

    #[tokio::test]
    async fn test_retry_success_after_failures() {
        let mut call_count = 0;
        let operation = || {
            call_count += 1;
            Box::pin(async move {
                if call_count < 3 {
                    Err("temporary error")
                } else {
                    Ok("success")
                }
            })
        };

        let result = retry_with_backoff(operation, RetryConfig::default()).await;
        assert!(result.is_ok());
        assert_eq!(call_count, 3);
    }

    #[tokio::test]
    async fn test_retry_max_attempts_exceeded() {
        let mut call_count = 0;
        let operation = || {
            call_count += 1;
            Box::pin(async move { Err("permanent error") })
        };

        let config = RetryConfig {
            max_retries: 2,
            ..Default::default()
        };

        let result = retry_with_backoff(operation, config).await;
        assert!(result.is_err());
        assert_eq!(call_count, 3); // 1 initial + 2 retries
    }
}
