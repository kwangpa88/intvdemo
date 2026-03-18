import express from 'express';
import cors from 'cors';
import { initAppRoiTable } from './db';

const app = express();
const PORT = process.env.PORT || 4000;

// DB 초기화 (환경변수 DROP_TABLE=true 이면 기존 테이블 삭제 후 재생성)
// const dropIfExists = process.env.DROP_TABLE === 'true';
const dropIfExists = false;
initAppRoiTable(dropIfExists);

app.use(cors({ origin: 'http://localhost:3000' }));
app.use(express.json());

app.get('/api/hello', (_req, res) => {
    res.json({ message: 'Hello World' });
});

app.listen(PORT, () => {
    console.log(`Backend server running at http://localhost:${PORT}`);
});
