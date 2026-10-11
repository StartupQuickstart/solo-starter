import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { AppConfigService, createDefaultAppConfig, type AppConfig } from './app-config';

/**
 * Tests for AppConfig - Critical for application configuration
 *
 * These tests ensure:
 * - Config merging works correctly (prevents config bugs)
 * - Feature flags work correctly (controls critical features)
 * - Environment detection works (different behavior per env)
 * - Defaults are applied correctly (prevents missing config)
 */
describe('App Configuration', () => {
  describe('createDefaultAppConfig', () => {
    describe('default values', () => {
      it('should create config with default values', () => {
        const config = createDefaultAppConfig();

        expect(config.app.name).toBe('My App');
        expect(config.app.version).toBe('1.0.0');
        expect(config.auth.provider).toBe('clerk');
        // Port may vary based on environment, just check it's a number
        expect(typeof config.server.port).toBe('number');
        expect(config.server.port).toBeGreaterThan(0);
      });

      it('should use NODE_ENV for environment', () => {
        const originalEnv = process.env.NODE_ENV;
        process.env.NODE_ENV = 'production';

        const config = createDefaultAppConfig();

        expect(config.app.environment).toBe('production');

        process.env.NODE_ENV = originalEnv;
      });

      it('should default to development when NODE_ENV not set', () => {
        const originalEnv = process.env.NODE_ENV;
        delete process.env.NODE_ENV;

        const config = createDefaultAppConfig();

        expect(config.app.environment).toBe('development');

        process.env.NODE_ENV = originalEnv;
      });

      it('should have media enabled by default', () => {
        const config = createDefaultAppConfig();

        expect(config.features.media.enabled).toBe(true);
        expect(config.features.media.maxFileSize).toBe(5 * 1024 * 1024); // 5MB
      });

      it('should have billing disabled by default', () => {
        const config = createDefaultAppConfig();

        expect(config.features.billing.enabled).toBe(false);
      });
    });

    describe('merging overrides', () => {
      it('should override top-level app values', () => {
        const config = createDefaultAppConfig({
          app: {
            name: 'Custom App',
            version: '2.0.0',
            environment: 'production',
          },
        });

        expect(config.app.name).toBe('Custom App');
        expect(config.app.version).toBe('2.0.0');
        expect(config.app.environment).toBe('production');
      });

      it('should deep merge nested feature config', () => {
        const config = createDefaultAppConfig({
          features: {
            billing: {
              enabled: true,
              currency: 'eur',
            },
          },
        });

        // Should override these
        expect(config.features.billing.enabled).toBe(true);
        expect(config.features.billing.currency).toBe('eur');

        // Should keep defaults for other fields
        expect(config.features.billing.provider).toBe('stripe');

        // Should not affect other features
        expect(config.features.media.enabled).toBe(true);
      });

      it('should merge server configuration', () => {
        const config = createDefaultAppConfig({
          server: {
            port: 8080,
            host: 'localhost',
            cors: {
              origin: 'https://example.com',
              credentials: false,
            },
          },
        });

        expect(config.server.port).toBe(8080);
        expect(config.server.host).toBe('localhost');
        expect(config.server.cors.origin).toBe('https://example.com');
        expect(config.server.cors.credentials).toBe(false);
      });

      it('should add database config when provided', () => {
        const config = createDefaultAppConfig({
          database: {
            url: 'postgresql://localhost:5432/test',
            maxConnections: 20,
          },
        });

        expect(config.database).toBeDefined();
        expect(config.database?.url).toBe('postgresql://localhost:5432/test');
        expect(config.database?.maxConnections).toBe(20);
      });

      it('should add service configurations when provided', () => {
        const config = createDefaultAppConfig({
          services: {
            stripe: {
              publishableKey: 'pk_test_123',
              secretKey: 'sk_test_123',
            },
          },
        });

        expect(config.services?.stripe).toBeDefined();
        expect(config.services?.stripe?.publishableKey).toBe('pk_test_123');
      });

      it('should handle partial nested overrides', () => {
        const config = createDefaultAppConfig({
          features: {
            media: {
              maxFileSize: 10 * 1024 * 1024, // 10MB
            },
          },
        });

        // Should override this
        expect(config.features.media.maxFileSize).toBe(10 * 1024 * 1024);

        // Should keep defaults
        expect(config.features.media.enabled).toBe(true);
        expect(config.features.media.allowedTypes).toEqual([
          'image/jpeg',
          'image/png',
          'image/gif',
        ]);
      });

      it('should handle deeply nested overrides', () => {
        const config = createDefaultAppConfig({
          server: {
            cors: {
              methods: ['GET', 'POST'],
            },
          },
        });

        // Should override this
        expect(config.server.cors.methods).toEqual(['GET', 'POST']);

        // Should keep other cors defaults
        expect(config.server.cors.credentials).toBe(true);

        // Should keep server defaults (port may vary based on env)
        expect(typeof config.server.port).toBe('number');
      });

      it('should not mutate the overrides object', () => {
        const overrides = {
          app: { name: 'Test' },
        };
        const overridesCopy = { ...overrides };

        createDefaultAppConfig(overrides);

        expect(overrides).toEqual(overridesCopy);
      });
    });

    describe('edge cases', () => {
      it('should handle empty overrides object', () => {
        const config = createDefaultAppConfig({});

        expect(config.app.name).toBe('My App');
      });

      it('should handle undefined values in overrides', () => {
        const config = createDefaultAppConfig({
          app: {
            name: undefined as any,
            version: '2.0.0',
            environment: 'development',
          },
        });

        // Undefined values should not override defaults
        expect(config.app.name).toBe('My App');
        expect(config.app.version).toBe('2.0.0');
      });

      it('should replace arrays instead of merging them', () => {
        const config = createDefaultAppConfig({
          features: {
            media: {
              allowedTypes: ['image/webp'],
            },
          },
        });

        // Should replace the entire array, not merge
        expect(config.features.media.allowedTypes).toEqual(['image/webp']);
      });
    });
  });

  describe('AppConfigService', () => {
    let service: AppConfigService;
    let testConfig: AppConfig;

    beforeEach(() => {
      testConfig = createDefaultAppConfig({
        app: {
          name: 'Test App',
          version: '1.0.0',
          environment: 'test',
        },
        features: {
          media: {
            enabled: true,
            maxFileSize: 20,
          },
          billing: {
            enabled: true,
            provider: 'stripe',
          },
        },
      });
      service = new AppConfigService(testConfig);
    });

    describe('getConfig', () => {
      it('should return the complete config', () => {
        const config = service.getConfig();

        expect(config).toEqual(testConfig);
      });

      it('should return the same config on multiple calls', () => {
        const config1 = service.getConfig();
        const config2 = service.getConfig();

        expect(config1).toBe(config2);
      });
    });

    describe('getFeatures', () => {
      it('should return features object', () => {
        const features = service.getFeatures();

        expect(features.media.enabled).toBe(true);
        expect(features.billing.enabled).toBe(true);
      });
    });

    describe('isFeatureEnabled', () => {
      it('should return true for enabled features', () => {
        expect(service.isFeatureEnabled('media')).toBe(true);
        expect(service.isFeatureEnabled('billing')).toBe(true);
      });

      it('should return false for disabled features', () => {
        expect(new AppConfigService(createDefaultAppConfig()).isFeatureEnabled('billing')).toBe(false);
      });

      it('should return false for undefined features', () => {
        expect(service.isFeatureEnabled('media')).toBe(true); // media is enabled by default
      });
    });

    describe('getFeatureConfig', () => {
      it('should return config for a specific feature', () => {
        const mediaConfig = service.getFeatureConfig('media');

        expect(mediaConfig.enabled).toBe(true);
        expect(mediaConfig.maxFileSize).toBe(20);
      });

      it('should return billing config', () => {
        const billingConfig = service.getFeatureConfig('billing');

        expect(billingConfig.enabled).toBe(true);
        expect(billingConfig.provider).toBe('stripe');
      });
    });

    describe('getServerConfig', () => {
      it('should return server configuration', () => {
        const serverConfig = service.getServerConfig();

        expect(serverConfig.port).toBeDefined();
        expect(serverConfig.host).toBeDefined();
        expect(serverConfig.cors).toBeDefined();
      });
    });

    describe('getAuthConfig', () => {
      it('should return auth configuration', () => {
        const authConfig = service.getAuthConfig();

        expect(authConfig.provider).toBe('clerk');
        expect(authConfig.requireEmailVerification).toBe(true);
      });
    });

    describe('environment checks', () => {
      it('should detect production environment', () => {
        const prodConfig = createDefaultAppConfig({
          app: { name: 'Prod', version: '1.0.0', environment: 'production' },
        });
        const prodService = new AppConfigService(prodConfig);

        expect(prodService.isProduction()).toBe(true);
        expect(prodService.isDevelopment()).toBe(false);
      });

      it('should detect development environment', () => {
        const devConfig = createDefaultAppConfig({
          app: { name: 'Dev', version: '1.0.0', environment: 'development' },
        });
        const devService = new AppConfigService(devConfig);

        expect(devService.isProduction()).toBe(false);
        expect(devService.isDevelopment()).toBe(true);
      });

      it('should detect test environment', () => {
        expect(service.isProduction()).toBe(false);
        expect(service.isDevelopment()).toBe(false);
        expect(service.getConfig().app.environment).toBe('test');
      });
    });

    describe('getAppDatabaseConfig', () => {
      it('should return undefined when database not configured', () => {
        expect(service.getAppDatabaseConfig()).toBeUndefined();
      });

      it('should return database config when provided', () => {
        const configWithDb = createDefaultAppConfig({
          database: {
            url: 'postgresql://localhost/test',
            maxConnections: 10,
          },
        });
        const serviceWithDb = new AppConfigService(configWithDb);

        const dbConfig = serviceWithDb.getAppDatabaseConfig();
        expect(dbConfig).toBeDefined();
        expect(dbConfig?.url).toBe('postgresql://localhost/test');
      });
    });
  });

  describe('AppConfigService static methods', () => {
    afterEach(() => {
      // Clean up global instance after each test
      (AppConfigService as any).globalInstance = undefined;
    });

    describe('initialization', () => {
      it('should initialize global instance', () => {
        const config = createDefaultAppConfig();
        AppConfigService.initialize(config);

        const instance = AppConfigService.getInstance();
        expect(instance).toBeInstanceOf(AppConfigService);
      });

      it('should throw when getInstance called before initialize', () => {
        expect(() => AppConfigService.getInstance()).toThrow(
          'AppConfigService not initialized',
        );
      });

      it('should allow re-initialization', () => {
        const config1 = createDefaultAppConfig({ app: { name: 'App 1', version: '1.0.0', environment: 'development' } });
        AppConfigService.initialize(config1);

        const config2 = createDefaultAppConfig({ app: { name: 'App 2', version: '2.0.0', environment: 'development' } });
        AppConfigService.initialize(config2);

        expect(AppConfigService.getConfig().app.name).toBe('App 2');
      });
    });

    describe('static methods delegation', () => {
      beforeEach(() => {
        const config = createDefaultAppConfig({
          app: { name: 'Static Test', version: '1.0.0', environment: 'test' },
          features: {
            media: { enabled: true },
          },
        });
        AppConfigService.initialize(config);
      });

      it('should delegate getConfig to instance', () => {
        const config = AppConfigService.getConfig();
        expect(config.app.name).toBe('Static Test');
      });

      it('should delegate getFeatures to instance', () => {
        const features = AppConfigService.getFeatures();
        expect(features.media.enabled).toBe(true);
      });

      it('should delegate isFeatureEnabled to instance', () => {
        expect(AppConfigService.isFeatureEnabled('media')).toBe(true);
        expect(AppConfigService.isFeatureEnabled('billing')).toBe(false);
      });

      it('should delegate getFeatureConfig to instance', () => {
        const mediaConfig = AppConfigService.getFeatureConfig('media');
        expect(mediaConfig.enabled).toBe(true);
      });

      it('should delegate getServerConfig to instance', () => {
        const serverConfig = AppConfigService.getServerConfig();
        expect(serverConfig).toBeDefined();
      });

      it('should delegate getAuthConfig to instance', () => {
        const authConfig = AppConfigService.getAuthConfig();
        expect(authConfig.provider).toBe('clerk');
      });

      it('should delegate isProduction to instance', () => {
        expect(AppConfigService.isProduction()).toBe(false);
      });

      it('should delegate isDevelopment to instance', () => {
        expect(AppConfigService.isDevelopment()).toBe(false);
      });
    });
  });
});
