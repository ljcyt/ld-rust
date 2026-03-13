//! Excel 文件处理模块
//! 
//! 负责解析 Excel 文件中的工单数据，包括：
//! - Excel 文件读取和解析
//! - 数据验证和格式化
//! - 时间格式统一处理
//! - 模板数据生成

use calamine::{open_workbook, Reader, Xlsx};
use serde::{Deserialize, Serialize};
use std::path::Path;

// Excel工单数据结构
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ExcelWorkOrder {
    pub store_name: String,
    pub description: String,
    pub result: String,
    pub completion_time: String,
    pub report_time: String,
    pub is_remote: i32,
    pub has_sop: i32,
    pub sop_description: String,
}

// Excel解析结果
#[derive(Debug, Serialize, Deserialize)]
pub struct ExcelParseResult {
    pub success: bool,
    pub work_orders: Vec<ExcelWorkOrder>,
    pub errors: Vec<String>,
    pub total_rows: usize,
    pub valid_rows: usize,
}

// Excel处理器
/// Excel 处理器
/// 
/// 负责解析和处理 Excel 文件中的工单数据。
/// 支持多种时间格式的解析和验证，确保数据质量。
pub struct ExcelProcessor;

impl ExcelProcessor {
    pub fn new() -> Self {
        Self
    }

    // 解析Excel文件
    pub fn parse_excel_file<P: AsRef<Path>>(
        &self,
        file_path: P,
    ) -> Result<ExcelParseResult, String> {
        let mut workbook: Xlsx<_> = open_workbook(file_path)
            .map_err(|e| format!("无法打开Excel文件: {}", e))?;

        // 获取第一个工作表
        let worksheet_names = workbook.sheet_names().to_owned();
        if worksheet_names.is_empty() {
            return Err("Excel文件中没有工作表".to_string());
        }

        let sheet_name = &worksheet_names[0];
        let range = workbook
            .worksheet_range(sheet_name)
            .map_err(|e| format!("无法读取工作表 '{}': {}", sheet_name, e))?;

        let mut work_orders = Vec::new();
        let mut errors = Vec::new();
        let mut valid_rows = 0;
        let total_rows = range.height();

        // 跳过标题行，从第二行开始处理
        for (row_idx, row) in range.rows().enumerate().skip(1) {
            let row_number = row_idx + 1;

            match self.parse_row(row, row_number) {
                Ok(work_order) => {
                    work_orders.push(work_order);
                    valid_rows += 1;
                }
                Err(error) => {
                    errors.push(format!("第{}行: {}", row_number, error));
                }
            }
        }

        Ok(ExcelParseResult {
            success: errors.is_empty(),
            work_orders,
            errors,
            total_rows,
            valid_rows,
        })
    }

    // 解析单行数据
    fn parse_row(
        &self,
        row: &[calamine::Data],
        _row_number: usize,
    ) -> Result<ExcelWorkOrder, String> {
        if row.len() < 8 {
            return Err(format!("列数不足，需要至少8列，实际{}列", row.len()));
        }

        // 解析各列数据
        let store_name = self.get_string_value(&row[0], "门店名称")?;
        let description = self.get_string_value(&row[1], "问题描述")?;
        let result = self.get_string_value(&row[2], "处理结果")?;
        let completion_time = self.get_string_value(&row[3], "完成时间")?;
        let report_time = self.get_string_value(&row[4], "上报时间")?;
        let is_remote = self.get_int_value(&row[5], "是否远程")?;
        let has_sop = self.get_int_value(&row[6], "是否有SOP")?;
        let sop_description = self.get_string_value(&row[7], "SOP描述")?;

        // 验证数据
        self.validate_work_order_data(
            &store_name,
            &description,
            &completion_time,
            &report_time,
            is_remote,
            has_sop,
        )?;

        Ok(ExcelWorkOrder {
            store_name,
            description,
            result,
            completion_time,
            report_time,
            is_remote,
            has_sop,
            sop_description,
        })
    }

    // 获取字符串值
    fn get_string_value(
        &self,
        cell: &calamine::Data,
        field_name: &str,
    ) -> Result<String, String> {
        match cell {
            calamine::Data::String(s) => {
                let trimmed = s.trim();
                if trimmed.is_empty() {
                    Err(format!("{}不能为空", field_name))
                } else {
                    Ok(trimmed.to_string())
                }
            }
            calamine::Data::Float(f) => Ok(f.to_string()),
            calamine::Data::Int(i) => Ok(i.to_string()),
            calamine::Data::Empty => Err(format!("{}不能为空", field_name)),
            _ => Ok(format!("{:?}", cell)),
        }
    }

    // 获取整数值
    fn get_int_value(&self, cell: &calamine::Data, field_name: &str) -> Result<i32, String> {
        match cell {
            calamine::Data::Int(i) => Ok(*i as i32),
            calamine::Data::Float(f) => Ok(*f as i32),
            calamine::Data::String(s) => {
                s.trim().parse::<i32>()
                    .map_err(|_| format!("{}必须是数字", field_name))
            }
            calamine::Data::Empty => Ok(0), // 默认值
            _ => Err(format!("{}格式不正确", field_name)),
        }
    }

    // 验证工单数据
    fn validate_work_order_data(
        &self,
        store_name: &str,
        description: &str,
        completion_time: &str,
        report_time: &str,
        is_remote: i32,
        has_sop: i32,
    ) -> Result<(), String> {
        // 验证门店名称
        if store_name.len() < 2 {
            return Err("门店名称至少需要2个字符".to_string());
        }

        // 验证问题描述
        if description.len() < 5 {
            return Err("问题描述至少需要5个字符".to_string());
        }

        // 验证时间格式（统一为 YYYY-MM-DD HH:MM:SS）
        if !self.is_valid_time_format(completion_time) {
            return Err("完成时间格式不正确，应为 YYYY-MM-DD HH:MM:SS 格式".to_string());
        }

        if !self.is_valid_time_format(report_time) {
            return Err("上报时间格式不正确，应为 YYYY-MM-DD HH:MM:SS 格式".to_string());
        }

        // 验证是否远程（0或1）
        if is_remote != 0 && is_remote != 1 {
            return Err("是否远程字段必须是0或1".to_string());
        }

        // 验证是否有SOP（0或1）
        if has_sop != 0 && has_sop != 1 {
            return Err("是否有SOP字段必须是0或1".to_string());
        }

        Ok(())
    }

    // 时间格式验证 - 统一为 YYYY-MM-DD HH:MM:SS 格式
    fn is_valid_time_format(&self, time_str: &str) -> bool {
        // 支持的时间格式：API要求的 YYYY-MM-DD HH:MM:SS 格式
        let patterns = [
            r"^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$",  // 完整格式：2024-01-15 14:30:00
            r"^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$",       // 简化格式：2024-01-15 14:30 (自动补秒)
            r"^\d{4}/\d{2}/\d{2} \d{2}:\d{2}:\d{2}$", // 斜杠格式：2024/01/15 14:30:00
            r"^\d{4}/\d{2}/\d{2} \d{2}:\d{2}$",       // 斜杠简化：2024/01/15 14:30
            r"^\d{4}-\d{2}-\d{2}$",                    // 仅日期：2024-01-15
            r"^\d{4}/\d{2}/\d{2}$",                    // 仅日期斜杠：2024/01/15
        ];

        patterns.iter().any(|pattern| {
            regex::Regex::new(pattern)
                .map(|re| re.is_match(time_str))
                .unwrap_or(false)
        })
    }

    // 生成Excel模板数据
    pub fn generate_template_data() -> Vec<Vec<String>> {
        vec![
            vec![
                "门店名称".to_string(),
                "问题描述".to_string(),
                "处理结果".to_string(),
                "完成时间".to_string(),
                "上报时间".to_string(),
                "是否远程(0/1)".to_string(),
                "是否有SOP(0/1)".to_string(),
                "SOP描述".to_string(),
            ],
            vec![
                "示例门店".to_string(),
                "设备故障需要维修".to_string(),
                "已完成维修，设备正常运行".to_string(),
                "2024-01-15 14:30:00".to_string(),  // 统一为 HH:MM:SS 格式
                "2024-01-15 15:00:00".to_string(),  // 统一为 HH:MM:SS 格式
                "0".to_string(),
                "1".to_string(),
                "按照标准维修流程执行".to_string(),
            ],
        ]
    }
}
