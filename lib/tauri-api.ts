// 检查是否在Tauri环境中
const isTauriEnv = () => {
  return typeof window !== 'undefined' && window.__TAURI__ && window.__TAURI__.tauri;
};

// 动态导入Tauri API
const getTauriInvoke = async () => {
  if (isTauriEnv()) {
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      return invoke;
    } catch (error) {
      console.warn('Failed to import Tauri API:', error);
      return null;
    }
  }
  return null;
};

// API基础配置
const API_BASE_URL = "https://kf.uhi-networks.com/asset-api-gateway/compAppGateWay/api";

// 直接API调用函数
const directApiCall = async (apiCode: string, body: any) => {
  console.log(`🔄 API调用: ${apiCode}`, { body });

  const response = await fetch(API_BASE_URL, {
    method: 'POST',
    mode: 'cors',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      header: { code: apiCode },
      body: body
    })
  });

  if (!response.ok) {
    console.warn(`❌ HTTP错误: ${response.status} ${response.statusText}`);
    throw new Error(`HTTP错误: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  console.log(`📥 API响应: ${apiCode}`, data);

  if (!data.body?.isSuccessful) {
    console.warn(`❌ API业务错误: ${apiCode}`, {
      errorMessage: data.header?.errorMessage,
      body: data.body
    });
    throw new Error(data.header?.errorMessage || '请求失败');
  }

  console.log(`✅ API成功: ${apiCode}`, data.body.resultData);
  return data.body.resultData;
};

// 用户认证相关类型
export interface LoginResponse {
  token: string;
  company_id: string;
  user_id: string;
}

export interface UserCredentials {
  token: string;
  company_id: string;
  user_id: string;
  username: string;
  expires_at: string;
}

// 门店查询相关类型
export interface StoreQueryResponse {
  customer_id: string;
  customer_name: string;
}

// 工单提交相关类型
export interface SubmitWorkOrderRequest {
  // 登录信息
  username: string;
  password: string;
  company_id: string;
  // 工单信息
  customer_id: string;
  customer_name: string;
  description: string;
  result: string;
  completion_time: string;
  report_time: string;
  is_remote: number;
  has_sop: number;
  sop_description: string;
}

export interface WorkOrderSubmitResponse {
  work_order_id: string;
  status: string;
}

// 门店查询请求类型
export interface QueryStoreRequest {
  customer_name: string;
  username: string;
  password: string;
  company_id: string;
}

// 任务执行请求类型
export interface ExecuteTaskRequest {
  task_id: string;
  username: string;
  password: string;
  company_id: string;
}

// 任务相关类型
export interface WorkOrderInput {
  store_name: string;
  description: string;
  result: string;
  completion_time: string;
  report_time: string;
  is_remote: number;
  has_sop: number;
  sop_description: string;
}

export interface CreateTaskRequest {
  work_orders: WorkOrderInput[];
}

export interface WorkOrder {
  store_name: string;
  description: string;
  result: string;
  completion_time: string;
  report_time: string;
  is_remote: number;
  has_sop: number;
  sop_description: string;
  status: string;
  error_message?: string;
}

export interface Task {
  id: string;
  user_id: string;
  status: 'Pending' | 'InProgress' | 'Completed' | 'Failed';
  total_count: number;
  completed_count: number;
  failed_count: number;
  created_at: string;
  updated_at: string;
  work_orders: WorkOrder[];
}

// Excel处理相关类型
export interface ExcelWorkOrder {
  store_name: string;
  description: string;
  result: string;
  completion_time: string;
  report_time: string;
  is_remote: number;
  has_sop: number;
  sop_description: string;
}

export interface ExcelParseResult {
  success: boolean;
  work_orders: ExcelWorkOrder[];
  errors: string[];
  total_rows: number;
  valid_rows: number;
}

// Tauri API 客户端类
export class TauriApiClient {
  // 用户登录
  static async login(username: string, password: string): Promise<LoginResponse> {
    try {
      const invoke = await getTauriInvoke();

      if (invoke) {
        // Tauri环境：调用Rust后端
        const response = await invoke<LoginResponse>('login', {
          username,
          password,
        });
        return response;
      } else {
        // 浏览器环境：直接调用外部API
        const result = await directApiCall('HXCS_APP_SJDL', {
          companyId: null,
          token: "",
          userName: username,
          passWord: password,
          deviceId: username,
          language: "zh",
          osType: "2"
        });

        return {
          token: result.token,
          company_id: result.companyId,
          user_id: result.userId
        };
      }
    } catch (error) {
      throw new Error(`登录失败: ${error}`);
    }
  }

  // 获取当前用户信息
  static async getCurrentUser(): Promise<UserCredentials | null> {
    try {
      const invoke = await getTauriInvoke();

      if (invoke) {
        // Tauri环境：调用Rust后端
        const response = await invoke<UserCredentials | null>('get_current_user');
        return response;
      } else {
        // 浏览器环境：从localStorage获取
        const stored = localStorage.getItem('user_credentials');
        return stored ? JSON.parse(stored) : null;
      }
    } catch (error) {
      console.error('获取用户信息失败:', error);
      return null;
    }
  }

  // 用户登出
  static async logout(): Promise<void> {
    try {
      const invoke = await getTauriInvoke();

      if (invoke) {
        // Tauri环境：调用Rust后端
        await invoke('logout');
      } else {
        // 浏览器环境：清除localStorage
        localStorage.removeItem('user_credentials');
      }
    } catch (error) {
      throw new Error(`登出失败: ${error}`);
    }
  }

  // 门店查询
  static async queryStore(request: QueryStoreRequest): Promise<StoreQueryResponse> {
    try {
      const invoke = await getTauriInvoke();

      if (invoke) {
        // Tauri环境：调用Rust后端
        const response = await invoke<StoreQueryResponse>('query_store', {
          request,
        });
        return response;
      } else {
        // 浏览器环境：先登录获取token，然后查询门店
        const loginResult = await directApiCall('HXCS_APP_SJDL', {
          companyId: null,
          token: "",
          userName: request.username,
          passWord: request.password,
          deviceId: request.username,
          language: "zh",
          osType: "2"
        });

        const storeResult = await directApiCall('HXCS_ZAPP_MDLB', {
          companyId: loginResult.companyId,
          token: loginResult.token,
          customerName: request.customer_name
        });

        return {
          customer_id: storeResult.rows?.[0]?.id || 'unknown',
          customer_name: storeResult.rows?.[0]?.name || request.customer_name
        };
      }
    } catch (error) {
      throw new Error(`门店查询失败: ${error}`);
    }
  }

  // 工单提交
  static async submitWorkOrder(request: SubmitWorkOrderRequest): Promise<WorkOrderSubmitResponse> {
    try {
      const invoke = await getTauriInvoke();

      if (invoke) {
        // Tauri环境：调用Rust后端
        const response = await invoke<WorkOrderSubmitResponse>('submit_work_order', {
          request,
        });
        return response;
      } else {
        // 浏览器环境：先登录获取token，然后提交工单
        const loginResult = await directApiCall('HXCS_APP_SJDL', {
          companyId: null,
          token: "",
          userName: request.username,
          passWord: request.password,
          deviceId: request.username,
          language: "zh",
          osType: "2"
        });

        const workOrderResult = await directApiCall('HXCS_ZAPP_FWGDTB', {
          companyId: loginResult.companyId,
          token: loginResult.token,
          customerId: request.customer_id,
          customerName: request.customer_name,
          affectRangeId: "20191126b3da41b498b675b16ced3472",
          affectRangeName: "部分功能",
          serverTypeId: "20191126b0214f0faba42f696abadbd8",
          serverTypeName: "例行维护",
          malfunctionTypeId: "20201216b38b479f86def7bf47ca922d",
          malfunctionTypeName: "海底捞(故障)",
          processesRemark: request.result,
          finishTime: request.completion_time,
          repairsTimes: request.report_time,
          isLong: request.is_remote,
          processesUrls: "",
          faultFileUrls: "",
          faultRemark: request.description,
          fromType: "5",
          isThereAnSop: request.has_sop,
          sopDescription: request.has_sop === 1 ? request.sop_description : undefined
        });

        return {
          work_order_id: workOrderResult.workOrderId || 'unknown',
          status: 'success'
        };
      }
    } catch (error) {
      throw new Error(`工单提交失败: ${error}`);
    }
  }

  // Excel文件解析
  static async parseExcelFile(filePath: string): Promise<ExcelParseResult> {
    try {
      const invoke = await getTauriInvoke();
      if (!invoke) {
        throw new Error('Tauri环境不可用');
      }
      const result = await invoke<ExcelParseResult>('parse_excel_file', {
        filePath,
      });
      return result;
    } catch (error) {
      throw new Error(`Excel文件解析失败: ${error}`);
    }
  }

  // 获取Excel模板数据
  static async getExcelTemplate(): Promise<string[][]> {
    try {
      const invoke = await getTauriInvoke();
      if (!invoke) {
        throw new Error('Tauri环境不可用');
      }
      const template = await invoke<string[][]>('get_excel_template');
      return template;
    } catch (error) {
      throw new Error(`获取Excel模板失败: ${error}`);
    }
  }

  // 创建任务
  static async createTask(request: CreateTaskRequest): Promise<string> {
    try {
      const invoke = await getTauriInvoke();
      if (!invoke) {
        throw new Error('Tauri环境不可用');
      }
      const taskId = await invoke<string>('create_task', {
        request,
      });
      return taskId;
    } catch (error) {
      throw new Error(`创建任务失败: ${error}`);
    }
  }

  // 获取任务列表
  static async getTasks(): Promise<Task[]> {
    try {
      const invoke = await getTauriInvoke();
      if (!invoke) {
        throw new Error('Tauri环境不可用');
      }
      const tasks = await invoke<Task[]>('get_tasks');
      return tasks;
    } catch (error) {
      throw new Error(`获取任务列表失败: ${error}`);
    }
  }

  // 获取任务详情
  static async getTask(taskId: string): Promise<Task | null> {
    try {
      const invoke = await getTauriInvoke();
      if (!invoke) {
        throw new Error('Tauri环境不可用');
      }
      const task = await invoke<Task | null>('get_task', {
        taskId,
      });
      return task;
    } catch (error) {
      throw new Error(`获取任务详情失败: ${error}`);
    }
  }

  // 执行任务
  static async executeTask(request: ExecuteTaskRequest): Promise<void> {
    try {
      const invoke = await getTauriInvoke();
      if (!invoke) {
        throw new Error('Tauri环境不可用');
      }
      await invoke('execute_task', {
        request,
      });
    } catch (error) {
      throw new Error(`执行任务失败: ${error}`);
    }
  }

  // 取消任务
  static async cancelTask(taskId: string): Promise<void> {
    try {
      const invoke = await getTauriInvoke();
      if (!invoke) {
        throw new Error('Tauri环境不可用');
      }
      await invoke('cancel_task', {
        taskId,
      });
    } catch (error) {
      throw new Error(`取消任务失败: ${error}`);
    }
  }

  // 获取活跃任务列表
  static async getActiveTasks(): Promise<string[]> {
    try {
      const invoke = await getTauriInvoke();
      if (!invoke) {
        throw new Error('Tauri环境不可用');
      }
      const tasks = await invoke<string[]>('get_active_tasks');
      return tasks;
    } catch (error) {
      throw new Error(`获取活跃任务失败: ${error}`);
    }
  }
}

// 导出便捷方法
export const {
  login,
  getCurrentUser,
  logout,
  queryStore,
  submitWorkOrder,
  parseExcelFile,
  getExcelTemplate,
  createTask,
  getTasks,
  getTask,
  executeTask,
  cancelTask,
  getActiveTasks,
} = TauriApiClient;
