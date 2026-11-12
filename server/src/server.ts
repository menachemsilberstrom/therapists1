import { createApp } from './app.js';
import { connectDB } from './config/db.js';
import { env } from './config/env.js';
import { logger } from './config/logger.js';

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
    createApp().listen(env.PORT, () => logger.info(`Server listening on http://localhost:${env.PORT} (${env.NODE_ENV})`));
  })
  .catch((err: unknown) => {
    logger.fatal({ err }, 'Failed to start server');
    process.exit(1);
  });
