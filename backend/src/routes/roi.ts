import { Router, Request, Response } from 'express';
import { getDb } from '../db';

const router = Router();

interface DataRow {
    date: string;
    day0_roi: number;
    day1_roi: number;
    day3_roi: number;
    day7_roi: number;
    day14_roi: number;
    day30_roi: number;
    day60_roi: number;
    day90_roi: number;
}

const ROI_KEYS: (keyof Omit<DataRow, 'date'>)[] = [
    'day0_roi', 'day1_roi', 'day3_roi', 'day7_roi',
    'day14_roi', 'day30_roi', 'day60_roi', 'day90_roi',
];

// ── GET /api/roi/filters ────────────────────────────────────────────────────
router.get('/filters', (_req: Request, res: Response) => {
    try {
        const db = getDb();
        const apps = (db.prepare('SELECT DISTINCT app FROM app_roi ORDER BY app').all() as { app: string }[]).map(r => r.app);
        const bid_types = (db.prepare('SELECT DISTINCT bid_type FROM app_roi ORDER BY bid_type').all() as { bid_type: string }[]).map(r => r.bid_type);
        const country_regions = (db.prepare('SELECT DISTINCT country_region FROM app_roi ORDER BY country_region').all() as { country_region: string }[]).map(r => r.country_region);
        res.json({ apps, bid_types, country_regions });
    } catch (err) {
        console.error('[/filters]', err);
        res.status(500).json({ error: 'DB 조회 오류' });
    }
});

// ── GET /api/roi/trend ──────────────────────────────────────────────────────
router.get('/trend', (req: Request, res: Response) => {
    const { app, bid_type, country_region, days = '90', moving_avg = 'true' } =
        req.query as Record<string, string>;

    if (!app || !bid_type || !country_region) {
        res.status(400).json({ error: 'app, bid_type, country_region are required' });
        return;
    }

    const daysNum = Math.min(Math.max(parseInt(days, 10) || 90, 1), 365);
    const useMovingAvg = moving_avg !== 'false';

    try {
        const db = getDb();

        const rows = db.prepare(`
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
            WHERE app = ?
              AND bid_type = ?
              AND country_region = ?
              AND date >= (
                SELECT date(MAX(date), '-' || ? || ' days')
                FROM app_roi
                WHERE app = ? AND bid_type = ? AND country_region = ?
              )
            GROUP BY date
            ORDER BY date
        `).all(
            app, bid_type, country_region,
            daysNum,
            app, bid_type, country_region,
        ) as unknown as DataRow[];

        const data = useMovingAvg ? applyMovingAverage(rows, 7) : rows.map(r => ({ ...r }));
        const forecast = generateForecast(data, 14);

        res.json({ data, forecast });
    } catch (err) {
        console.error('[/trend]', err);
        res.status(500).json({ error: 'DB 조회 오류' });
    }
});

// ── Helpers ─────────────────────────────────────────────────────────────────

function applyMovingAverage(rows: DataRow[], windowSize: number): DataRow[] {
    return rows.map((row, idx) => {
        const window = rows.slice(Math.max(0, idx - windowSize + 1), idx + 1);
        const result: DataRow = { date: row.date } as DataRow;
        for (const key of ROI_KEYS) {
            const vals = window.map(r => r[key]).filter(v => v != null) as number[];
            result[key] = vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
        }
        return result;
    });
}

function linearRegression(ys: number[]): { slope: number; intercept: number } {
    const n = ys.length;
    const xs = ys.map((_, i) => i);
    const sumX = xs.reduce((a, b) => a + b, 0);
    const sumY = ys.reduce((a, b) => a + b, 0);
    const sumXY = xs.reduce((s, x, i) => s + x * ys[i], 0);
    const sumX2 = xs.reduce((s, x) => s + x * x, 0);
    const denom = n * sumX2 - sumX * sumX;
    if (denom === 0) return { slope: 0, intercept: sumY / n };
    return {
        slope: (n * sumXY - sumX * sumY) / denom,
        intercept: (sumY - ((n * sumXY - sumX * sumY) / denom) * sumX) / n,
    };
}

function generateForecast(data: DataRow[], futureDays: number): DataRow[] {
    if (data.length < 7) return [];

    const recent = data.slice(-30);
    const n = recent.length;
    const regressions: Record<string, { slope: number; intercept: number }> = {};
    for (const key of ROI_KEYS) {
        regressions[key] = linearRegression(recent.map(r => r[key] ?? 0));
    }

    const lastDate = new Date(data[data.length - 1].date);
    return Array.from({ length: futureDays }, (_, i) => {
        const d = new Date(lastDate);
        d.setDate(d.getDate() + i + 1);
        const point: DataRow = { date: d.toISOString().split('T')[0] } as DataRow;
        for (const key of ROI_KEYS) {
            const { slope, intercept } = regressions[key];
            point[key] = Math.max(0.01, slope * (n + i) + intercept);
        }
        return point;
    });
}

export default router;
