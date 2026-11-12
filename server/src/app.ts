import { randomUUID } from 'node:crypto';
import express, { type Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';
import { env } from './config/env.js';
import { logger } from './config/logger.js';
import { authRouter } from './routes/authRoutes.js';
import { therapistRouter } from './routes/therapistRoutes.js';
import { categoryRouter } from './routes/categoryRoutes.js';
import { adminRouter } from './routes/adminRoutes.js';
import { errorHandler, notFound } from './middlewares/errorHandler.js';
import { apiLimiter, authLimiter } from './middlewares/rateLimit.js';
import { publicUploadsDir } from './storage/index.js';

export interface AppOptions {
  /** Overrides TRUST_PROXY (used by the tests). */
  trustProxy?: number;
  /** Overrides the origins parsed from CLIENT_ORIGIN (used by the tests). */
  corsOrigins?: string[];
}

/**
 * Builds the Express application. It does NOT connect to the database or listen on a port, so the same app can be
 * started by server.ts and driven directly by the automated tests (tests/).
 */
export function createApp(options: AppOptions = {}): Express {
  const trustProxy = options.trustProxy ?? env.TRUST_PROXY;
  const corsOrigins = options.corsOrigins ?? env.CLIENT_ORIGIN.split(',').map((o) => o.trim()).filter(Boolean);

  const app = express();
  if (trustProxy > 0) app.set('trust proxy', trustProxy); // behind a proxy, req.ip must come from X-Forwarded-For

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
  app.use(cors({ origin: corsOrigins })); // only the listed websites may call the API from a browser
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

  return app;
}
