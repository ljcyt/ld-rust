//! API 客户端模块
//! 
//! 负责与外部 API 的通信，包括用户登录、门店查询、工单提交等功能。
//! 集成了重试机制和详细的错误处理。

use crate::retry::api_call_with_retry;
use serde::{Deserialize, Serialize};

/// API 基础 URL
/// 外部工单管理系统的 API 网关地址
const API_BASE_URL: &str = "https://kf.uhi-networks.com/asset-api-gateway/compAppGateWay/api";

// 通用API请求结构
#[derive(Debug, Serialize, Deserialize)]
pub struct ApiRequest<T> {
    pub header: ApiHeader,
    pub body: T,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ApiHeader {
    pub code: String,
}

// 通用API响应结构
#[derive(Debug, Serialize, Deserialize)]
pub struct ApiResponse<T> {
    pub header: ApiResponseHeader,
    pub body: ApiResponseBody<T>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ApiResponseHeader {
    #[serde(rename = "errorMessage")]
    pub error_message: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ApiResponseBody<T> {
    #[serde(rename = "isSuccessful")]
    pub is_successful: bool,
    #[serde(rename = "resultData")]
    pub result_data: Option<T>,
}

// 登录请求体
#[derive(Debug, Serialize, Deserialize)]
pub struct LoginRequest {
    #[serde(rename = "companyId")]
    pub company_id: Option<String>,
    pub token: String,
    #[serde(rename = "userName")]
    pub user_name: String,
    #[serde(rename = "passWord")]
    pub pass_word: String,
    #[serde(rename = "deviceId")]
    pub device_id: String,
    pub language: String,
    #[serde(rename = "osType")]
    pub os_type: String,
}

// 登录响应数据
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct LoginResponse {
    pub token: String,
    #[serde(rename = "companyId")]
    pub company_id: String,
    #[serde(rename = "userId")]
    pub user_id: String,
}

// 门店查询请求体
#[derive(Debug, Serialize, Deserialize)]
pub struct StoreQueryRequest {
    #[serde(rename = "companyId")]
    pub company_id: String,
    pub token: String,
    #[serde(rename = "customerName")]
    pub customer_name: String,
}

// 门店查询响应数据
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct StoreQueryResponse {
    #[serde(rename = "customerId")]
    pub customer_id: String,
    #[serde(rename = "customerName")]
    pub customer_name: String,
}

// 工单提交请求体 - 根据API文档HXCS_ZAPP_FWGDTB的字段要求
#[derive(Debug, Serialize, Deserialize)]
pub struct WorkOrderSubmitRequest {
    #[serde(rename = "companyId")]
    pub company_id: String,
    pub token: String,
    #[serde(rename = "customerId")]
    pub customer_id: String,
    #[serde(rename = "customerName")]
    pub customer_name: String,
    // 影响范围 - 固定值
    #[serde(rename = "affectRangeId")]
    pub affect_range_id: String,
    #[serde(rename = "affectRangeName")]
    pub affect_range_name: String,
    // 服务类型 - 固定值
    #[serde(rename = "serverTypeId")]
    pub server_type_id: String,
    #[serde(rename = "serverTypeName")]
    pub server_type_name: String,
    // 故障类型 - 固定值
    #[serde(rename = "malfunctionTypeId")]
    pub malfunction_type_id: String,
    #[serde(rename = "malfunctionTypeName")]
    pub malfunction_type_name: String,
    // 处理结果
    #[serde(rename = "processesRemark")]
    pub processes_remark: String,
    // 完成时间
    #[serde(rename = "finishTime")]
    pub finish_time: String,
    // 报修时间
    #[serde(rename = "repairsTimes")]
    pub repairs_times: String,
    // 是否远程
    #[serde(rename = "isLong")]
    pub is_long: i32,
    // 处理过程文件URL - 固定空值
    #[serde(rename = "processesUrls")]
    pub processes_urls: String,
    // 故障文件URL - 固定空值
    #[serde(rename = "faultFileUrls")]
    pub fault_file_urls: String,
    // 故障描述
    #[serde(rename = "faultRemark")]
    pub fault_remark: String,
    // 来源类型 - 固定值
    #[serde(rename = "fromType")]
    pub from_type: String,
    // 是否有SOP
    #[serde(rename = "isThereAnSop")]
    pub is_there_an_sop: i32,
    // SOP流程描述 - 可选字段
    #[serde(rename = "sopDescription")]
    pub sop_description: Option<String>,
}

// 工单提交响应数据
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct WorkOrderSubmitResponse {
    #[serde(rename = "workOrderId")]
    pub work_order_id: String,
    pub status: String,
}

/// API 客户端
/// 
/// 负责管理与外部 API 的通信，包括：
/// - HTTP 客户端配置（超时、重试）
/// - 用户认证（登录、登出）
/// - 门店信息查询
/// - 工单提交
/// 
/// 所有 API 调用都集成了重试机制和详细的错误处理。
pub struct ApiClient {
    /// HTTP 客户端实例，配置了超时和重试策略
    client: reqwest::Client,
}

impl ApiClient {
    pub fn new() -> Self {
        // 创建带有超时配置的 HTTP 客户端
        let client = reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(30))  // 总超时时间：30秒
            .connect_timeout(std::time::Duration::from_secs(10))  // 连接超时：10秒
            .build()
            .expect("Failed to create HTTP client");
            
        Self { client }
    }

    // 用户登录 - 带重试机制
    pub async fn login(&self, username: &str, password: &str) -> Result<LoginResponse, String> {
        let client = self.client.clone();
        let username = username.to_string();
        let password = password.to_string();
        
        api_call_with_retry(
            move || {
                let client = client.clone();
                let username = username.clone();
                let password = password.clone();
                
                Box::pin(async move {
                    let request = ApiRequest {
                        header: ApiHeader {
                            code: "HXCS_APP_SJDL".to_string(),
                        },
                        body: LoginRequest {
                            company_id: None,
                            token: "".to_string(),
                            user_name: username.clone(),
                            pass_word: password,
                            device_id: username,
                            language: "zh".to_string(),
                            os_type: "2".to_string(),
                        },
                    };

                    let response = client
                        .post(API_BASE_URL)
                        .json(&request)
                        .send()
                        .await
                        .map_err(|e| {
                            if e.is_timeout() {
                                "登录请求超时，请检查网络连接".to_string()
                            } else if e.is_connect() {
                                "无法连接到服务器，请检查网络连接".to_string()
                            } else {
                                format!("网络请求失败: {}", e)
                            }
                        })?;

                    let status = response.status();
                    if !status.is_success() {
                        return Err(format!("服务器返回错误状态: {} {}", status.as_u16(), status.as_str()));
                    }

                    let api_response: ApiResponse<LoginResponse> = response
                        .json()
                        .await
                        .map_err(|e| format!("解析服务器响应失败: {}，可能是服务器返回了无效的JSON格式", e))?;

                    if api_response.body.is_successful {
                        api_response.body.result_data
                            .ok_or_else(|| "登录成功但服务器未返回用户数据，请联系管理员".to_string())
                    } else {
                        let error_msg = api_response.header.error_message
                            .unwrap_or_else(|| "未知错误".to_string());
                        Err(format!("登录失败: {}。请检查用户名和密码是否正确", error_msg))
                    }
                })
            },
            "用户登录"
        ).await
    }

    // 门店信息查询 - 带重试机制
    pub async fn query_store(&self, company_id: &str, token: &str, customer_name: &str) -> Result<StoreQueryResponse, String> {
        let client = self.client.clone();
        let company_id = company_id.to_string();
        let token = token.to_string();
        let customer_name = customer_name.to_string();
        let customer_name_for_log = customer_name.clone();
        
        api_call_with_retry(
            move || {
                let client = client.clone();
                let company_id = company_id.clone();
                let token = token.clone();
                let customer_name = customer_name.clone();
                
                Box::pin(async move {
                    let request = ApiRequest {
                        header: ApiHeader {
                            code: "HXCS_ZAPP_MDLB".to_string(),
                        },
                        body: StoreQueryRequest {
                            company_id,
                            token,
                            customer_name: customer_name.clone(),
                        },
                    };

                    let response = client
                        .post(API_BASE_URL)
                        .json(&request)
                        .send()
                        .await
                        .map_err(|e| {
                            if e.is_timeout() {
                                "门店查询请求超时，请检查网络连接".to_string()
                            } else if e.is_connect() {
                                "无法连接到服务器，请检查网络连接".to_string()
                            } else {
                                format!("网络请求失败: {}", e)
                            }
                        })?;

                    let status = response.status();
                    if !status.is_success() {
                        return Err(format!("服务器返回错误状态: {} {}", status.as_u16(), status.as_str()));
                    }

                    let api_response: ApiResponse<StoreQueryResponse> = response
                        .json()
                        .await
                        .map_err(|e| format!("解析服务器响应失败: {}，可能是服务器返回了无效的JSON格式", e))?;

                    if api_response.body.is_successful {
                        api_response.body.result_data
                            .ok_or_else(|| format!("门店 '{}' 查询成功但未返回数据，可能门店名称不存在", customer_name))
                    } else {
                        let error_msg = api_response.header.error_message
                            .unwrap_or_else(|| "未知错误".to_string());
                        Err(format!("门店 '{}' 查询失败: {}。请检查门店名称是否正确", customer_name, error_msg))
                    }
                })
            },
            &format!("门店查询: {}", customer_name_for_log)
        ).await
    }

    // 工单提交 - 带重试机制
    pub async fn submit_work_order(
        &self,
        company_id: &str,
        token: &str,
        customer_id: &str,
        customer_name: &str,
        fault_remark: &str,
        processes_remark: &str,
        finish_time: &str,
        repairs_times: &str,
        is_long: i32,
        is_there_an_sop: i32,
        sop_description: Option<&str>,
    ) -> Result<WorkOrderSubmitResponse, String> {
        let client = self.client.clone();
        let company_id = company_id.to_string();
        let token = token.to_string();
        let customer_id = customer_id.to_string();
        let customer_name = customer_name.to_string();
        let customer_name_for_log = customer_name.clone();
        let fault_remark = fault_remark.to_string();
        let processes_remark = processes_remark.to_string();
        let finish_time = finish_time.to_string();
        let repairs_times = repairs_times.to_string();
        let sop_description = sop_description.map(|s| s.to_string());
        
        api_call_with_retry(
            move || {
                let client = client.clone();
                let company_id = company_id.clone();
                let token = token.clone();
                let customer_id = customer_id.clone();
                let customer_name = customer_name.clone();
                let fault_remark = fault_remark.clone();
                let processes_remark = processes_remark.clone();
                let finish_time = finish_time.clone();
                let repairs_times = repairs_times.clone();
                let sop_description = sop_description.clone();
                
                Box::pin(async move {
                    let request = ApiRequest {
                        header: ApiHeader {
                            code: "HXCS_ZAPP_FWGDTB".to_string(),
                        },
                        body: WorkOrderSubmitRequest {
                            company_id,
                            token,
                            customer_id,
                            customer_name: customer_name.clone(),
                            // 影响范围 - 固定值
                            affect_range_id: "20191126b3da41b498b675b16ced3472".to_string(),
                            affect_range_name: "部分功能".to_string(),
                            // 服务类型 - 固定值
                            server_type_id: "20191126b0214f0faba42f696abadbd8".to_string(),
                            server_type_name: "例行维护".to_string(),
                            // 故障类型 - 固定值
                            malfunction_type_id: "20201216b38b479f86def7bf47ca922d".to_string(),
                            malfunction_type_name: "海底捞(故障)".to_string(),
                            // 处理结果
                            processes_remark,
                            // 完成时间
                            finish_time,
                            // 报修时间
                            repairs_times,
                            // 是否远程
                            is_long,
                            // 处理过程文件URL - 固定空值
                            processes_urls: "".to_string(),
                            // 故障文件URL - 固定空值
                            fault_file_urls: "".to_string(),
                            // 故障描述
                            fault_remark,
                            // 来源类型 - 固定值
                            from_type: "5".to_string(),
                            // 是否有SOP
                            is_there_an_sop,
                            // SOP流程描述 - 可选字段
                            sop_description,
                        },
                    };

                    let response = client
                        .post(API_BASE_URL)
                        .json(&request)
                        .send()
                        .await
                        .map_err(|e| {
                            if e.is_timeout() {
                                "工单提交请求超时，请检查网络连接".to_string()
                            } else if e.is_connect() {
                                "无法连接到服务器，请检查网络连接".to_string()
                            } else {
                                format!("网络请求失败: {}", e)
                            }
                        })?;

                    let status = response.status();
                    if !status.is_success() {
                        return Err(format!("服务器返回错误状态: {} {}", status.as_u16(), status.as_str()));
                    }

                    let api_response: ApiResponse<WorkOrderSubmitResponse> = response
                        .json()
                        .await
                        .map_err(|e| format!("解析服务器响应失败: {}，可能是服务器返回了无效的JSON格式", e))?;

                    if api_response.body.is_successful {
                        api_response.body.result_data
                            .ok_or_else(|| format!("门店 '{}' 工单提交成功但未返回工单ID，请联系管理员", customer_name.clone()))
                    } else {
                        let error_msg = api_response.header.error_message
                            .unwrap_or_else(|| "未知错误".to_string());
                        Err(format!("门店 '{}' 工单提交失败: {}。请检查工单数据是否正确", customer_name.clone(), error_msg))
                    }
                })
            },
            &format!("工单提交: {}", customer_name_for_log)
        ).await
    }
}
