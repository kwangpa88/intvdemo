import { DatabaseSync } from 'node:sqlite';
import path from 'path';

const DB_PATH = path.resolve(__dirname, '..', 'app_roi.db');

let _db: DatabaseSync | null = null;

export function getDb(): DatabaseSync {
    if (!_db) {
        _db = new DatabaseSync(DB_PATH);
    }
    return _db;
}

/**
 * app_roi 테이블을 초기화한다.
 * @param dropIfExists true이면 기존 테이블을 삭제하고 새로 생성한다.
 */
export function initAppRoiTable(dropIfExists = false): void {
    const db = getDb();

    if (dropIfExists) {
        db.exec('DROP TABLE IF EXISTS app_roi;');
        console.log('[DB] 기존 app_roi 테이블 삭제');
    }

    db.exec(`
    CREATE TABLE IF NOT EXISTS app_roi (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      date          DATE         NOT NULL,
      app           VARCHAR(255) NOT NULL,
      bid_type      VARCHAR(255) NOT NULL,
      country_region VARCHAR(255) NOT NULL,
      total_installs INT          NOT NULL,
      day0_roi      FLOAT,
      day1_roi      FLOAT,
      day3_roi      FLOAT,
      day7_roi      FLOAT,
      day14_roi     FLOAT,
      day30_roi     FLOAT,
      day60_roi     FLOAT,
      day90_roi     FLOAT
    );
  `);

    console.log('[DB] app_roi 테이블 준비 완료 (파일: app_roi.db)');
}
