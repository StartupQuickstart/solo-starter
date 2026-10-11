import { Logtail } from '@logtail/node';
import { LogtailTransport } from '@logtail/winston';
import winston from 'winston';

import { getRequestId } from './request-context';

/**
 * Professional logging configuration using Winston
 * 
 * Features:
 * - Structured JSON logging in production
 * - Human-readable console logging in development
 * - Multiple log levels (error, warn, info, debug)
 * - File rotation for production
 * - Contextual metadata support
 */

// Define custom log levels and colors
const logLevels = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
};

const logColors = {
  error: 'red',
  warn: 'yellow', 
  info: 'green',
  debug: 'blue',
};

// Add colors to winston
winston.addColors(logColors);

/**
 * Custom format for development - human readable with colors
 */
const developmentFormat = winston.format.combine(
  winston.format.timestamp({ format: 'HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.colorize(),
  winston.format.printf(({ timestamp, level, message, service: _service, ...metadata }) => {
    // Remove service field and other clutter
    const cleanMetadata = { ...metadata };
    delete cleanMetadata.service;
    
    let metaString = '';
    if (Object.keys(cleanMetadata).length > 0) {
      metaString = ` ${JSON.stringify(cleanMetadata)}`;
    }
    return `${timestamp} ${level}: ${message}${metaString}`;
  })
);

/**
 * Production format - structured JSON with metadata
 */
const productionFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json(),
  winston.format.metadata({ fillExcept: ['message', 'level', 'timestamp'] })
);

/**
 * Adds the id of the request being handled to a log line, as `requestId`.
 * Lines written outside a request (startup, background work) are left alone.
 * It runs on the logger itself, so every child logger and transport gets it.
 */
const requestIdFormat = winston.format((info) => {
  const requestId = getRequestId();
  if (requestId !== undefined) info.requestId = requestId;
  return info;
});

/**
 * Create transports based on environment
 */
const createTransports = (): winston.transport[] => {
  const transports: winston.transport[] = [];

  if (process.env.NODE_ENV === 'production') {
    // Production: File logging with rotation
    transports.push(
      new winston.transports.File({
        filename: 'logs/error.log',
        level: 'error',
        maxsize: 5242880, // 5MB
        maxFiles: 10,
        format: productionFormat,
      }),
      new winston.transports.File({
        filename: 'logs/combined.log',
        maxsize: 5242880, // 5MB
        maxFiles: 10,
        format: productionFormat,
      })
    );

    // Also log to console in production for container environments
    transports.push(
      new winston.transports.Console({
        format: productionFormat,
      })
    );
  } else {
    // Development: Console logging with colors
    transports.push(
      new winston.transports.Console({
        format: developmentFormat,
      })
    );
  }

  // Better Stack (Logtail) live log stream, enabled when a source token is
  // set. LOGTAIL_INGESTING_HOST is required for newer Better Stack sources
  // that use a source-specific ingest host; older sources use the default.
  const logtailToken = process.env.LOGTAIL_SOURCE_TOKEN;
  if (logtailToken) {
    const logtail = new Logtail(logtailToken, {
      ...(process.env.LOGTAIL_INGESTING_HOST
        ? { endpoint: `https://${process.env.LOGTAIL_INGESTING_HOST}` }
        : {}),
    });
    transports.push(new LogtailTransport(logtail, { format: productionFormat }));
  }

  return transports;
};

/**
 * Create the main logger instance
 */
const logger = winston.createLogger({
  levels: logLevels,
  format: requestIdFormat(),
  level: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug'),
  transports: createTransports(),
  // Identifies which deployed service a log line came from when multiple
  // services share a log sink (e.g. one Better Stack source).
  defaultMeta: process.env.RAILWAY_SERVICE_NAME
    ? { app: process.env.RAILWAY_SERVICE_NAME }
    : undefined,
  // Don't exit on handled exceptions
  exitOnError: false,
  // Handle uncaught exceptions
  exceptionHandlers: [
    new winston.transports.File({ 
      filename: 'logs/exceptions.log',
      format: productionFormat,
    })
  ],
  // Handle unhandled promise rejections  
  rejectionHandlers: [
    new winston.transports.File({ 
      filename: 'logs/rejections.log',
      format: productionFormat,
    })
  ]
});

/**
 * Create a child logger with additional context
 * @param context - Additional context to include in all log messages
 * @returns Child logger instance
 */
export const createChildLogger = (context: Record<string, any>) => {
  return logger.child(context);
};

/**
 * Database-specific logger with [Database] prefix
 */
export const dbLogger = createChildLogger({ service: 'database' });

/**
 * Auth-specific logger with [Auth] prefix  
 */
export const authLogger = createChildLogger({ service: 'auth' });

/**
 * API-specific logger with [API] prefix
 */
export const apiLogger = createChildLogger({ service: 'api' });

/**
 * Application-specific logger with [App] prefix
 */
export const appLogger = createChildLogger({ service: 'app' });

export default logger;