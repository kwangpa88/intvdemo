const { DatabaseSync } = require('node:sqlite');
const db = new DatabaseSync('d:/work/intvdemo/backend/app_roi.db');
const count = db.prepare('SELECT COUNT(*) as cnt FROM app_roi').get();
console.log('total rows:', count.cnt);
const sample = db.prepare('SELECT * FROM app_roi LIMIT 3').all();
console.log(JSON.stringify(sample, null, 2));