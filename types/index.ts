// 统一类型定义文件
// 用于整合前端分散的类型定义，确保前后端类型一致性

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

export interface StoreInfo {
  customerId: string;
  customerName: string;
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
  status?: 'pending' | 'success' | 'failed' | 'cancelled';
  error_message?: string;
}

export interface Task {
  id: string;
  user_id: string;
  status: 'Pending' | 'InProgress' | 'Completed' | 'Failed' | 'Cancelled';
  total_count: number;
  completed_count: number;
  failed_count: number;
  created_at: string;
  updated_at: string;
  work_orders: WorkOrder[];
}

export interface TaskProgressEvent {
  taskId: string;
  eventType: 'progress' | 'store_query_success' | 'store_query_failed' | 'work_order_success' | 'work_order_failed' | 'delay' | 'completed' | 'failed' | 'cancelled';
  current_index: number;
  total_count: number;
  completed_count: number;
  failed_count: number;
  current_work_order?: string;
  message: string;
  timestamp: string;
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

// 提交结果类型
export interface SubmissionResult {
  id: string;
  storeName: string;
  description: string;
  status: "success" | "error";
  timestamp: Date;
  error?: string;
}

// 批量任务类型
export interface BatchTask {
  id: string;
  taskId: string;
  date: string;
  progress: number;
  completed: number;
  total: number;
  status: "pending" | "processing" | "completed" | "failed";
  currentBatch?: number;
  totalBatches?: number;
  batchSize?: number;
  startTime?: Date;
  estimatedEndTime?: Date;
  details?: SubmissionResult[];
}

// 统计数据相关类型
export interface WorkOrderStats {
  totalProcessed: number;
  totalSuccess: number;
  totalFailed: number;
  successRate: number;
  todayProcessed: number;
  todaySuccess: number;
  thisWeekProcessed: number;
  thisWeekSuccess: number;
  thisMonthProcessed: number;
  thisMonthSuccess: number;
  lastUpdated: string;
}

export interface DailyStats {
  date: string;
  processed: number;
  success: number;
  failed: number;
}

export interface WeeklyStats {
  week: string;
  processed: number;
  success: number;
  failed: number;
}

