import express from 'express';
import cors from 'cors';
import { initAppRoiTable } from './db';
import roiRouter from './routes/roi';

const app = express();
const PORT = process.env.PORT || 4000;

const dropIfExists = process.env.DROP_TABLE === 'true';
initAppRoiTable(dropIfExists);

app.use(cors({ origin: 'http://localhost:3000' }));
app.use(express.json());

app.get('/api/hello', (_req, res) => {
    res.json({ message: 'Hello World' });
});

app.use('/api/roi', roiRouter);

app.listen(PORT, () => {
    console.log(`Backend server running at http://localhost:${PORT}`);
});
