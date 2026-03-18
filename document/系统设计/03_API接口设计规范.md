# API 接口设计规范

## 1. 基本规范

| 项目 | 规范 |
|---|---|
| 基础 URL | `http://localhost:4000` |
| 前端代理前缀 | `/api/*` → 自动代理至后端 |
| 数据格式 | `application/json` |
| 字符编码 | `UTF-8` |
| 跨域 | 允许 `http://localhost:3000` |
| 错误响应格式 | `{ "error": "错误说明" }` |

---

## 2. 接口列表

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/hello` | 健康检查 |
| GET | `/api/roi/filters` | 获取筛选项列表 |
| GET | `/api/roi/trend` | 获取 ROI 趋势数据（含预测） |

---

## 3. 接口详情

### 3.1 GET `/api/hello`

健康检查接口。

**响应示例**

```json
{
  "message": "Hello World"
}
```

---

### 3.2 GET `/api/roi/filters`

获取所有可用的筛选项（应用名称、出价类型、国家/地区），用于前端下拉菜单初始化。

**请求**

无参数。

**响应**

```json
{
  "apps": ["App-1", "App-2", "App-3", "App-4", "App-5"],
  "bid_types": ["CPI"],
  "country_regions": ["美国", "英国"]
}
```

| 字段 | 类型 | 说明 |
|---|---|---|
| `apps` | `string[]` | 按字母排序的应用名列表 |
| `bid_types` | `string[]` | 出价类型列表 |
| `country_regions` | `string[]` | 国家/地区列表 |

**错误响应**

| 状态码 | 说明 |
|---|---|
| 500 | 数据库查询异常 |

---

### 3.3 GET `/api/roi/trend`

获取指定应用、出价类型、国家/地区的 ROI 时序数据，可选 7 日移动平均，并附带 14 日线性回归预测数据。

**Query 参数**

| 参数 | 类型 | 必填 | 默认值 | 说明 |
|---|---|---|---|---|
| `app` | string | ✓ | — | 应用名称，如 `App-1` |
| `bid_type` | string | ✓ | — | 出价类型，如 `CPI` |
| `country_region` | string | ✓ | — | 国家/地区，如 `美国` |
| `days` | number | — | `90` | 查询时间范围（天数），范围 `[1, 365]` |
| `moving_avg` | boolean | — | `true` | `true` = 7 日移动平均；`false` = 原始数据 |

**请求示例**

```
GET /api/roi/trend?app=App-1&bid_type=CPI&country_region=美国&days=90&moving_avg=true
```

**响应结构**

```json
{
  "data": [
    {
      "date": "2025-04-13",
      "day0_roi":  6.79,
      "day1_roi":  14.24,
      "day3_roi":  27.30,
      "day7_roi":  64.44,
      "day14_roi": 120.89,
      "day30_roi": 214.65,
      "day60_roi": 368.42,
      "day90_roi": 413.81
    }
  ],
  "forecast": [
    {
      "date": "2025-07-13",
      "day0_roi":  7.10,
      "day1_roi":  15.00,
      "day3_roi":  28.50,
      "day7_roi":  65.00,
      "day14_roi": 122.00,
      "day30_roi": 216.00,
      "day60_roi": 370.00,
      "day90_roi": 415.00
    }
  ]
}
```

| 字段 | 类型 | 说明 |
|---|---|---|
| `data` | `DataPoint[]` | 历史/实际数据（含移动平均后的值） |
| `forecast` | `DataPoint[]` | 未来 14 日预测数据（线性回归） |
| `DataPoint.date` | `string` | 日期，格式 `YYYY-MM-DD` |
| `DataPoint.dayX_roi` | `number` | 对应 ROI %（浮点数，不含 `%`） |

**错误响应**

| 状态码 | 说明 |
|---|---|
| 400 | 缺少必填参数（`app`、`bid_type`、`country_region`） |
| 500 | 数据库查询异常 |

---

## 4. 后端核心算法说明

### 4.1 7 日简单移动平均 (SMA)

对返回的每个数据点，取当前点及前 6 个点（最多 7 个点）计算算术平均值。

```
MA[i] = mean(values[max(0, i-6) .. i])
```

- 计算位置：`backend/src/routes/roi.ts` → `applyMovingAverage()`
- 适用场景：平滑短期波动，观察趋势走向

### 4.2 线性回归预测

基于最近 30 个数据点，对每个 ROI 指标独立进行最小二乘线性回归，向后预测 14 日。

```
slope     = (n·ΣXY - ΣX·ΣY) / (n·ΣX² - (ΣX)²)
intercept = (ΣY - slope·ΣX) / n
forecast[i] = max(0.01, slope × (n + i) + intercept)
```

- 计算位置：`backend/src/routes/roi.ts` → `generateForecast()`
- 最小值 clamp：`0.01`（确保对数 Y 轴不出现无效值）

---

## 5. 前端 API 调用方式

```typescript
// 1. 初始化筛选项
const opts = await fetch('/api/roi/filters').then(r => r.json())

// 2. 获取趋势数据
const params = new URLSearchParams({
  app: 'App-1',
  bid_type: 'CPI',
  country_region: '美国',
  days: '90',
  moving_avg: 'true',
})
const { data, forecast } = await fetch(`/api/roi/trend?${params}`).then(r => r.json())
```
