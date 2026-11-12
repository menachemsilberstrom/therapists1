import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createShutdownHandler } from '../../src/shutdown.js';

/** A fake HTTP server whose close() callback the test can trigger whenever it likes. */
function fakeServer() {
  let onClosed: () => void = () => undefined;
  return {
    server: { close: vi.fn((cb?: (err?: Error) => void) => ((onClosed = () => cb?.()), undefined as never)) },
    finishClosing: () => onClosed(),
  };
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('graceful shutdown (what happens when Render redeploys the service)', () => {
  it('stops accepting connections, closes the database, then exits with code 0', async () => {
    const { server, finishClosing } = fakeServer();
    const order: string[] = [];
    const exit = vi.fn((code: number) => order.push(`exit ${code}`));
    const disconnect = vi.fn(async () => void order.push('database closed'));
    const log = vi.fn();
    const shutdown = createShutdownHandler({ server, disconnect, exit, log });

    shutdown('SIGTERM');
    expect(log).toHaveBeenCalledWith('SIGTERM');
    expect(server.close).toHaveBeenCalledTimes(1);
    expect(disconnect).not.toHaveBeenCalled(); // requests in flight are still being served
    expect(exit).not.toHaveBeenCalled();

    finishClosing(); // the last open request has finished
    await vi.waitFor(() => expect(exit).toHaveBeenCalledWith(0));
    expect(order).toEqual(['database closed', 'exit 0']);
  });

  it('still exits cleanly when closing the database fails', async () => {
    const { server, finishClosing } = fakeServer();
    const exit = vi.fn();
    createShutdownHandler({ server, disconnect: () => Promise.reject(new Error('already closed')), exit, log: vi.fn() })('SIGINT');
    finishClosing();
    await vi.waitFor(() => expect(exit).toHaveBeenCalledWith(0));
  });

  it('gives up after the timeout (exit code 1) if a request never finishes, so a deploy cannot hang', () => {
    const { server } = fakeServer(); // close() never completes
    const exit = vi.fn();
    createShutdownHandler({ server, disconnect: async () => undefined, exit, log: vi.fn(), timeoutMs: 10_000 })('SIGTERM');

    vi.advanceTimersByTime(9_999);
    expect(exit).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(exit).toHaveBeenCalledWith(1);
  });

  it('ignores a second signal while it is already shutting down', () => {
    const { server } = fakeServer();
    const log = vi.fn();
    const shutdown = createShutdownHandler({ server, disconnect: async () => undefined, exit: vi.fn(), log });
    shutdown('SIGTERM');
    shutdown('SIGINT');
    shutdown('SIGTERM');
    expect(server.close).toHaveBeenCalledTimes(1);
    expect(log).toHaveBeenCalledTimes(1);
  });
});
