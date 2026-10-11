import { HelmetOptions } from 'helmet';

/**
 * Application configuration system
 * Provides a structured way to manage app features, settings, and environment configuration
 */
import { Logger } from 'winston';
import { appLogger } from '../utils';

/**
 * Feature configuration interface
 * Each feature can be enabled/disabled and have additional settings
 */
export interface FeatureConfig {
  enabled: boolean;
  [key: string]: any; // Allow additional feature-specific config
}

/**
 * Core application features that can be configured
 */
export interface AppFeatures {
  media: FeatureConfig & {
    maxFileSize?: number;
    allowedTypes?: string[];
    storageProvider?: 'local' | 's3';
  };
  billing: FeatureConfig & {
    provider?: 'stripe';
    currency?: string;
    taxCalculation?: boolean;
  };
}

/**
 * Database configuration
 */
export interface AppDatabaseConfig {
  url: string;
  maxConnections?: number;
  ssl?: boolean;
  timeout?: number;
}

/**
 * Server configuration
 */
export interface ServerConfig {
  port: number;
  host: string;
  cors: {
    origin: string | string[] | boolean;
    credentials: boolean;
    methods?: string[];
    allowedHeaders?: string[];
  };
  helmet?: HelmetOptions;
  rateLimit?: {
    windowMs: number;
    max: number;
  };
}

/**
 * Authentication configuration
 */
export interface AuthConfig {
  provider: 'clerk' | 'auth0' | 'custom';
  sessionTimeout?: number;
  requireEmailVerification?: boolean;
  enableMfa?: boolean;
}

/**
 * Complete application configuration
 */
export interface AppConfig {
  /**
   * Application metadata
   */
  app: {
    name: string;
    version: string;
    description?: string;
    environment: 'development' | 'production' | 'test';
  };

  /**
   * Feature flags and configurations
   */
  features: AppFeatures;

  /**
   * Server configuration
   */
  server: ServerConfig;

  /**
   * Database configuration
   */
  database?: AppDatabaseConfig;

  /**
   * Authentication configuration
   */
  auth: AuthConfig;

  /**
   * External service configurations
   */
  services?: {
    stripe?: {
      publishableKey: string;
      secretKey?: string;
      webhookSecret?: string;
    };
    sendgrid?: {
      apiKey: string;
      fromEmail: string;
    };
    s3?: {
      bucket: string;
      region: string;
      accessKeyId?: string;
      secretAccessKey?: string;
    };
  };
}

/**
 * Default minimal application configuration
 * Applications should extend this with their specific needs
 */
export const createDefaultAppConfig = (overrides: Partial<AppConfig> = {}): AppConfig => {
  const defaultConfig: AppConfig = {
    app: {
      name: 'My App',
      version: '1.0.0',
      environment: (process.env.NODE_ENV as any) || 'development',
    },
    features: {
      media: {
        enabled: true,
        maxFileSize: 5 * 1024 * 1024, // 5MB
        allowedTypes: ['image/jpeg', 'image/png', 'image/gif'],
        storageProvider: 'local',
      },
      billing: {
        enabled: false,
        provider: 'stripe',
        currency: 'usd',
      },
    },
    server: {
      port: parseInt(process.env.PORT || '3001'),
      host: process.env.HOST || '0.0.0.0',
      cors: {
        origin: process.env.CORS_ORIGIN
          ? process.env.CORS_ORIGIN.split(',').map(o => o.trim()).filter(Boolean)
          : true,
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
      },
    },
    auth: {
      provider: 'clerk',
      requireEmailVerification: true,
      enableMfa: false,
    },
  };

  return mergeDeep(defaultConfig, overrides);
};

/**
 * Deep merge utility for configuration objects
 */
function mergeDeep<T>(target: T, source: Partial<T>): T {
  const result = { ...target };

  for (const key in source) {
    if (source[key] !== undefined) {
      if (isObject(target[key]) && isObject(source[key])) {
        (result as any)[key] = mergeDeep(target[key], source[key]);
      } else {
        (result as any)[key] = source[key];
      }
    }
  }

  return result;
}

function isObject(item: any): item is Record<string, any> {
  return item && typeof item === 'object' && !Array.isArray(item);
}

/**
 * Configuration service for managing app config
 */
export class AppConfigService {
  private config: AppConfig;
  logger: Logger;

  /**
   * Initialize the configuration service with app config
   */
  constructor(config: AppConfig) {
    this.config = config;
    this.logger = appLogger;
  }

  /**
   * Get the complete app configuration
   */
  getConfig(): AppConfig {
    return this.config;
  }

  /**
   * Get feature configuration
   */
  getFeatures(): AppFeatures {
    return this.getConfig().features;
  }

  /**
   * Check if a feature is enabled
   */
  isFeatureEnabled(featureName: keyof AppFeatures): boolean {
    const features = this.getFeatures();
    return features[featureName]?.enabled ?? false;
  }

  /**
   * Get configuration for a specific feature
   */
  getFeatureConfig<T extends keyof AppFeatures>(featureName: T): AppFeatures[T] {
    const features = this.getFeatures();
    return features[featureName];
  }

  /**
   * Get server configuration
   */
  getServerConfig(): ServerConfig {
    return this.getConfig().server;
  }

  /**
   * Get database configuration
   */
  getAppDatabaseConfig(): AppDatabaseConfig | undefined {
    return this.getConfig().database;
  }

  /**
   * Get auth configuration
   */
  getAuthConfig(): AuthConfig {
    return this.getConfig().auth;
  }

  /**
   * Check if running in production
   */
  isProduction(): boolean {
    return this.getConfig().app.environment === 'production';
  }

  /**
   * Check if running in development
   */
  isDevelopment(): boolean {
    return this.getConfig().app.environment === 'development';
  }

  /**
   * Log the current configuration (excluding sensitive info)
   */
  log() {
    this.logger.info('App configuration loaded', {
      environment: this.getConfig().app.environment,
      features: this.getFeatures(),
      server: this.getServerConfig(),
      database: this.getAppDatabaseConfig() ? { ...this.getAppDatabaseConfig(), url: '***' } : null,
      auth: this.getAuthConfig(),
    });
  }

  // Static methods for backward compatibility
  private static globalInstance: AppConfigService;

  /**
   * Initialize the global configuration service instance
   */
  static initialize(config: AppConfig) {
    this.globalInstance = new AppConfigService(config);
  }

  /**
   * Get the global configuration service instance
   */
  static getInstance(): AppConfigService {
    if (!this.globalInstance) {
      throw new Error('AppConfigService not initialized. Call initialize() first.');
    }
    return this.globalInstance;
  }

  // Static methods that delegate to the global instance
  static getConfig(): AppConfig {
    return this.getInstance().getConfig();
  }

  static getFeatures(): AppFeatures {
    return this.getInstance().getFeatures();
  }

  static isFeatureEnabled(featureName: keyof AppFeatures): boolean {
    return this.getInstance().isFeatureEnabled(featureName);
  }

  static getFeatureConfig<T extends keyof AppFeatures>(featureName: T): AppFeatures[T] {
    return this.getInstance().getFeatureConfig(featureName);
  }

  static getServerConfig(): ServerConfig {
    return this.getInstance().getServerConfig();
  }

  static getAppDatabaseConfig(): AppDatabaseConfig | undefined {
    return this.getInstance().getAppDatabaseConfig();
  }

  static getAuthConfig(): AuthConfig {
    return this.getInstance().getAuthConfig();
  }

  static isProduction(): boolean {
    return this.getInstance().isProduction();
  }

  static isDevelopment(): boolean {
    return this.getInstance().isDevelopment();
  }

  static log() {
    return this.getInstance().log();
  }
}
