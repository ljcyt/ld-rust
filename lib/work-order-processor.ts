// 工单处理业务逻辑
// 将工单处理逻辑从主组件中提取出来

import { TauriApiClient } from '@/lib/tauri-api';
import { UserCredentials, ExcelWorkOrder, SubmissionResult } from '@/types';

const isMockSubmitEnabled = (): boolean => {
  if (typeof window !== 'undefined') {
    return window.localStorage.getItem('mock_submit_enabled') === '1';
  }
  return typeof process !== 'undefined'
    && process.env
    && process.env.NEXT_PUBLIC_MOCK_SUBMIT === '1';
};

/**
 * 随机延迟函数
 * @param min - 最小延迟秒数
 * @param max - 最大延迟秒数
 * @param onTick - 倒计时回调函数
 * @returns Promise<void>
 */
export const randomDelay = (
  min: number,
  max: number,
  onTick?: (remaining: number) => void,
  shouldCancel?: () => boolean
): Promise<void> => {
  const delay = Math.floor(Math.random() * (max - min + 1)) + min;
  console.log(`⏱️ 等待 ${delay} 秒...`);
  
  return new Promise(resolve => {
    let remaining = delay;
    
    const interval = setInterval(() => {
      if (shouldCancel && shouldCancel()) {
        clearInterval(interval);
        resolve();
        return;
      }

      remaining--;
      if (onTick) {
        onTick(remaining);
      }
      
      if (remaining <= 0) {
        clearInterval(interval);
        resolve();
      }
    }, 1000);
  });
};

/**
 * 处理单个工单
 * @param workOrder - Excel工单数据
 * @param user - 用户凭证
 * @param password - 用户密码
 * @param index - 工单索引
 * @returns Promise<SubmissionResult> - 处理结果
 */
export const processSingleWorkOrder = async (
  workOrder: ExcelWorkOrder,
  user: UserCredentials,
  password: string,
  index: number
): Promise<SubmissionResult> => {
  try {
    if (isMockSubmitEnabled()) {
      return {
        id: `mock-${Date.now()}-${index}`,
        storeName: workOrder.store_name,
        description: workOrder.description,
        status: "success",
        timestamp: new Date(),
      };
    }

    // 查询门店获取客户ID
    console.log(`🏪 查询门店: ${workOrder.store_name}`);
    const storeResult = await TauriApiClient.queryStore({
      customer_name: workOrder.store_name,
      username: user.username,
      password: password,
      company_id: user.company_id
    });
    console.log(`✅ 门店查询成功:`, storeResult);

    // 提交工单
    console.log(`📝 提交工单: ${workOrder.store_name}`);
    const submitResult = await TauriApiClient.submitWorkOrder({
      username: user.username,
      password: password,
      company_id: user.company_id,
      customer_id: storeResult.customer_id,
      customer_name: storeResult.customer_name,
      description: workOrder.description,
      result: workOrder.result || "已处理完成",
      completion_time: workOrder.completion_time || new Date().toISOString(),
      report_time: workOrder.report_time || new Date().toISOString(),
      is_remote: workOrder.is_remote !== undefined ? workOrder.is_remote : 0,
      has_sop: workOrder.has_sop !== undefined ? workOrder.has_sop : 1,
      sop_description: workOrder.sop_description || "按标准流程处理"
    });

    console.log(`🔍 API提交参数检查:`);
    console.log(`  workOrder.is_remote: ${workOrder.is_remote} (类型: ${typeof workOrder.is_remote})`);
    console.log(`  workOrder.has_sop: ${workOrder.has_sop} (类型: ${typeof workOrder.has_sop})`);
    console.log(`  最终API参数 is_remote: ${workOrder.is_remote !== undefined ? workOrder.is_remote : 0}`);
    console.log(`  最终API参数 has_sop: ${workOrder.has_sop !== undefined ? workOrder.has_sop : 1}`);

    console.log(`✅ 工单提交成功:`, submitResult);

    return {
      id: submitResult.work_order_id,
      storeName: workOrder.store_name,
      description: workOrder.description,
      status: "success",
      timestamp: new Date(),
    };
  } catch (error) {
    console.error(`❌ 处理失败: ${workOrder.store_name}`, error);
    return {
      id: `error-${index}`,
      storeName: workOrder.store_name,
      description: workOrder.description,
      status: "error",
      timestamp: new Date(),
      error: error instanceof Error ? error.message : '处理失败'
    };
  }
};

/**
 * 计算直接提交预计时间
 * @param totalOrders - 总工单数
 * @returns 预计总时间（秒）
 */
export const calculateDirectEstimatedTime = (totalOrders: number): number => {
  const estimatedProcessingTime = totalOrders * 3; // 假设每个工单处理3秒
  const estimatedDelayTime = (totalOrders - 1) * 2; // 工单间2秒延迟
  return Math.round(estimatedProcessingTime + estimatedDelayTime);
};

/**
 * 直接提交模式 - 顺序处理（避免API并发限制）
 * @param excelData - Excel工单数据数组
 * @param user - 用户凭证
 * @param password - 用户密码
 * @param results - 结果数组（会被修改）
 * @param onTick - 倒计时回调函数
 * @param onProgress - 进度更新回调函数
 */
export const processDirectSubmit = async (
  excelData: ExcelWorkOrder[],
  user: UserCredentials,
  password: string,
  results: SubmissionResult[],
  onTick?: (remaining: number, message: string) => void,
  onProgress?: (completedOrders: number, totalOrders: number) => void
): Promise<void> => {
  console.log("🚀 直接提交模式：顺序处理所有工单");

  for (let i = 0; i < excelData.length; i++) {
    const workOrder = excelData[i];
    console.log(`🔄 处理第${i + 1}条数据: ${workOrder.store_name}`);

    const result = await processSingleWorkOrder(workOrder, user, password, i);
    results.push(result);

    // 更新进度
    if (onProgress) {
      onProgress(i + 1, excelData.length);
    }

    // 添加短暂延迟避免API限流（比分批提交更短）
    if (i < excelData.length - 1) {
      await randomDelay(1, 3, (remaining) => {
        if (onTick) {
          onTick(remaining, `工单间等待: ${workOrder.store_name}`);
        }
      });
    }
  }
};

/**
 * 计算分批提交预计时间
 * @param totalOrders - 总工单数
 * @param batchSize - 批次大小
 * @param minDelay - 最小延迟秒数
 * @param maxDelay - 最大延迟秒数
 * @returns 预计总时间（秒）
 */
export const calculateEstimatedTime = (totalOrders: number, batchSize: number, minDelay: number, maxDelay: number): number => {
  const totalBatches = Math.ceil(totalOrders / batchSize);
  const avgDelay = (minDelay + maxDelay) / 2;
  const estimatedProcessingTime = totalOrders * 3; // 假设每个工单处理3秒
  const estimatedDelayTime = (totalBatches - 1) * avgDelay; // 批次间延迟
  return Math.round(estimatedProcessingTime + estimatedDelayTime);
};

/**
 * 分批提交模式 - 后台处理
 * @param excelData - Excel工单数据数组
 * @param user - 用户凭证
 * @param password - 用户密码
 * @param taskId - 任务ID
 * @param batchSize - 批次大小
 * @param results - 结果数组（会被修改）
 * @param onTick - 倒计时回调函数
 * @param onProgress - 进度更新回调函数
 */
export const processBatchSubmitBackground = async (
  excelData: ExcelWorkOrder[],
  user: UserCredentials,
  password: string,
  taskId: string,
  batchSize: number,
  results: SubmissionResult[],
  onTick?: (remaining: number, message: string) => void,
  onProgress?: (currentBatch: number, totalBatches: number, completedOrders: number, totalOrders: number) => void,
  shouldCancel?: () => boolean
): Promise<void> => {
  console.log(`🚀 分批提交模式：每批处理 ${batchSize} 个工单`);

  const totalBatches = Math.ceil(excelData.length / batchSize);
  console.log(`📊 总共需要处理 ${totalBatches} 个批次`);

  for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
    if (shouldCancel && shouldCancel()) {
      console.log('🛑 分批提交已取消');
      break;
    }
    const startIndex = batchIndex * batchSize;
    const endIndex = Math.min(startIndex + batchSize, excelData.length);
    const batchData = excelData.slice(startIndex, endIndex);

    console.log(`🔄 处理第 ${batchIndex + 1}/${totalBatches} 批次 (${startIndex + 1}-${endIndex})`);

    // 更新进度 - 批次开始
    if (onProgress) {
      onProgress(batchIndex + 1, totalBatches, startIndex, excelData.length);
    }

    // 处理当前批次
    for (let i = 0; i < batchData.length; i++) {
      if (shouldCancel && shouldCancel()) {
        console.log('🛑 分批提交已取消');
        return;
      }
      const workOrder = batchData[i];
      const globalIndex = startIndex + i;
      console.log(`📝 处理第 ${globalIndex + 1} 条数据: ${workOrder.store_name}`);

      const result = await processSingleWorkOrder(workOrder, user, password, globalIndex);
      results.push(result);

      // 更新进度 - 工单完成
      if (onProgress) {
        onProgress(batchIndex + 1, totalBatches, globalIndex + 1, excelData.length);
      }

      // 工单间延迟（10-30秒）
      if (i < batchData.length - 1) {
        await randomDelay(10, 30, (remaining) => {
          if (onTick) {
            onTick(remaining, `工单间等待: ${workOrder.store_name}`);
          }
        }, shouldCancel);
      }
    }

    // 批次间延迟（30-70秒）
    if (batchIndex < totalBatches - 1) {
      console.log(`⏳ 批次间等待...`);
      await randomDelay(30, 70, (remaining) => {
        if (onTick) {
          onTick(remaining, `批次间等待: 第${batchIndex + 1}/${totalBatches}批次`);
        }
      }, shouldCancel);
    }
  }

  console.log(`✅ 所有批次处理完成`);
};

/**
 * 计算任务进度
 * @param completed - 已完成数量
 * @param total - 总数量
 * @returns 进度百分比
 */
export const calculateProgress = (completed: number, total: number): number => {
  if (total === 0) return 0;
  return Math.round((completed / total) * 100);
};

/**
 * 生成任务摘要
 * @param results - 提交结果数组
 * @returns 任务摘要信息
 */
export const generateTaskSummary = (results: SubmissionResult[]) => {
  const successCount = results.filter(r => r.status === 'success').length;
  const errorCount = results.filter(r => r.status === 'error').length;
  const totalCount = results.length;

  return {
    successCount,
    errorCount,
    totalCount,
    successRate: totalCount > 0 ? Math.round((successCount / totalCount) * 100) : 0,
    hasErrors: errorCount > 0,
    errors: results.filter(r => r.status === 'error').map(r => ({
      storeName: r.storeName,
      error: r.error
    }))
  };
};
