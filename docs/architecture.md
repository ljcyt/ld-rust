# 项目架构总览

## 整体结构

```
auto-ld/
├── app/                  # Next.js App Router 页面与布局
├── components/           # UI 组件与业务组件
├── hooks/                # 统计缓存、响应式等 Hook
├── lib/                  # Excel 解析、提交逻辑、缓存工具
├── public/               # 静态资源
├── src-tauri/            # Rust 后端与 Tauri 配置
└── docs/                 # 文档
```

## 前端核心模块

- `app/page.tsx`：主界面与流程控制（上传、登录、提交、进度、结果）。
- `components/FileUploadArea.tsx`：拖拽/选择上传区域。
- `components/SubmitSection.tsx`：提交方式选择 + 模拟提交开关。
- `components/EnhancedProgressBar.tsx`：进度与等待倒计时展示。
- `components/TaskHistoryModal.tsx`：任务历史弹窗与明细展开。
- `hooks/use-statistics.ts`：统计数据读取/刷新。
- `lib/work-order-processor.ts`：直接提交与分批提交逻辑。
- `lib/statistics-cache.ts`：统计日志与摘要缓存（localStorage）。
- `lib/task-history-cache.ts`：任务历史缓存（localStorage）。

## 后端（Tauri + Rust）

- `src-tauri/src/commands.rs`：Tauri 命令入口（登录、门店查询、提交、Excel 解析、任务管理等）。
- `src-tauri/src/api.rs`：HTTP API 客户端（登录、门店、工单提交）。
- `src-tauri/src/excel.rs`：Rust 侧 Excel 解析。
- `src-tauri/src/storage.rs`：凭证/任务/旧版统计的本地存储。
- `src-tauri/src/task_executor.rs`：任务执行器与批量调度。

## 交互流程

1. 用户拖拽/选择 Excel → `parseExcelFile` 解析为标准结构。
2. 弹窗内选择提交方式（直接/分批）并登录。
3. 提交流程统一在弹窗内展示进度与结果。
4. 每条结果写入任务历史缓存，同时更新统计缓存。
5. 统计面板自动响应缓存变更并刷新 UI。

## 缓存策略

- **统计日志**：`work_order_stats_log_v2` 按时间追加，超过 1000 条自动裁剪。
- **统计摘要**：`work_order_stats_summary_v2` 由日志计算并快速读取。
- **任务历史**：`work_order_task_history_v1`，最多保留 200 条。
- **模拟开关**：`mock_submit_enabled`（1=开启）。

## 构建与打包

- `npm run build`：生成前端静态资源（`next.config.mjs` 在生产时使用 `output: 'export'`）。
- `npm run tauri:build`：构建桌面应用，EXE 位于 `src-tauri/target/release/`，安装包位于 `src-tauri/target/release/bundle/`。
- 若 MSI 失败，常见原因是未安装 WiX（`light.exe`），可先发布 EXE 版本。

## 备注

- Tauri 侧仍保留任务/统计文件接口用于兼容与扩展，但当前统计与任务历史以前端缓存为主。
