import { apiLogger } from '@/utils/logger';
import { Request } from 'express';
import morgan from 'morgan';

/**
 * Morgan middleware integrated with Winston logger
 *
 * Features:
 * - Standard Morgan format with response time and status
 * - Logs through Winston for consistent formatting
 * - Different log levels based on status codes
 * - Skips health check and other utility routes
 */

// Create a custom stream that writes to Winston
const morganStream = {
  write: (message: string) => {
    // Remove trailing newline and parse the log message
    const cleanMessage = message.trim();

    // Extract status code to determine log level
    const statusMatch = cleanMessage.match(/\s(\d{3})\s/);
    const status = statusMatch ? parseInt(statusMatch[1]) : 200;

    // Determine log level based on status code
    if (status >= 500) {
      apiLogger.error(cleanMessage);
    } else if (status >= 400) {
      apiLogger.warn(cleanMessage);
    } else {
      apiLogger.info(cleanMessage);
    }
  },
};

/**
 * Create Morgan middleware with Winston integration
 */
export function createRequestLogger() {
  // Simplified format for development (no user-agent)
  const devFormat = ':method :url :status :response-time ms';
  const format = process.env.NODE_ENV === 'production' ? 'combined' : devFormat;

  return morgan(format, {
    stream: morganStream,
    // Skip logging for health checks and static assets
    skip: req => {
      return !!(
        req.url === '/health' ||
        req.url === '/favicon.ico' ||
        req.url === '/robots.txt' ||
        req.url?.startsWith('/static/')
      );
    },
  });
}

/**
 * Enhanced Morgan middleware with custom tokens
 */
export function createEnhancedRequestLogger() {
  // Define custom Morgan tokens
  morgan.token('user-id', (req: Request) => {
    const { user } = req.provisioned || {};
    return user?.id || 'anonymous';
  });

  // Custom format with the signed-in user (no user-agent)
  const customFormat = ':method :url :status :response-time ms - user: :user-id';

  return morgan(customFormat, {
    stream: morganStream,
    skip: req => {
      return !!(
        req.url === '/health' ||
        req.url === '/favicon.ico' ||
        req.url === '/robots.txt' ||
        req.url?.startsWith('/static/')
      );
    },
  });
}
