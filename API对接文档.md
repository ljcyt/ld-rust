# 卤蛋侠工单系统 - API 对接文档（精简版）

本文档仅覆盖**当前项目实际使用**的接口与字段，避免与历史/无关模块混淆。

---

## 基础信息

- **基础 URL**  
  `https://kf.uhi-networks.com/asset-api-gateway/compAppGateWay/api`

- **请求方式**  
  所有接口均为 **POST JSON**，请求结构统一：

```json
{
  "header": { "code": "API_CODE" },
  "body": { }
}
```

- **响应结构**

```json
{
  "header": { "errorMessage": "错误信息" },
  "body": {
    "isSuccessful": true,
    "resultData": { }
  }
}
```

---

## 1. 用户登录（HXCS_APP_SJDL）

**用途**：获取 token / companyId / userId  
**实现位置**：`lib/tauri-api.ts`、`src-tauri/src/api.rs`

**请求 body**

```json
{
  "companyId": null,
  "token": "",
  "userName": "用户名",
  "passWord": "密码",
  "deviceId": "用户名",
  "language": "zh",
  "osType": "2"
}
```

**响应 resultData**

```json
{
  "token": "访问令牌",
  "companyId": "公司ID",
  "userId": "用户ID"
}
```

---

## 2. 门店查询（HXCS_ZAPP_MDLB）

**用途**：根据门店名称查询门店信息  
**实现位置**：`lib/tauri-api.ts`、`src-tauri/src/api.rs`

**请求 body**

```json
{
  "companyId": "公司ID",
  "token": "访问令牌",
  "customerName": "门店名称"
}
```

**响应 resultData**

```json
{
  "customerId": "门店ID",
  "customerName": "门店名称"
}
```

---

## 3. 工单提交（HXCS_ZAPP_FWGDTB）

**用途**：提交单条工单  
**实现位置**：`lib/tauri-api.ts`、`src-tauri/src/api.rs`

**请求 body（核心字段）**

```json
{
  "companyId": "公司ID",
  "token": "访问令牌",
  "customerId": "门店ID",
  "customerName": "门店名称",
  "processesRemark": "处理结果",
  "finishTime": "完成时间",
  "repairsTimes": "报修时间",
  "isLong": 0,
  "faultRemark": "故障描述",
  "isThereAnSop": 0,
  "sopDescription": "SOP 流程描述（可为空）"
}
```

**固定字段（由后端统一填充）**

| 字段 | 固定值 |
|------|--------|
| affectRangeId | `20191126b3da41b498b675b16ced3472` |
| affectRangeName | `部分功能` |
| serverTypeId | `20191126b0214f0faba42f696abadbd8` |
| serverTypeName | `例行维护` |
| malfunctionTypeId | `20201216b38b479f86def7bf47ca922d` |
| malfunctionTypeName | `海底捞(故障)` |
| processesUrls | `""` |
| faultFileUrls | `""` |
| fromType | `"5"` |

**响应 resultData**

```json
{
  "workOrderId": "工单ID",
  "status": "状态"
}
```

---

## Excel 字段映射

| Excel 列名 | 字段 | 说明 |
|-----------|------|------|
| 报修用户 | customerName | 门店名称 |
| 故障描述 | faultRemark | 故障描述 |
| 处理结果 | processesRemark | 处理结果 |
| 完成时间（注意格式） | finishTime | `YYYY-MM-DD HH:mm:ss` |
| 报修时间（注意格式） | repairsTimes | `YYYY-MM-DD HH:mm:ss` |
| 是否远程(0是/1否) | isLong | 0=远程，1=现场 |
| 是否有sop(1是/0否) | isThereAnSop | 1=有SOP |
| sop流程描述 | sopDescription | SOP 描述（可为空） |

> 项目内若缺失 SOP 字段会使用默认值填充，避免提交失败。

---

## Tauri 命令接口（当前使用）

| 命令 | 说明 |
|------|------|
| `login` | 登录并保存凭证 |
| `get_current_user` | 获取本地缓存的凭证 |
| `logout` | 清理本地凭证 |
| `query_store` | 门店查询 |
| `submit_work_order` | 提交工单 |
| `parse_excel_file` | Rust 解析 Excel |
| `get_excel_template` | 获取模板数据 |

> 其它任务管理命令保留用于扩展，但当前前端主要走本地提交逻辑与缓存。
