import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import counselingRouter from './routes/counseling';
import sgmRouter from './routes/sgm';
import ncoerRouter from './routes/ncoer';
import promotionRouter from './routes/promotion';

dotenv.config();

const app = express();
const PORT = process.env.PORT ?? 3001;

app.use(cors({ origin: ['http://localhost:5173', 'http://127.0.0.1:5173'] }));
app.use(express.json({ limit: '2mb' }));

app.use('/api/counseling', counselingRouter);
app.use('/api/sgm', sgmRouter);
app.use('/api/ncoer', ncoerRouter);
app.use('/api/promotion', promotionRouter);

app.get('/health', (_req, res) => res.json({ status: 'ok', ts: Date.now() }));

app.listen(PORT, () => {
  console.log(`NCOAi server listening on http://localhost:${PORT}`);
});
