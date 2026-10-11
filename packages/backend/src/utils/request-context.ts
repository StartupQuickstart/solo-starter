import { AsyncLocalStorage } from 'node:async_hooks';

/** What is known about the request being handled, wherever the code handling it is. */
interface RequestContext {
  readonly requestId: string;
}

const storage = new AsyncLocalStorage<RequestContext>();

/**
 * Runs `callback`, and everything it starts, as part of the request `requestId`.
 *
 * @param requestId - The id of the request
 * @param callback - Usually the `next` of a middleware
 */
export function runWithRequestId<T>(requestId: string, callback: () => T): T {
  return storage.run({ requestId }, callback);
}

/** The id of the request being handled, or `undefined` outside a request (startup, a background job). */
export function getRequestId(): string | undefined {
  return storage.getStore()?.requestId;
}
