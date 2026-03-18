# API Plan — App ROI 다차원 트렌드 대시보드

## 화면 분석 (캡처 이미지 기준)

| 영역 | 내용 |
|---|---|
| 제목 | `{앱명} - 多时间维度ROI趋势` |
| 부제 | `(7日移动平均)` / `(原始数据)` |
| 데이터 범위 | 최근 90일 |
| 필터 | 用户安装渠道(채널·정적), 出价类型, 国家地区, APP |
| 표시 모드 | 이동평균 / 원본 데이터 (라디오) |
| Y축 설정 | 선형 / 로그 스케일 (라디오) |
| 차트 | 다중 ROI 라인 (当日·1·3·7·14·30·60·90일) + 100% 기준선 + 예측(점선) |

---

## Endpoints

### 1. GET `/api/roi/filters`
필터 드롭다운 선택지 반환

**Response:**
```json
{
  "apps": ["App-1", "App-2", "App-3", "App-4", "App-5"],
  "bid_types": ["CPI"],
  "country_regions": ["美国", "英国", ...]
}
```

**SQL:**
```sql
SELECT DISTINCT app           FROM app_roi ORDER BY app;
SELECT DISTINCT bid_type      FROM app_roi ORDER BY bid_type;
SELECT DISTINCT country_region FROM app_roi ORDER BY country_region;
```

---

### 2. GET `/api/roi/trend`
시계열 ROI 데이터 반환 (+ 선형회귀 예측)

**Query Parameters:**

| 파라미터 | 타입 | 기본값 | 설명 |
|---|---|---|---|
| `app` | string | **필수** | 앱 이름 |
| `bid_type` | string | **필수** | 출가 유형 |
| `country_region` | string | **필수** | 국가·지역 |
| `days` | number | `90` | 조회 기간(일), 최대 365 |
| `moving_avg` | boolean | `true` | 7일 이동평균 적용 여부 |

**Response:**
```json
{
  "data": [
    {
      "date": "2025-04-13",
      "day0_roi": 6.79,
      "day1_roi": 14.24,
      "day3_roi": 27.30,
      "day7_roi": 64.44,
      "day14_roi": 120.89,
      "day30_roi": 214.65,
      "day60_roi": 368.42,
      "day90_roi": 413.81
    }
  ],
  "forecast": [
    {
      "date": "2025-07-13",
      "day0_roi": 7.10,
      "day1_roi": 15.00,
      "day3_roi": 28.50,
      "day7_roi": 65.00,
      "day14_roi": 122.00,
      "day30_roi": 216.00,
      "day60_roi": 370.00,
      "day90_roi": 415.00
    }
  ]
}
```

**핵심 SQL (원본 데이터):**
```sql
SELECT
  date,
  AVG(day0_roi)  AS day0_roi,
  AVG(day1_roi)  AS day1_roi,
  AVG(day3_roi)  AS day3_roi,
  AVG(day7_roi)  AS day7_roi,
  AVG(day14_roi) AS day14_roi,
  AVG(day30_roi) AS day30_roi,
  AVG(day60_roi) AS day60_roi,
  AVG(day90_roi) AS day90_roi
FROM app_roi
WHERE app = :app
  AND bid_type = :bid_type
  AND country_region = :country_region
  AND date >= (
    SELECT date(MAX(date), '-' || :days || ' days')
    FROM app_roi
    WHERE app = :app AND bid_type = :bid_type AND country_region = :country_region
  )
GROUP BY date
ORDER BY date;
```

---

## 이동평균 (Moving Average)

- **방식**: 단순 이동평균 (SMA), 윈도우 크기 7일
- **계산 위치**: JavaScript (백엔드) — SQL window function 대신 사용
- **공식**: 현재 포함 이전 7일 평균 (trailing window)

```
MA[i] = mean(values[max(0, i-6) .. i])
```

---

## 예측 (Forecast)

- **대상**: 마지막 30개 데이터 포인트 기반 선형회귀
- **예측 기간**: 14일
- **계산**: 각 ROI 지표별 독립적으로 slope/intercept 계산
- **제약**: 예측값 < 0.01 이면 0.01로 clamp (log scale 대응)

```
slope = (n·ΣXY − ΣX·ΣY) / (n·ΣX² − (ΣX)²)
intercept = (ΣY − slope·ΣX) / n
forecast[i] = max(0.01, slope * (n + i) + intercept)
```

---

## 프론트엔드 연동

| 이벤트 | 동작 |
|---|---|
| 페이지 진입 | `GET /api/roi/filters` → 드롭다운 초기화 |
| 필터 변경 | `GET /api/roi/trend` 재호출 |
| 표시모드 변경 | `moving_avg` 파라미터 토글 후 재호출 |
| Y축 변경 | 프론트엔드에서 Recharts `YAxis scale` 전환 (API 재호출 없음) |
| 채널 선택 | 정적 드롭다운 (DB에 채널 컬럼 없음, UI 표시 전용) |

---

## 파일 구조

```
backend/
├── src/
│   ├── index.ts             ← Express 앱 진입점, 라우터 마운트
│   ├── db.ts                ← SQLite 연결 및 테이블 초기화
│   └── routes/
│       └── roi.ts           ← GET /api/roi/filters, GET /api/roi/trend
frontend/
└── app/
    ├── page.tsx             ← /dashboard 로 리다이렉트
    └── dashboard/
        └── page.tsx         ← ROI 트렌드 대시보드 (메인 화면)
```
