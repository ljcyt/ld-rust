# 🥚 卤蛋侠工单系统 - 批量上传工具

一个基于 **Next.js + Tauri** 的桌面应用，面向卤蛋侠工单系统的 Excel 批量录单场景。支持弹窗式提交流程、分批/直提、进度跟踪、任务历史与模拟提交。

---

## 🚀 快速开始

### 环境要求

- **Node.js**: 18+
- **Rust**: 1.70+
- **包管理器**: npm（默认）

### 安装与启动

```bash
# 1. 安装依赖（如遇到依赖冲突可加 --legacy-peer-deps）
npm install --legacy-peer-deps

# 2. 启动桌面开发模式
npm run tauri:dev
```

> 提示：Web 调试可用 `npm run dev`，访问 `http://localhost:3000`。

---

## ✨ 核心功能

- Excel 批量导入（.xlsx/.xls）
- 弹窗内完成“提交方式选择 → 登录 → 进度 → 结果”
- 支持直接提交 / 分批提交
- 进度展示、等待倒计时与批次统计
- 任务历史（可展开查看故障描述）
- 模拟提交（不真实写入）
- 统计面板（支持一键清理缓存）

---

## 🧭 使用流程

1. 拖拽或选择 Excel 文件
2. 弹窗内选择提交方式（直接/分批）
3. 登录后开始提交
4. 弹窗内查看进度与结果
5. 可在任务历史中查看明细

---

## 🧱 项目结构

```
auto-ld/
├── app/                 # Next.js App Router 页面
├── components/          # 业务组件与 UI 组件
├── hooks/               # Hooks（统计缓存等）
├── lib/                 # 业务逻辑与工具库
├── public/              # 静态资源
├── src-tauri/           # Rust 后端与 Tauri 配置
└── docs/                # 文档
```

---

## 💾 数据存储

### 浏览器 / WebView localStorage

- `work_order_stats_log_v2`：统计增量日志
- `work_order_stats_summary_v2`：统计摘要（由日志计算）
- `work_order_task_history_v1`：任务历史（含故障描述）
- `mock_submit_enabled`：模拟提交开关（1=开启）

### Tauri 应用数据目录（桌面端）

- `credentials.json`：登录凭证
- `tasks/*.json`：任务数据（主要用于后端任务接口与兼容逻辑）
- `ld.log`：旧版统计日志（前端已不再依赖）

> 具体位置由 `dirs::data_dir()` 决定，目录名为 `haidilao-workorder`。

---

## 🧪 模拟提交

用于演示或自测，不会真实写入工单系统。

开启方式：
- UI 的“模拟提交”开关
- 或设置环境变量 `NEXT_PUBLIC_MOCK_SUBMIT=1`

---

## 📦 构建与发布

```bash
# 前端构建
npm run build

# Tauri 构建（产物在 src-tauri/target/release/）
npm run tauri:build
```

构建产物路径：
- EXE：`src-tauri/target/release/app.exe`
- 安装包：`src-tauri/target/release/bundle/`

> 如果 MSI 构建失败，通常是缺少 WiX 工具链（`light.exe`）。可先分发 EXE 版本。

---

## 🧩 技术文档

- [API 对接文档](API对接文档.md)
- [项目结构说明](docs/architecture.md)

---

## 🐛 常见问题

### 1. 拖拽无响应
确保在桌面端或现代浏览器环境中运行，且未被系统安全策略拦截。

### 2. 构建失败（Tauri）
优先检查 Rust/Node 版本、依赖安装是否完成。若 MSI 失败可先使用 EXE 版本验证。

---

## 📄 许可证

MIT License
