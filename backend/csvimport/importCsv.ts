import csvParser from 'csv-parser';
import fs from 'fs';
import path from 'path';
import { getDb, initAppRoiTable } from '../src/db';

/**
 * CSV 헤더 → DB 컬럼 매핑
 *
 * CSV Header       DB Column
 * ─────────────────────────────────
 * 日期             date          (DATE)
 * app              app           (VARCHAR)
 * 出价类型          bid_type      (VARCHAR)
 * 国家地区          country_region(VARCHAR)
 * 应用安装.总次数    total_installs(INT)
 * 当日ROI          day0_roi      (FLOAT)
 * 1日ROI           day1_roi      (FLOAT)
 * 3日ROI           day3_roi      (FLOAT)
 * 7日ROI           day7_roi      (FLOAT)
 * 14日ROI          day14_roi     (FLOAT)
 * 30日ROI          day30_roi     (FLOAT)
 * 60日ROI          day60_roi     (FLOAT)
 * 90日ROI          day90_roi     (FLOAT)
 */

const CSV_PATH = path.resolve(__dirname, 'app_roi_data.csv');

const HEADER_MAP: Record<string, string> = {
    '\u65e5\u671f': 'date',          // 日期
    'app': 'app',
    '\u51fa\u4ef7\u7c7b\u578b': 'bid_type',      // 出价类型
    '\u56fd\u5bb6\u5730\u533a': 'country_region', // 国家地区
    '\u5e94\u7528\u5b89\u88c5.\u603b\u6b21\u6570': 'total_installs', // 应用安装.总次数
    '\u5f53\u65e5ROI': 'day0_roi',   // 当日ROI
    '1\u65e5ROI': 'day1_roi',        // 1日ROI
    '3\u65e5ROI': 'day3_roi',        // 3日ROI
    '7\u65e5ROI': 'day7_roi',        // 7日ROI
    '14\u65e5ROI': 'day14_roi',      // 14日ROI
    '30\u65e5ROI': 'day30_roi',      // 30日ROI
    '60\u65e5ROI': 'day60_roi',      // 60日ROI
    '90\u65e5ROI': 'day90_roi',      // 90日ROI
};

/** "2025-04-13(日)" → "2025-04-13" */
function parseDate(raw: string): string {
    return raw.replace(/\(.\)$/, '').trim();
}

/** "6.79%" → 6.79 */
function parsePercent(raw: string): number {
    return parseFloat(raw.replace('%', '').trim());
}

interface MappedRow {
    date: string;
    app: string;
    bid_type: string;
    country_region: string;
    total_installs: string;
    day0_roi: string;
    day1_roi: string;
    day3_roi: string;
    day7_roi: string;
    day14_roi: string;
    day30_roi: string;
    day60_roi: string;
    day90_roi: string;
}

async function importCsv(): Promise<void> {
    // 테이블이 없으면 생성 (있으면 유지)
    initAppRoiTable(false);

    const db = getDb();
    const insert = db.prepare(`
    INSERT INTO app_roi
      (date, app, bid_type, country_region, total_installs,
       day0_roi, day1_roi, day3_roi, day7_roi, day14_roi,
       day30_roi, day60_roi, day90_roi)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

    const rows: MappedRow[] = [];

    await new Promise<void>((resolve, reject) => {
        fs.createReadStream(CSV_PATH)
            .pipe(
                csvParser({
                    mapHeaders: ({ header }) => HEADER_MAP[header.trim()] ?? header.trim(),
                }),
            )
            .on('data', (row: MappedRow) => rows.push(row))
            .on('end', resolve)
            .on('error', reject);
    });

    let inserted = 0;
    for (const row of rows) {
        insert.run(
            parseDate(row.date),
            row.app,
            row.bid_type,
            row.country_region,
            parseInt(row.total_installs, 10),
            parsePercent(row.day0_roi),
            parsePercent(row.day1_roi),
            parsePercent(row.day3_roi),
            parsePercent(row.day7_roi),
            parsePercent(row.day14_roi),
            parsePercent(row.day30_roi),
            parsePercent(row.day60_roi),
            parsePercent(row.day90_roi),);
        inserted++;
    }

    console.log(`[CSV Import] 완료: ${inserted}건 삽입 → app_roi.db`);
}

importCsv().catch((err) => {
    console.error('[CSV Import] 오류:', err);
    process.exit(1);
});