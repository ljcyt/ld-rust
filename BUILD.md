# 卤蛋侠工单系统 - 源码构建指南

本项目是一个基于 **Tauri 2.0** + **Next.js 15 (React 19)** 的桌面应用程序。

## 1. 环境准备

在开始构建之前，请确保您的开发环境已安装以下工具：

- **Node.js**: 建议使用 LTS 版本（v20 或更高）。
- **Rust**: 请通过 [rustup.rs](https://rustup.rs/) 安装最新的稳定版 Rust 环境。
- **Windows 构建工具** (仅 Windows):
  - 安装 [Visual Studio Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/)，并勾选 "使用 C++ 的桌面开发"。
- **WiX Toolset** (可选，用于生成 MSI 安装包):
  - 建议安装 v3.11 或更高版本。

## 2. 安装依赖

在项目根目录下运行以下命令。
**注意：** 由于 React 19 与部分组件库存在 peer 依赖冲突，请务必添加 `--legacy-peer-deps` 标志。

```bash
npm install --legacy-peer-deps
```

## 3. 开发环境运行

如果您想在开发模式下启动并实时调试：

```bash
npm run tauri:dev
```

## 4. 生产环境构建 (Release)

执行以下命令将前端打包并编译 Rust 后端，生成最终的可执行文件：

```bash
npm run tauri:build
```

### 构建产物路径：
- **可执行文件 (.exe)**: `src-tauri/target/release/app.exe`
- **安装包 (.msi)**: `src-tauri/target/release/bundle/msi/*.msi` (需配置好 WiX)

## 5. 常见问题处理

- **依赖安装报错**: 如果遇到 `ERRESOLVE could not resolve`，请确保使用了 `--legacy-peer-deps`。
- **构建速度慢**: 首次运行 `tauri:build` 时，Rust 会下载并编译所有依赖库，这可能需要 5-10 分钟，请耐心等待。
- **Next.js 静态导出**: 本项目配置为静态导出 (`output: 'export'`)。在 `next.config.mjs` 中已做处理，构建时会自动生成 `out/` 目录供 Tauri 使用。

---
祝开发愉快！
