import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { serve } from '@hono/node-server';
import { createRestRPC } from '../rest-server';
import type { ServerConfig } from '../rest-server';
import type { Service } from '../../../types/actions';
import { Ok } from '../../../utils/safe-try';
import type { CorsConfig } from '../cors-types';

/**
 * CORS Configuration Integration Tests
 * 
 * Tests CORS functionality using full REST RPC server setup to ensure
 * route-specific middleware executes in production-like environment.
 */

describe('CORS Configuration', () => {
  describe('Default Behavior (No CORS Config)', () => {
    let server: any;
    let baseUrl: string;
    const testPort = 9890;

    beforeAll(async () => {
      const testService: Service = {
        name: 'test',
        description: 'Test service',
        actions: [
          {
            name: 'getData',
            description: 'Get test data',
            isProtected: false,
            handler: async () => Ok({ success: true }),
            validation: {},
            meta: {},
          },
        ],
      };

      const config: ServerConfig = {
        serverName: 'Test Server',
        baseUrl: '/api',
        apiVersion: 'v1',
        services: [testService],
        host: 'localhost',
        port: testPort.toString(),
        allowedOrigins: ['https://example.com', 'https://app.example.com'],
      };

      const { app } = createRestRPC(config);
      server = serve({ fetch: app.fetch, port: testPort }, () => {});
      baseUrl = `http://localhost:${testPort}/api/v1/services`;
      await new Promise((resolve) => setTimeout(resolve, 500));
    });

    afterAll(async () => {
      if (server) {
        server.close();
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    it('should use legacy allowedOrigins when cors config is absent', async () => {
      const response = await fetch(`${baseUrl}/test`, {
        method: 'OPTIONS',
        headers: {
          origin: 'https://example.com',
          'access-control-request-method': 'POST',
        },
      });

      expect(response.headers.get('access-control-allow-origin')).toBe('https://example.com');
      expect(response.headers.get('access-control-allow-credentials')).toBe('true');
    });

    it('should reject unlisted origins with legacy allowedOrigins', async () => {
      const response = await fetch(`${baseUrl}/test`, {
        method: 'OPTIONS',
        headers: {
          origin: 'https://evil.com',
          'access-control-request-method': 'POST',
        },
      });

      // When origin is rejected, header is either empty string or null
      const allowOrigin = response.headers.get('access-control-allow-origin');
      expect(allowOrigin === '' || allowOrigin === null).toBe(true);
    });
  });

  describe('CORS Enabled/Disabled', () => {
    let server: any;
    let baseUrl: string;
    const testPort = 9891;

    const setupServer = async (corsConfig: CorsConfig) => {
      const testService: Service = {
        name: 'test',
        description: 'Test service',
        actions: [
          {
            name: 'getData',
            description: 'Get test data',
            isProtected: false,
            handler: async () => Ok({ success: true }),
            validation: {},
            meta: {},
          },
        ],
      };

      const config: ServerConfig = {
        serverName: 'Test Server',
        baseUrl: '/api',
        apiVersion: 'v1',
        services: [testService],
        host: 'localhost',
        port: testPort.toString(),
        allowedOrigins: ['https://example.com'],
        cors: corsConfig,
      };

      const { app } = createRestRPC(config);
      server = serve({ fetch: app.fetch, port: testPort }, () => {});
      baseUrl = `http://localhost:${testPort}/api/v1/services`;
      await new Promise((resolve) => setTimeout(resolve, 500));
    };

    afterAll(async () => {
      if (server) {
        server.close();
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    it('should skip CORS middleware when enabled is false', async () => {
      await setupServer({ enabled: false });

      const response = await fetch(`${baseUrl}/test`, {
        method: 'OPTIONS',
        headers: {
          origin: 'https://example.com',
          'access-control-request-method': 'POST',
        },
      });

      // When CORS is disabled, no CORS headers should be set
      expect(response.status).toBe(404);

      if (server) {
        server.close();
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    });

    it('should apply CORS when enabled is true', async () => {
      await setupServer({ enabled: true });

      const response = await fetch(`${baseUrl}/test`, {
        method: 'OPTIONS',
        headers: {
          origin: 'https://example.com',
          'access-control-request-method': 'POST',
        },
      });

      expect(response.headers.get('access-control-allow-origin')).toBe('https://example.com');

      if (server) {
        server.close();
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    });
  });

  describe('Custom Default CORS Options', () => {
    let server: any;
    let baseUrl: string;
    const testPort = 9892;

    beforeAll(async () => {
      const testService: Service = {
        name: 'test',
        description: 'Test service',
        actions: [
          {
            name: 'getData',
            description: 'Get test data',
            isProtected: false,
            handler: async () => Ok({ success: true }),
            validation: {},
            meta: {},
          },
        ],
      };

      const config: ServerConfig = {
        serverName: 'Test Server',
        baseUrl: '/api',
        apiVersion: 'v1',
        services: [testService],
        host: 'localhost',
        port: testPort.toString(),
        allowedOrigins: ['https://example.com'],
        cors: {
          enabled: true,
          defaults: {
            origin: ['https://custom.com', 'https://other.com'],
            credentials: false,
            allowHeaders: ['X-Custom-Header'],
            allowMethods: ['GET', 'POST', 'DELETE'],
          },
        },
      };

      const { app } = createRestRPC(config);
      server = serve({ fetch: app.fetch, port: testPort }, () => {});
      baseUrl = `http://localhost:${testPort}/api/v1/services`;
      await new Promise((resolve) => setTimeout(resolve, 500));
    });

    afterAll(async () => {
      if (server) {
        server.close();
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    it('should override default origin with custom origin list', async () => {
      const response = await fetch(`${baseUrl}/test`, {
        method: 'OPTIONS',
        headers: {
          origin: 'https://custom.com',
          'access-control-request-method': 'POST',
        },
      });

      expect(response.headers.get('access-control-allow-origin')).toBeTruthy();
    });

    it('should override default credentials', async () => {
      const response = await fetch(`${baseUrl}/test`, {
        method: 'OPTIONS',
        headers: {
          origin: 'https://custom.com',
          'access-control-request-method': 'POST',
        },
      });

      expect(response.headers.get('access-control-allow-credentials')).toBeFalsy();
    });

    it('should override default headers and methods', async () => {
      const response = await fetch(`${baseUrl}/test`, {
        method: 'OPTIONS',
        headers: {
          origin: 'https://custom.com',
          'access-control-request-method': 'POST',
        },
      });

      expect(response.headers.get('access-control-allow-headers')).toContain('X-Custom-Header');
      expect(response.headers.get('access-control-allow-methods')).toContain('DELETE');
    });
  });

  describe('Route-Specific CORS with Static Options', () => {
    let server: any;
    let baseUrl: string;
    const testPort = 9893;

    beforeAll(async () => {
      const uploadsService: Service = {
        name: 'uploads',
        description: 'Uploads service',
        actions: [
          {
            name: 'uploadFile',
            description: 'Upload a file',
            isProtected: false,
            handler: async () => Ok({ uploaded: true }),
            validation: {},
            meta: {},
          },
        ],
      };

      const apiService: Service = {
        name: 'api',
        description: 'API service',
        actions: [
          {
            name: 'upload',
            description: 'Upload data',
            isProtected: false,
            handler: async () => Ok({ uploaded: true }),
            validation: {},
            meta: {},
          },
        ],
      };

      const config: ServerConfig = {
        serverName: 'Test Server',
        baseUrl: '/test',
        apiVersion: 'v1',
        services: [uploadsService, apiService],
        host: 'localhost',
        port: testPort.toString(),
        allowedOrigins: ['https://example.com'],
        cors: {
          enabled: true,
          defaults: {
            credentials: true,
            maxAge: 600,
          },
          addCors: [
            {
              path: '/test/v1/services/uploads',
              options: {
                origin: '*',
                allowMethods: ['GET', 'HEAD', 'POST'],
              },
            },
            {
              path: '/test/v1/services/api',
              options: {
                origin: 'https://trusted.com',
              },
            },
          ],
        },
      };

      const { app } = createRestRPC(config);
      server = serve({ fetch: app.fetch, port: testPort }, () => {});
      baseUrl = `http://localhost:${testPort}/test/v1/services`;
      await new Promise((resolve) => setTimeout(resolve, 500));
    });

    afterAll(async () => {
      if (server) {
        server.close();
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    it('should apply route-specific static CORS options', async () => {
      const response = await fetch(`${baseUrl}/uploads`, {
        method: 'OPTIONS',
        headers: {
          origin: 'https://any-origin.com',
          'access-control-request-method': 'POST',
        },
      });

      expect(response.headers.get('access-control-allow-origin')).toBe('*');
    });

    it('should merge route options with defaults', async () => {
      const response = await fetch(`${baseUrl}/api`, {
        method: 'OPTIONS',
        headers: {
          origin: 'https://trusted.com',
          'access-control-request-method': 'POST',
        },
      });

      expect(response.headers.get('access-control-allow-credentials')).toBe('true');
      expect(response.headers.get('access-control-max-age')).toBe('600');
    });
  });

  describe('Route-Specific CORS with Resolver', () => {
    let server: any;
    let baseUrl: string;
    const testPort = 9894;

    beforeAll(async () => {
      const partnerService: Service = {
        name: 'partner',
        description: 'Partner service',
        actions: [
          {
            name: 'getData',
            description: 'Get partner data',
            isProtected: false,
            handler: async () => Ok({ data: 'partner-data' }),
            validation: {},
            meta: {},
          },
        ],
      };

      const uploadService: Service = {
        name: 'upload',
        description: 'Upload service',
        actions: [
          {
            name: 'avatar',
            description: 'Upload avatar',
            isProtected: false,
            handler: async () => Ok({ uploaded: true }),
            validation: {},
            meta: {},
          },
        ],
      };

      const testService: Service = {
        name: 'test',
        description: 'Test service',
        actions: [
          {
            name: 'getData',
            description: 'Get test data',
            isProtected: false,
            handler: async () => Ok({ success: true }),
            validation: {},
            meta: {},
          },
        ],
      };

      const config: ServerConfig = {
        serverName: 'Test Server',
        baseUrl: '/api',
        apiVersion: 'v1',
        services: [partnerService, uploadService, testService],
        host: 'localhost',
        port: testPort.toString(),
        allowedOrigins: ['https://example.com'],
        cors: {
          enabled: true,
          addCors: [
            {
              path: '/api/v1/services/partner',
              resolver: (origin) => {
                return origin === 'https://partner.com';
              },
            },
            {
              path: '/api/v1/services/upload',
              resolver: (origin) => {
                if (origin.endsWith('.corp.example')) {
                  return {
                    origin,
                    allowMethods: ['POST', 'PUT'],
                    allowHeaders: ['Content-Type', 'X-Upload-Key'],
                    maxAge: 300,
                  };
                }
                return false;
              },
            },
            {
              path: '/api/v1/services/test',
              resolver: () => undefined,
            },
          ],
        },
      };

      const { app } = createRestRPC(config);
      server = serve({ fetch: app.fetch, port: testPort }, () => {});
      baseUrl = `http://localhost:${testPort}/api/v1/services`;
      await new Promise((resolve) => setTimeout(resolve, 500));
    });

    afterAll(async () => {
      if (server) {
        server.close();
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    it('should allow origin when resolver returns true', async () => {
      const response = await fetch(`${baseUrl}/partner`, {
        method: 'OPTIONS',
        headers: {
          origin: 'https://partner.com',
          'access-control-request-method': 'POST',
        },
      });

      expect(response.headers.get('access-control-allow-origin')).toBe('https://partner.com');
    });

    it('should reject origin when resolver returns false', async () => {
      const response = await fetch(`${baseUrl}/partner`, {
        method: 'OPTIONS',
        headers: {
          origin: 'https://evil.com',
          'access-control-request-method': 'POST',
        },
      });

      // When origin is rejected, header is either empty string or null
      const allowOrigin = response.headers.get('access-control-allow-origin');
      expect(allowOrigin === '' || allowOrigin === null).toBe(true);
    });

    it('should apply custom options when resolver returns object', async () => {
      const response = await fetch(`${baseUrl}/upload`, {
        method: 'OPTIONS',
        headers: {
          origin: 'https://app.corp.example',
          'access-control-request-method': 'POST',
        },
      });

      expect(response.headers.get('access-control-allow-origin')).toBe('https://app.corp.example');
      expect(response.headers.get('access-control-max-age')).toBe('300');
    });

    it('should use defaults when resolver returns undefined', async () => {
      const response = await fetch(`${baseUrl}/test`, {
        method: 'OPTIONS',
        headers: {
          origin: 'https://example.com',
          'access-control-request-method': 'POST',
        },
      });

      // Should fall back to default behavior (allowedOrigins)
      expect(response.headers.get('access-control-allow-origin')).toBe('https://example.com');
    });

    it('should handle resolver errors gracefully', async () => {
      // Stop current server
      if (server) {
        server.close();
        await new Promise((resolve) => setTimeout(resolve, 100));
      }

      // Create new server with error-throwing resolver
      const errorService: Service = {
        name: 'error',
        description: 'Error service',
        actions: [
          {
            name: 'getData',
            description: 'Get data',
            isProtected: false,
            handler: async () => Ok({ success: true }),
            validation: {},
            meta: {},
          },
        ],
      };

      const config: ServerConfig = {
        serverName: 'Test Server',
        baseUrl: '/api',
        apiVersion: 'v1',
        services: [errorService],
        host: 'localhost',
        port: testPort.toString(),
        allowedOrigins: ['https://example.com'],
        cors: {
          enabled: true,
          addCors: [
            {
              path: '/api/v1/services/error',
              resolver: () => {
                throw new Error('Resolver error');
              },
            },
          ],
        },
      };

      const { app } = createRestRPC(config);
      server = serve({ fetch: app.fetch, port: testPort }, () => {});
      await new Promise((resolve) => setTimeout(resolve, 500));

      const response = await fetch(`${baseUrl}/error`, {
        method: 'OPTIONS',
        headers: {
          origin: 'https://example.com',
          'access-control-request-method': 'POST',
        },
      });

      // Should fall back to defaults even on error
      expect(response.status).not.toBe(500);
    });
  });

  describe('Multiple Route Rules', () => {
    let server: any;
    let baseUrl: string;
    const testPort = 9895;

    beforeAll(async () => {
      const publicService: Service = {
        name: 'public',
        description: 'Public service',
        actions: [
          {
            name: 'getData',
            description: 'Get public data',
            isProtected: false,
            handler: async () => Ok({ data: 'public' }),
            validation: {},
            meta: {},
          },
        ],
      };

      const partnerService: Service = {
        name: 'partner',
        description: 'Partner service',
        actions: [
          {
            name: 'getData',
            description: 'Get partner data',
            isProtected: false,
            handler: async () => Ok({ data: 'partner' }),
            validation: {},
            meta: {},
          },
        ],
      };

      const config: ServerConfig = {
        serverName: 'Test Server',
        baseUrl: '/api',
        apiVersion: 'v1',
        services: [publicService, partnerService],
        host: 'localhost',
        port: testPort.toString(),
        allowedOrigins: ['https://example.com'],
        cors: {
          enabled: true,
          addCors: [
            {
              path: '/api/v1/services/public',
              options: {
                origin: '*',
              },
            },
            {
              path: '/api/v1/services/partner',
              resolver: (origin) => origin === 'https://trusted-partner.com',
            },
          ],
        },
      };

      const { app } = createRestRPC(config);
      server = serve({ fetch: app.fetch, port: testPort }, () => {});
      baseUrl = `http://localhost:${testPort}/api/v1/services`;
      await new Promise((resolve) => setTimeout(resolve, 500));
    });

    afterAll(async () => {
      if (server) {
        server.close();
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    it('should apply different rules to different paths', async () => {
      // Public endpoint should allow all
      const publicResponse = await fetch(`${baseUrl}/public`, {
        method: 'OPTIONS',
        headers: {
          origin: 'https://random.com',
          'access-control-request-method': 'POST',
        },
      });
      expect(publicResponse.headers.get('access-control-allow-origin')).toBe('*');

      // Partner endpoint should be restricted
      const partnerResponse = await fetch(`${baseUrl}/partner`, {
        method: 'OPTIONS',
        headers: {
          origin: 'https://trusted-partner.com',
          'access-control-request-method': 'POST',
        },
      });
      expect(partnerResponse.headers.get('access-control-allow-origin')).toBe('https://trusted-partner.com');
    });
  });

  describe('Empty allowedOrigins wildcard behavior', () => {
    let server: any;
    let baseUrl: string;
    const testPort = 9896;

    beforeAll(async () => {
      const testService: Service = {
        name: 'test',
        description: 'Test service',
        actions: [
          {
            name: 'getData',
            description: 'Get test data',
            isProtected: false,
            handler: async () => Ok({ success: true }),
            validation: {},
            meta: {},
          },
        ],
      };

      const config: ServerConfig = {
        serverName: 'Test Server',
        baseUrl: '/api',
        apiVersion: 'v1',
        services: [testService],
        host: 'localhost',
        port: testPort.toString(),
        allowedOrigins: [],
      };

      const { app } = createRestRPC(config);
      server = serve({ fetch: app.fetch, port: testPort }, () => {});
      baseUrl = `http://localhost:${testPort}/api/v1/services`;
      await new Promise((resolve) => setTimeout(resolve, 500));
    });

    afterAll(async () => {
      if (server) {
        server.close();
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    it('should allow all origins when allowedOrigins is empty', async () => {
      const response = await fetch(`${baseUrl}/test`, {
        method: 'OPTIONS',
        headers: {
          origin: 'https://any-origin.com',
          'access-control-request-method': 'POST',
        },
      });

      expect(response.headers.get('access-control-allow-origin')).toBe('*');
    });
  });
});
