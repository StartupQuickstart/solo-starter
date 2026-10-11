/**
 * Standard API Response Types
 *
 * These types define a consistent API response format following
 * RESTful best practices. Use these types for both client and server
 * to ensure type safety across the API boundary.
 *
 * @example
 * // Server-side response
 * return NextResponse.json<ApiResponse<User>>({ data: user });
 *
 * // Client-side consumption
 * const { data } = await apiClient.get<User>('/api/users/123');
 */

/**
 * Pagination metadata for list responses.
 * Provides all necessary information for implementing pagination UI.
 */
export interface ApiPagination {
  /** Total number of records across all pages */
  totalCount: number;
  /** Current page number (1-indexed) */
  currentPage: number;
  /** Number of records per page */
  pageSize: number;
  /** Total number of pages */
  totalPages: number;
  /** Offset from start (0-indexed) */
  offset: number;
  /** Maximum records returned (same as pageSize) */
  limit: number;
}

/**
 * Navigation links for paginated responses.
 * Enables HATEOAS-style navigation between pages.
 */
export interface ApiLinks {
  /** Current request URL */
  self: string;
  /** Previous page URL (if exists) */
  prev?: string;
  /** Next page URL (if exists) */
  next?: string;
  /** First page URL */
  first?: string;
  /** Last page URL */
  last?: string;
}

/**
 * Combined metadata for list responses.
 * Extends pagination with navigation links for convenience.
 */
export interface ApiListMetadata extends ApiPagination, ApiLinks {
  /** Alias for currentPage for simpler access */
  page: number;
  /** Nested pagination data */
  pagination: ApiPagination;
  /** Nested links data */
  links: ApiLinks;
}

/**
 * Standard error object returned in API error responses.
 * Provides both human-readable messages and machine-readable codes.
 */
export interface ApiError {
  /** Human-readable error message suitable for display */
  message: string;
  /** Machine-readable error code for programmatic handling */
  errorCode: string;
  /** Optional additional details (validation errors, field-specific errors, etc.) */
  details?: unknown;
}

/**
 * Standard success response wrapper for single items.
 *
 * @template T - The type of the data payload
 *
 * @example
 * interface User { id: string; name: string; }
 * const response: ApiResponse<User> = { data: { id: '1', name: 'John' } };
 */
export interface ApiResponse<T> {
  /** The response payload */
  data: T;
  /** Optional metadata (timestamps, computed values, etc.) */
  meta?: Record<string, unknown>;
}

/**
 * Standard success response wrapper for lists with pagination.
 *
 * @template T - The type of items in the list
 *
 * @example
 * const response: ApiListResponse<User> = {
 *   data: [{ id: '1', name: 'John' }],
 *   meta: { totalCount: 100, currentPage: 1, ... }
 * };
 */
export interface ApiListResponse<T> {
  /** Array of items */
  data: T[];
  /** Pagination and navigation metadata */
  meta: ApiListMetadata;
}

/**
 * Standard error response wrapper.
 * Contains an array of errors to support multiple validation errors.
 *
 * @example
 * const errorResponse: ApiErrorResponse = {
 *   errors: [
 *     { message: 'Email is required', errorCode: 'VALIDATION_ERROR' },
 *     { message: 'Password too short', errorCode: 'VALIDATION_ERROR' }
 *   ]
 * };
 */
export interface ApiErrorResponse {
  /** Array of error objects */
  errors: ApiError[];
}

/**
 * Options for building paginated responses server-side.
 */
export interface PaginationOptions {
  /** Current page number (1-indexed) */
  page: number;
  /** Number of records per page */
  pageSize: number;
  /** Base URL for building navigation links */
  baseUrl: string;
  /** Additional query parameters to preserve in links */
  queryParams?: Record<string, string>;
}

/**
 * Standard HTTP status codes used in API responses.
 * Use these constants instead of magic numbers for clarity.
 *
 * @example
 * return NextResponse.json(data, { status: HTTP_STATUS.CREATED });
 */
export const HTTP_STATUS = {
  /** Request succeeded */
  OK: 200,
  /** Resource created successfully */
  CREATED: 201,
  /** Request succeeded with no content to return */
  NO_CONTENT: 204,
  /** Invalid request syntax or parameters */
  BAD_REQUEST: 400,
  /** Authentication required */
  UNAUTHORIZED: 401,
  /** Authenticated but not authorized for this resource */
  FORBIDDEN: 403,
  /** Resource not found */
  NOT_FOUND: 404,
  /** Request conflicts with current state (e.g., duplicate) */
  CONFLICT: 409,
  /** Request well-formed but semantically invalid */
  UNPROCESSABLE_ENTITY: 422,
  /** Unexpected server error */
  INTERNAL_SERVER_ERROR: 500,
} as const;

/** Union type of all HTTP status code values */
export type HttpStatus = (typeof HTTP_STATUS)[keyof typeof HTTP_STATUS];
