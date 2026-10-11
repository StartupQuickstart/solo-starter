/**
 * Basic server configuration interface
 * @deprecated Use ServerConfig from config module instead
 */
export interface BasicServerConfig {
  port: number;
  host: string;
  logger: boolean;
}

/**
 * Standard API error response interface
 */
export interface ErrorResponse {
  error: boolean;
  message: string;
  statusCode: number;
  timestamp: string;
}

/**
 * Standard API success response interface
 */
export interface SuccessResponse<T = any> {
  success: boolean;
  data: T;
  timestamp: string;
}
