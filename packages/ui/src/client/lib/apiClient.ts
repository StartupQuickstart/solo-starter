/**
 * Type-safe API Client
 *
 * A production-ready HTTP client built on the Fetch API with:
 * - Full TypeScript support with generic request/response types
 * - Configurable base URL for different environments
 * - Request/response interceptors for auth, logging, etc.
 * - Automatic JSON parsing with proper error handling
 * - Timeout support with AbortController
 * - Request cancellation support
 *
 * @example Basic usage
 * ```ts
 * import { apiClient } from '@app/ui';
 *
 * // GET request
 * const user = await apiClient.get<User>('/api/users/123');
 *
 * // POST request with body
 * const newUser = await apiClient.post<User>('/api/users', { name: 'John' });
 *
 * // With timeout
 * const data = await apiClient.get<Data>('/api/slow', { timeout: 5000 });
 * ```
 *
 * @example Custom instance with base URL
 * ```ts
 * const api = createApiClient({
 *   baseUrl: 'https://api.example.com',
 *   timeout: 10000,
 * });
 * const data = await api.get<Data>('/users'); // → https://api.example.com/users
 * ```
 *
 * @example With interceptors
 * ```ts
 * const api = createApiClient({
 *   onRequest: (url, options) => {
 *     options.headers = {
 *       ...options.headers,
 *       'Authorization': `Bearer ${getToken()}`,
 *     };
 *     return options;
 *   },
 *   onResponse: (response, data) => {
 *     console.log(`${response.status}: ${response.url}`);
 *     return data;
 *   },
 *   onError: (error) => {
 *     if (error.status === 401) {
 *       redirectToLogin();
 *     }
 *     throw error;
 *   },
 * });
 * ```
 */

import type { ApiResponse } from '../../types/api';

/** Pagination block of a list response envelope. */
export interface PageInfo {
  readonly page: number;
  readonly pageSize: number;
  readonly total: number;
  readonly totalPages: number;
}

/** One page of a paginated list. */
export interface Page<T> {
  readonly items: T[];
  readonly pagination: PageInfo;
}

/** Success envelope as sent by the API; list endpoints add `pagination`. */
type Envelope<T> = ApiResponse<T> & { pagination?: PageInfo };

/**
 * Error thrown when an API request fails.
 * Extends Error with additional context about the failed request.
 */
export class ApiClientError extends Error {
  /** HTTP status code of the failed response */
  readonly status: number;
  /** Machine-readable error code from the API */
  readonly errorCode: string;
  /** Original URL that was requested */
  readonly url: string;
  /** Additional error details from the API */
  readonly details?: unknown;

  constructor(message: string, status: number, url: string, errorCode = 'API_ERROR', details?: unknown) {
    super(message);
    this.name = 'ApiClientError';
    this.status = status;
    this.url = url;
    this.errorCode = errorCode;
    this.details = details;
  }
}

/**
 * Options for individual API requests.
 */
export interface RequestOptions extends Omit<RequestInit, 'body' | 'method'> {
  /** Request timeout in milliseconds. Overrides client default. */
  timeout?: number;
  /** AbortSignal for request cancellation */
  signal?: AbortSignal;
}

/**
 * Configuration options for creating an API client instance.
 */
export interface ApiClientConfig {
  /**
   * Base URL prepended to all requests.
   * @example 'https://api.example.com' or '/api/v1'
   */
  baseUrl?: string;

  /**
   * Default timeout for all requests in milliseconds.
   * Individual requests can override this.
   * @default 30000 (30 seconds)
   */
  timeout?: number;

  /**
   * Default headers applied to all requests.
   * Individual requests can override these.
   */
  headers?: Record<string, string>;

  /**
   * Transform the request path before `baseUrl` is prepended.
   * Use for injecting URL context that applies to every call, e.g. a
   * version path segment. Runs before `onRequest`.
   */
  transformUrl?: (url: string) => string;

  /**
   * Request interceptor called before each request.
   * Use for adding auth headers, logging, etc.
   * @returns Modified options or original options
   */
  onRequest?: (url: string, options: RequestInit) => RequestInit | Promise<RequestInit>;

  /**
   * Response interceptor called after successful responses.
   * Use for logging, transforming data, etc.
   * @returns Modified data or original data
   */
  onResponse?: <T>(response: Response, data: T) => T | Promise<T>;

  /**
   * Error interceptor called when requests fail.
   * Use for global error handling, retries, auth refresh, etc.
   * @throws Should re-throw the error or a new error
   */
  onError?: (error: ApiClientError) => void | Promise<void>;
}

/**
 * Creates a configured API client instance.
 *
 * @param config - Configuration options for the client
 * @returns Configured API client with GET, POST, PUT, PATCH, DELETE methods
 */
export function createApiClient(config: ApiClientConfig = {}) {
  const {
    baseUrl = '',
    timeout: defaultTimeout = 30000,
    headers: defaultHeaders = {},
    transformUrl,
    onRequest,
    onResponse,
    onError,
  } = config;

  /**
   * Internal request handler with full error handling and interceptors.
   */
  async function requestEnvelope<T>(
    method: string,
    url: string,
    body?: unknown,
    options: RequestOptions = {}
  ): Promise<Envelope<T>> {
    const { timeout = defaultTimeout, signal, ...fetchOptions } = options;

    // Build full URL
    const fullUrl = baseUrl + (transformUrl ? transformUrl(url) : url);

    // Setup abort controller for timeout
    const controller = new AbortController();
    const timeoutId = timeout > 0 ? setTimeout(() => controller.abort(), timeout) : null;

    // Combine signals if external signal provided
    const combinedSignal = signal ? anySignal([signal, controller.signal]) : controller.signal;

    // Build request options
    let requestOptions: RequestInit = {
      method,
      headers: {
        ...defaultHeaders,
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...((fetchOptions.headers as Record<string, string>) || {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: combinedSignal,
      ...fetchOptions,
    };

    // Apply request interceptor
    if (onRequest) {
      requestOptions = await onRequest(fullUrl, requestOptions);
    }

    try {
      const response = await fetch(fullUrl, requestOptions);

      // Clear timeout on response
      if (timeoutId) clearTimeout(timeoutId);

      // Handle non-OK responses
      if (!response.ok) {
        let errorMessage = 'Request failed';
        let errorCode = 'API_ERROR';
        let details: unknown;

        try {
          // Canonical API error envelope: { success: false, code, message, details? }
          const errorData = (await response.json()) as {
            code?: string;
            message?: string;
            details?: unknown;
          };
          errorMessage = errorData.message || errorMessage;
          errorCode = errorData.code || errorCode;
          details = errorData.details;
        } catch {
          // Response body not JSON, use status text
          errorMessage = response.statusText || errorMessage;
        }

        const error = new ApiClientError(errorMessage, response.status, fullUrl, errorCode, details);

        if (onError) {
          await onError(error);
        }

        throw error;
      }

      // Handle empty responses (204 No Content)
      if (response.status === 204) {
        return { data: undefined as T };
      }

      // Parse JSON response
      const result = (await response.json()) as Envelope<T>;
      let data = result.data;

      // Apply response interceptor
      if (onResponse) {
        data = await onResponse(response, data);
      }

      return { ...result, data };
    } catch (error) {
      // Clear timeout on error
      if (timeoutId) clearTimeout(timeoutId);

      // Handle abort errors
      if (error instanceof Error && error.name === 'AbortError') {
        // The caller's own signal and the timeout both abort the request; say which.
        const abortError = signal?.aborted
          ? new ApiClientError('Request aborted', 0, fullUrl, 'ABORTED')
          : new ApiClientError('Request timeout', 0, fullUrl, 'TIMEOUT');
        if (onError) await onError(abortError);
        throw abortError;
      }

      // Re-throw ApiClientError as-is
      if (error instanceof ApiClientError) {
        throw error;
      }

      // Wrap unexpected errors
      const wrappedError = new ApiClientError(
        error instanceof Error ? error.message : 'Unknown error',
        0,
        fullUrl,
        'NETWORK_ERROR'
      );
      if (onError) await onError(wrappedError);
      throw wrappedError;
    }
  }

  async function request<T>(method: string, url: string, body?: unknown, options: RequestOptions = {}): Promise<T> {
    return (await requestEnvelope<T>(method, url, body, options)).data;
  }

  return {
    /**
     * Perform a GET request.
     * @template T - Expected response data type
     * @param url - Request URL (appended to baseUrl)
     * @param options - Optional request configuration
     * @returns Parsed response data
     */
    get<T>(url: string, options?: RequestOptions): Promise<T> {
      return request<T>('GET', url, undefined, options);
    },

    /**
     * GET a paginated list, keeping the envelope's `pagination` alongside the
     * items (plain `get` returns only `data`).
     * @template T - Item type
     * @throws ApiClientError (`INVALID_RESPONSE`) when the response carries no pagination
     */
    async getPage<T>(url: string, options?: RequestOptions): Promise<Page<T>> {
      const envelope = await requestEnvelope<T[]>('GET', url, undefined, options);
      if (!envelope.pagination) {
        throw new ApiClientError('Response is missing pagination', 0, baseUrl + url, 'INVALID_RESPONSE');
      }
      return { items: envelope.data, pagination: envelope.pagination };
    },

    /**
     * Perform a POST request.
     * @template T - Expected response data type
     * @param url - Request URL (appended to baseUrl)
     * @param body - Request body (will be JSON stringified)
     * @param options - Optional request configuration
     * @returns Parsed response data
     */
    post<T>(url: string, body?: unknown, options?: RequestOptions): Promise<T> {
      return request<T>('POST', url, body, options);
    },

    /**
     * Perform a PUT request.
     * @template T - Expected response data type
     * @param url - Request URL (appended to baseUrl)
     * @param body - Request body (will be JSON stringified)
     * @param options - Optional request configuration
     * @returns Parsed response data
     */
    put<T>(url: string, body?: unknown, options?: RequestOptions): Promise<T> {
      return request<T>('PUT', url, body, options);
    },

    /**
     * Perform a PATCH request.
     * @template T - Expected response data type
     * @param url - Request URL (appended to baseUrl)
     * @param body - Request body (will be JSON stringified)
     * @param options - Optional request configuration
     * @returns Parsed response data
     */
    patch<T>(url: string, body?: unknown, options?: RequestOptions): Promise<T> {
      return request<T>('PATCH', url, body, options);
    },

    /**
     * Perform a DELETE request.
     * @template T - Expected response data type
     * @param url - Request URL (appended to baseUrl)
     * @param options - Optional request configuration
     * @param body - Optional request body, for a delete that asks for a
     *   confirmation (the name typed to confirm, for example)
     * @returns Parsed response data
     */
    delete<T>(url: string, options?: RequestOptions, body?: unknown): Promise<T> {
      return request<T>('DELETE', url, body, options);
    },
  };
}

/**
 * Combines multiple AbortSignals into one.
 * Aborts when any of the input signals abort.
 */
function anySignal(signals: AbortSignal[]): AbortSignal {
  const controller = new AbortController();

  for (const signal of signals) {
    if (signal.aborted) {
      controller.abort(signal.reason);
      return controller.signal;
    }
    signal.addEventListener('abort', () => controller.abort(signal.reason), { once: true });
  }

  return controller.signal;
}

/**
 * Default API client instance.
 * Use this for most cases, or create a custom instance with createApiClient().
 */
export const apiClient = createApiClient();
