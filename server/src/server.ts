import mongoose from 'mongoose';
import { createApp } from './app.js';
import { connectDB } from './config/db.js';
import { env } from './config/env.js';
import { logger } from './config/logger.js';
import { createShutdownHandler } from './shutdown.js';

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
    const server = createApp().listen(env.PORT, () => logger.info(`Server listening on port ${env.PORT} (${env.NODE_ENV})`));

    // Render / Docker send SIGTERM when they stop or redeploy the service: finish the requests in flight, then exit.
    const shutdown = createShutdownHandler({
      server,
      disconnect: () => mongoose.disconnect(),
      exit: (code) => process.exit(code),
      log: (signal) => logger.info({ signal }, 'Shutting down'),
    });
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  })
  .catch((err: unknown) => {
    logger.fatal({ err }, 'Failed to start server');
    process.exit(1);
  });
