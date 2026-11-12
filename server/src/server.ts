import { randomUUID } from 'node:crypto';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';
import { env } from './config/env.js';
import { logger } from './config/logger.js';
import { connectDB } from './config/db.js';
import { authRouter } from './routes/authRoutes.js';
import { therapistRouter } from './routes/therapistRoutes.js';
import { categoryRouter } from './routes/categoryRoutes.js';
import { adminRouter } from './routes/adminRoutes.js';
import { errorHandler, notFound } from './middlewares/errorHandler.js';
import { apiLimiter, authLimiter } from './middlewares/rateLimit.js';
import { publicUploadsDir } from './storage/index.js';

const app = express();

app.use(
  pinoHttp({
    logger,
    // Reuse a well-formed X-Request-Id from a proxy, otherwise make one; echo it back so a user can quote it.
    genReqId: (req, res) => {
      const incoming = req.headers['x-request-id'];
      const id = typeof incoming === 'string' && /^[\w-]{1,100}$/.test(incoming) ? incoming : randomUUID();
      res.setHeader('X-Request-Id', id);
      return id;
    },
    customLogLevel: (_req, res, err) => (err || res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info'),
    autoLogging: { ignore: (req) => req.url === '/api/health' || (req.url ?? '').startsWith('/uploads/') },
    // Log only what is useful (no headers or bodies, which can hold secrets).
    serializers: {
      req: (req: { id: unknown; method: string; url: string }) => ({ id: req.id, method: req.method, url: req.url }),
      res: (res: { statusCode: number }) => ({ statusCode: res.statusCode }),
    },
  }),
);
app.use(helmet());
app.use(cors({ origin: env.CLIENT_ORIGIN }));
app.use(express.json({ limit: '1mb' }));

// Public files only (avatars). The private folder (certificates) is never mounted.
// Filenames are unique per upload, so they can be cached "forever". helmet's default
// Cross-Origin-Resource-Policy would block <img> loads from the React origin, so relax it for this route.
app.use(
  '/uploads',
  express.static(publicUploadsDir, {
    maxAge: '30d',
    immutable: true,
    index: false,
    dotfiles: 'deny',
    setHeaders: (res) => res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin'),
  }),
);

app.use('/api', apiLimiter);

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});
app.use('/api/auth', authLimiter, authRouter);
app.use('/api/therapists', therapistRouter);
app.use('/api/categories', categoryRouter);
app.use('/api/admin', adminRouter);

app.use(notFound);
app.use(errorHandler);

process.on('unhandledRejection', (reason) => {
  logger.fatal({ err: reason }, 'Unhandled promise rejection');
  process.exit(1);
});
process.on('uncaughtException', (err) => {
  logger.fatal({ err }, 'Uncaught exception');
  process.exit(1);
});

connectDB()
  .then((database) => {
    logger.info({ database }, 'MongoDB connected');
    if (database === 'test') {
      // No database name in MONGODB_URI: MongoDB silently uses "test", which other applications often share too.
      logger.warn('Using the default "test" database. Put a database name in MONGODB_URI (e.g. .../therapists_directory).');
    }
    app.listen(env.PORT, () => logger.info(`Server listening on http://localhost:${env.PORT} (${env.NODE_ENV})`));
  })
  .catch((err: unknown) => {
    logger.fatal({ err }, 'Failed to start server');
    process.exit(1);
  });
