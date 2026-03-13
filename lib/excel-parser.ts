// Excel 解析工具
// 将 Excel 解析逻辑从主组件中提取出来

import * as XLSX from 'xlsx';
import { ExcelWorkOrder } from '@/types';

/**
 * 时间格式化函数 - 确保输出格式为 YYYY-MM-DD HH:mm:ss
 * @param dateValue - 日期值（可能是字符串、数字或Date对象）
 * @returns 格式化后的时间字符串
 */
export const formatExcelDate = (dateValue: any): string => {
  try {
    let date: Date;

    // 如果已经是正确格式的字符串，直接返回
    if (typeof dateValue === 'string' && /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(dateValue)) {
      return dateValue;
    }

    // 如果是Excel序列号（数字）
    if (typeof dateValue === 'number') {
      // Excel日期序列号转换（1900年1月1日为基准）
      date = new Date((dateValue - 25569) * 86400 * 1000);
    } else if (typeof dateValue === 'string') {
      // 尝试解析字符串日期
      date = new Date(dateValue);
    } else if (dateValue instanceof Date) {
      date = dateValue;
    } else {
      // 无法解析，使用当前时间
      date = new Date();
    }

    // 检查日期是否有效
    if (isNaN(date.getTime())) {
      date = new Date();
    }

    // 格式化为 YYYY-MM-DD HH:mm:ss
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');

    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
  } catch (error) {
    console.warn('时间格式化失败，使用当前时间:', error);
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');

    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
  }
};

/**
 * Excel文件解析函数
 * @param file - Excel文件对象
 * @returns Promise<ExcelWorkOrder[]> - 解析后的工单数据数组
 */
export const parseExcelFile = async (file: File): Promise<ExcelWorkOrder[]> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        if (!data) {
          reject(new Error('文件读取失败'));
          return;
        }

        // 使用xlsx库解析Excel文件
        const workbook = XLSX.read(data, { type: 'array' });

        // 检查是否有工作表
        if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
          reject(new Error('Excel文件中没有找到工作表'));
          return;
        }

        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];

        // 检查工作表是否存在
        if (!worksheet) {
          reject(new Error('无法读取Excel工作表'));
          return;
        }

        // 将工作表转换为JSON数组
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

        console.log('Excel原始数据:', jsonData);

        // 解析Excel数据，跳过标题行
        const excelData: ExcelWorkOrder[] = [];

        for (let i = 1; i < jsonData.length; i++) {
          const row = jsonData[i] as any[];

          // 跳过空行和验证基本数据结构
          if (!row || row.length === 0 || !row[0] || !row[1]) {
            console.log(`跳过第${i}行：缺少必要数据`);
            continue;
          }

          // 验证关键字段的数据类型
          const hasValidSop = row[3] === undefined || row[3] === null || row[3] === '' || !isNaN(Number(row[3]));
          const hasValidRemote = row[5] === undefined || row[5] === null || row[5] === '' || !isNaN(Number(row[5]));

          if (!hasValidSop || !hasValidRemote) {
            console.warn(`第${i}行数据类型无效：is_remote=${row[5]}, has_sop=${row[3]}`);
            continue;
          }

          // 根据Excel格式解析数据
          // 正确的列顺序：报修用户、故障描述、处理结果、是否有sop(1是/0否)、sop流程描述、是否远程(0是/1否)、报修时间、完成时间
          const workOrder: ExcelWorkOrder = {
            store_name: String(row[0] || '').trim(),
            description: String(row[1] || '').trim(),
            result: String(row[2] || '已完成修改').trim(),
            has_sop: (row[3] !== undefined && row[3] !== null && row[3] !== '') ? Number(row[3]) : 1,
            sop_description: String(row[4] || '按标准流程处理').trim(),
            is_remote: (row[5] !== undefined && row[5] !== null && row[5] !== '') ? Number(row[5]) : 0,
            report_time: row[6] ? formatExcelDate(row[6]) : formatExcelDate(new Date()),
            completion_time: row[7] ? formatExcelDate(row[7]) : formatExcelDate(new Date())
          };

          console.log(`解析第${i}行数据:`, workOrder);
          console.log(`  原始has_sop值: ${row[3]} (类型: ${typeof row[3]}) [列D: 是否有sop]`);
          console.log(`  原始is_remote值: ${row[5]} (类型: ${typeof row[5]}) [列F: 是否远程]`);
          console.log(`  原始report_time值: ${row[6]} (类型: ${typeof row[6]}) [列G: 报修时间]`);
          console.log(`  原始completion_time值: ${row[7]} (类型: ${typeof row[7]}) [列H: 完成时间]`);
          console.log(`  最终has_sop值: ${workOrder.has_sop}`);
          console.log(`  最终is_remote值: ${workOrder.is_remote}`);
          console.log(`  最终report_time值: ${workOrder.report_time}`);
          console.log(`  最终completion_time值: ${workOrder.completion_time}`);

          // 只添加有效的工单数据
          if (workOrder.store_name && workOrder.description) {
            excelData.push(workOrder);
          }
        }

        console.log('最终解析的Excel数据:', excelData);
        resolve(excelData);
      } catch (error) {
        console.error('Excel解析错误:', error);
        reject(error);
      }
    };

    reader.onerror = () => reject(new Error('文件读取失败'));
    reader.readAsArrayBuffer(file);
  });
};

/**
 * 验证文件类型和大小
 * @param file - 文件对象
 * @returns 错误信息字符串，空字符串表示验证通过
 */
export const validateFile = (file: File): string => {
  const maxSize = 10 * 1024 * 1024; // 10MB
  const allowedTypes = [
    "text/csv",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/json",
  ];

  if (file.size > maxSize) {
    return "文件大小不能超过 10MB";
  }

  // 更严格的文件类型检查：必须同时满足MIME类型和扩展名
  const hasValidMimeType = allowedTypes.includes(file.type);
  const hasValidExtension = /\.(csv|xlsx|xls|json)$/i.test(file.name);

  if (!hasValidMimeType || !hasValidExtension) {
    return "仅支持 CSV、Excel 和 JSON 格式文件，请确保文件类型正确";
  }

  return "";
};
