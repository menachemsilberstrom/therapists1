import express from 'express';
import cors from 'cors';
import { env } from './config/env.js';
import { connectDB } from './config/db.js';
import { authRouter } from './routes/authRoutes.js';

const app = express();

app.use(cors({ origin: env.CLIENT_ORIGIN }));
app.use(express.json({ limit: '1mb' }));

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});
app.use('/api/auth', authRouter);
app.use(notFound);
app.use(errorHandler);

connectDB()
  .then(() => {
    app.listen(env.PORT, () => console.log(`Server listening on http://localhost:${env.PORT}`));
  })
  .catch((err: unknown) => {
    console.error('Failed to start server:', err);
    process.exit(1);
  });
