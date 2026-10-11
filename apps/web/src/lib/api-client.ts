'use client';

import { useAuth } from '@clerk/nextjs';
import { ApiClientError, createApiClient, type ApiClientConfig } from '@app/ui';
import { useCallback, useMemo } from 'react';
import { z } from 'zod';

import { readRuntimeEnv } from '@/config/app.config';

/** The header that carries the Clerk session token, when there is one. */
function authorization(token: string | null): Record<string, string> {
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/**
 * Returns a configured API client instance that sends the Clerk session token
 * as a bearer token on every request and points at `NEXT_PUBLIC_API_URL`.
 * Whose data comes back is decided by the API from that token alone.
 *
 * @returns Typed API client (get/getPage/post/put/patch/delete)
 *
 * @example
 * ```tsx
 * const api = useApiClient();
 * const billing = billingSchema.parse(await api.get('/api/v1/billing'));
 * ```
 */
export function useApiClient() {
  const { getToken } = useAuth();

  return useMemo(() => {
    const config: ApiClientConfig = {
      baseUrl: readRuntimeEnv().apiUrl,
      onRequest: async (_url, options) => ({
        ...options,
        headers: { ...(options.headers as Record<string, string>), ...authorization(await getToken()) },
      }),
    };

    return createApiClient(config);
  }, [getToken]);
}

/** The API's error envelope, as far as a failed download needs it. */
const errorEnvelopeSchema = z.object({ code: z.string(), message: z.string() });

const FALLBACK_ERROR = { code: 'API_ERROR', message: 'Request failed' } as const;

/**
 * Fetches a file from the API (an endpoint that answers with a document, not
 * the JSON envelope), with the same bearer token as `useApiClient`.
 *
 * @returns A function resolving to the file's contents.
 * @throws ApiClientError with the API's code and message when it refuses.
 */
export function useApiDownload(): (path: string) => Promise<Blob> {
  const { getToken } = useAuth();

  return useCallback(
    async (path: string) => {
      const url = readRuntimeEnv().apiUrl + path;
      const response = await fetch(url, { headers: authorization(await getToken()) });
      if (response.ok) return response.blob();

      const body: unknown = await response.json().catch(() => undefined);
      const parsed = errorEnvelopeSchema.safeParse(body);
      const { code, message } = parsed.success ? parsed.data : FALLBACK_ERROR;
      throw new ApiClientError(message, response.status, url, code);
    },
    [getToken],
  );
}
