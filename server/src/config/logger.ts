import pino from 'pino';
import { env } from './env.js';

const isProduction = env.NODE_ENV === 'production';
const usePrettyOutput = env.NODE_ENV === 'development';

/**
 * Structured logger. Production: one JSON object per line (easy to ship to any log service).
 * Development: human-readable, colored output.
 */
export const logger = pino({
  level: env.LOG_LEVEL ?? (isProduction ? 'info' : 'debug'),
  // Secrets must never reach the logs, even by accident.
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'res.headers["set-cookie"]',
      '*.password',
      '*.passwordHash',
      '*.token',
    ],
    censor: '[redacted]',
  },
  ...(!usePrettyOutput
    ? {}
    : {
        transport: {
          target: 'pino-pretty',
          options: { colorize: true, translateTime: 'SYS:HH:MM:ss', ignore: 'pid,hostname' },
        },
      }),
});
