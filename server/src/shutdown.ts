import type { Server } from 'node:http';

export interface ShutdownDeps {
  server: Pick<Server, 'close'>;
  /** Closes the database connection. */
  disconnect: () => Promise<unknown>;
  /** process.exit in production; replaced by a fake in the tests. */
  exit: (code: number) => void;
  log: (signal: string) => void;
  /** How long to wait for open requests before giving up. */
  timeoutMs?: number;
}

/**
 * Builds the function that stops the server politely. Render / Docker send SIGTERM when they stop or redeploy the
 * service: stop accepting new connections, let the requests in flight finish, close the database, exit with code 0.
 * If that takes longer than `timeoutMs` the process exits with code 1 anyway, so a stuck request can never block a deploy.
 */
export function createShutdownHandler({ server, disconnect, exit, log, timeoutMs = 10_000 }: ShutdownDeps): (signal: string) => void {
  let shuttingDown = false;
  return (signal) => {
    if (shuttingDown) return; // a second signal while we are already closing is ignored
    shuttingDown = true;
    log(signal);
    setTimeout(() => exit(1), timeoutMs).unref();
    server.close(() => {
      disconnect()
        .catch(() => undefined)
        .finally(() => exit(0));
    });
  };
}
