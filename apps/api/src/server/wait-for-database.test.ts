import { describe, expect, it, vi } from 'vitest';
import { waitForDatabase } from './wait-for-database';

const noSleep = () => Promise.resolve();

describe('waitForDatabase', () => {
  it('returns as soon as the probe succeeds', async () => {
    const probe = vi.fn().mockResolvedValue(undefined);

    await waitForDatabase(probe, {
      attempts: 5,
      delayMs: 1000,
      sleep: noSleep,
    });

    expect(probe).toHaveBeenCalledTimes(1);
  });

  it('retries while the database is starting up, waiting between attempts', async () => {
    const probe = vi
      .fn()
      .mockRejectedValueOnce(new Error('the database system is starting up'))
      .mockRejectedValueOnce(new Error('the database system is starting up'))
      .mockResolvedValue(undefined);
    const sleep = vi.fn(noSleep);

    await waitForDatabase(probe, { attempts: 5, delayMs: 2500, sleep });

    expect(probe).toHaveBeenCalledTimes(3);
    expect(sleep).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledWith(2500);
  });

  it('logs the first non-blank line of each failure', async () => {
    const probe = vi
      .fn()
      .mockRejectedValueOnce(
        new Error("\nCan't reach database server at `db:5432`\n\nPlease make sure..."),
      )
      .mockResolvedValue(undefined);
    const log = vi.fn();

    await waitForDatabase(probe, {
      attempts: 3,
      delayMs: 1000,
      sleep: noSleep,
      log,
    });

    expect(log).toHaveBeenCalledWith(
      "[startup] Database not ready (attempt 1/3): Can't reach database server at `db:5432`",
    );
  });

  it('rethrows the last failure once attempts run out', async () => {
    const probe = vi.fn().mockRejectedValue(new Error('connection refused'));

    await expect(
      waitForDatabase(probe, { attempts: 3, delayMs: 1000, sleep: noSleep }),
    ).rejects.toThrow('connection refused');
    expect(probe).toHaveBeenCalledTimes(3);
  });
});
