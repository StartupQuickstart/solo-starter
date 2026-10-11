export interface WaitForDatabaseOptions {
  readonly attempts: number;
  readonly delayMs: number;
  readonly sleep?: (ms: number) => Promise<void>;
  readonly log?: (message: string) => void;
}

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Run `probe` until it succeeds, up to `attempts` times, `delayMs` apart.
 * Rethrows the last failure, so the caller can exit and let the platform
 * restart it rather than serve requests without a database. A database that
 * is waking or restarting refuses connections for a few seconds; this rides
 * that out.
 */
export async function waitForDatabase(
  probe: () => Promise<void>,
  { attempts, delayMs, sleep = defaultSleep, log = () => undefined }: WaitForDatabaseOptions,
): Promise<void> {
  for (let attempt = 1; ; attempt++) {
    try {
      await probe();
      return;
    } catch (error) {
      if (attempt >= attempts) throw error;
      // Prisma's messages open with a blank line; report the first real one.
      const message = error instanceof Error ? error.message : String(error);
      const reason = message.split('\n').find((line) => line.trim()) ?? message;
      log(`[startup] Database not ready (attempt ${attempt}/${attempts}): ${reason}`);
      await sleep(delayMs);
    }
  }
}
