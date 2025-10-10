import { describe, expect, it, vi, beforeEach } from 'vitest';
import { verify } from 'hono/jwt';
import type { ServerConfig } from '../rest-rpc';
import { 
  extractAuthToken,
  resolveUserContext,
  checkAction,
} from './action-utils';

// Mock dependencies
vi.mock('hono/jwt', () => ({
  verify: vi.fn(),
}));

vi.mock('../logger', () => ({
  logger: {
    error: vi.fn().mockReturnValue('mock-error-id'),
    info: vi.fn(),
    warn: vi.fn(),
  },
}));

describe('Authentication Utils', () => {
  const mockServerConfig: ServerConfig = {
    serverName: 'test-server',
    baseUrl: '/api',
    apiVersion: 'v1',
    services: [],
    allowedOrigins: ['*'],
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('extractAuthToken', () => {
    it('should extract token from payload when no auth config (backward compatibility)', () => {
      const config = { ...mockServerConfig };
      const auth = { token: 'test-token' };
      const context = {};

      const result = extractAuthToken({ auth, context, config });

      expect(result).toBe('test-token');
    });

    it('should extract token from payload when method is payload', () => {
      const config = {
        ...mockServerConfig,
        auth: {
          method: 'payload' as const,
          secret: 'test-secret',
        },
      };
      const auth = { token: 'test-token' };
      const context = {};

      const result = extractAuthToken({ auth, context, config });

      expect(result).toBe('test-token');
    });

    it('should extract token from cookie when method is cookie', () => {
      const config = {
        ...mockServerConfig,
        auth: {
          method: 'cookie' as const,
          secret: 'test-secret',
          cookieName: 'auth_token',
        },
      };
      const auth = { token: 'test-token' };
      const context = {
        req: {
          cookie: vi.fn().mockReturnValue('cookie-token'),
        },
      };

      const result = extractAuthToken({ auth, context, config });

      expect(result).toBe('cookie-token');
      expect(context.req.cookie).toHaveBeenCalledWith('auth_token');
    });

    it('should extract token from custom cookie name', () => {
      const config = {
        ...mockServerConfig,
        auth: {
          method: 'cookie' as const,
          secret: 'test-secret',
          cookieName: 'custom_token',
        },
      };
      const auth = { token: 'test-token' };
      const context = {
        req: {
          cookie: vi.fn().mockReturnValue('custom-cookie-token'),
        },
      };

      const result = extractAuthToken({ auth, context, config });

      expect(result).toBe('custom-cookie-token');
      expect(context.req.cookie).toHaveBeenCalledWith('custom_token');
    });

    it('should extract token from Authorization header when method is header', () => {
      const config = {
        ...mockServerConfig,
        auth: {
          method: 'header' as const,
          secret: 'test-secret',
          headerName: 'authorization',
        },
      };
      const auth = { token: 'test-token' };
      const context = {
        req: {
          header: vi.fn().mockReturnValue('Bearer header-token'),
        },
      };

      const result = extractAuthToken({ auth, context, config });

      expect(result).toBe('header-token');
      expect(context.req.header).toHaveBeenCalledWith('authorization');
    });

    it('should extract token from custom header name', () => {
      const config = {
        ...mockServerConfig,
        auth: {
          method: 'header' as const,
          secret: 'test-secret',
          headerName: 'x-auth-token',
        },
      };
      const auth = { token: 'test-token' };
      const context = {
        req: {
          header: vi.fn().mockReturnValue('Bearer custom-header-token'),
        },
      };

      const result = extractAuthToken({ auth, context, config });

      expect(result).toBe('custom-header-token');
      expect(context.req.header).toHaveBeenCalledWith('x-auth-token');
    });

    it('should return null when Authorization header does not start with Bearer', () => {
      const config = {
        ...mockServerConfig,
        auth: {
          method: 'header' as const,
          secret: 'test-secret',
        },
      };
      const auth = { token: 'test-token' };
      const context = {
        req: {
          header: vi.fn().mockReturnValue('Invalid header-token'),
        },
      };

      const result = extractAuthToken({ auth, context, config });

      expect(result).toBeNull();
    });

    it('should return null for unknown auth method', () => {
      const config = {
        ...mockServerConfig,
        auth: {
          method: 'unknown' as any,
          secret: 'test-secret',
        },
      };
      const auth = { token: 'test-token' };
      const context = {};

      const result = extractAuthToken({ auth, context, config });

      expect(result).toBeNull();
    });

    it('should return null when no token found in any method', () => {
      const config = {
        ...mockServerConfig,
        auth: {
          method: 'payload' as const,
          secret: 'test-secret',
        },
      };
      const context = {};

      const result = extractAuthToken({ context, config });

      expect(result).toBeNull();
    });
  });

  describe('resolveUserContext', () => {
    it('should resolve user context with valid JWT token using new auth config', async () => {
      const mockClaims = {
        sub: 'user-123',
        organization_id: 'company-456',
        role: 'admin',
      };

      vi.mocked(verify).mockResolvedValue(mockClaims);

      const config = {
        ...mockServerConfig,
        auth: {
          method: 'payload' as const,
          secret: 'test-secret',
        },
      };

      const params = {
        auth: { token: 'valid-token' },
        context: {},
        serverConfig: config,
      };

      const result = await resolveUserContext(params);

      expect(result).toEqual({
        result: {
          userId: 'system',
          organizationId: 'company-456',
          isAgent: false,
        },
      });
      expect(verify).toHaveBeenCalledWith('valid-token', 'test-secret');
    });

    it('should resolve user context with valid JWT token using legacy authSecret', async () => {
      const mockClaims = {
        sub: 'user-123',
        organization_id: 'company-456',
        role: 'user',
      };

      vi.mocked(verify).mockResolvedValue(mockClaims);

      const config = {
        ...mockServerConfig,
        authSecret: 'legacy-secret',
      };

      const params = {
        auth: { token: 'valid-token' },
        context: {},
        serverConfig: config,
      };

      const result = await resolveUserContext(params);

      expect(result).toEqual({
        result: {
          userId: 'system',
          organizationId: 'company-456',
          isAgent: false,
        },
      });
      expect(verify).toHaveBeenCalledWith('valid-token', 'legacy-secret');
    });

    it('should return error when no token is found', async () => {
      const config = {
        ...mockServerConfig,
        auth: {
          method: 'payload' as const,
          secret: 'test-secret',
        },
      };

      const params = {
        context: {},
        serverConfig: config,
      };

      const result = await resolveUserContext(params);

      expect(result).toEqual({
        err: 'No organization context - specify organizationId or ensure auth token contains org claims',
        errorId: expect.any(String),
      });
      expect(verify).not.toHaveBeenCalled();
    });

    it('should return error when token verification fails', async () => {
      vi.mocked(verify).mockRejectedValue(new Error('Invalid token'));

      const config = {
        ...mockServerConfig,
        auth: {
          method: 'payload' as const,
          secret: 'test-secret',
        },
      };

      const params = {
        auth: { token: 'invalid-token' },
        context: {},
        serverConfig: config,
      };

      const result = await resolveUserContext(params);

      expect(result).toEqual({
        err: 'No organization context - specify organizationId or ensure auth token contains org claims',
        errorId: expect.any(String),
      });
    });

    it('should handle agent authentication', async () => {
      const mockClaims = {
        sub: 'agent-123',
        type: 'agent',
        organizationId: 'org-456',
      };

      vi.mocked(verify).mockResolvedValue(mockClaims);

      const config = {
        ...mockServerConfig,
        auth: {
          method: 'payload' as const,
          secret: 'test-secret',
        },
      };

      const params = {
        agentMode: true,
        auth: { token: 'agent-token' },
        context: {},
        serverConfig: config,
      };

      const result = await resolveUserContext(params);

      expect(result).toEqual({
        result: {
          userId: 'agent-org-456',
          organizationId: 'org-456',
          isAgent: true,
          triggeredBy: 'agent-123',
        },
      });
    });
  });

  describe('checkAction', () => {
    const mockService = {
      name: 'test-service',
      description: 'Test service for unit tests',
      actions: [
        {
          name: 'protected-action',
          description: 'Protected action for testing',
          isProtected: true,
          handler: async () => ({ status: true as const, message: 'Success', data: {}, isOk: true as const, isError: false as const }),
          validation: { zodSchema: null },
        },
        {
          name: 'public-action',
          description: 'Public action for testing',
          isProtected: false,
          handler: async () => ({ status: true as const, message: 'Success', data: {}, isOk: true as const, isError: false as const }),
          validation: { zodSchema: null },
        },
      ],
    };

    it('should allow public actions without authentication', async () => {
      const config = {
        ...mockServerConfig,
        auth: {
          method: 'payload' as const,
          secret: 'test-secret',
        },
      };

      const result = await checkAction({
        actionName: 'public-action',
        service: mockService,
        userContext: {
          userId: 'user-123',
          organizationId: 'test-org',
          isAgent: false,
        },
        auth: { token: 'test-token' },
        context: {},
        serverConfig: config,
      });

      expect(result).toEqual({
        name: 'public-action',
        description: 'Public action for testing',
        isProtected: false,
        handler: expect.any(Function),
        validation: { zodSchema: null },
      });
    });

    it('should allow protected actions with valid authentication', async () => {
      const mockClaims = {
        sub: 'user-123',
        organization_id: 'company-456',
        role: 'admin',
      };

      vi.mocked(verify).mockResolvedValue(mockClaims);

      const config = {
        ...mockServerConfig,
        auth: {
          method: 'payload' as const,
          secret: 'test-secret',
        },
      };

      const result = await checkAction({
        actionName: 'protected-action',
        service: mockService,
        userContext: {
          userId: 'user-123',
          organizationId: 'test-org',
          isAgent: false,
        },
        auth: { token: 'valid-token' },
        context: {},
        serverConfig: config,
      });

      expect(result).toEqual({
        name: 'protected-action',
        description: 'Protected action for testing',
        isProtected: true,
        handler: expect.any(Function),
        validation: { zodSchema: null },
      });
    });

    it('should reject protected actions without authentication', async () => {
      const config = {
        ...mockServerConfig,
        auth: {
          method: 'payload' as const,
          secret: 'test-secret',
        },
      };

      const result = await checkAction({
        actionName: 'protected-action',
        service: mockService,
        userContext: {
          userId: 'user-123',
          organizationId: 'test-org',
          isAgent: false,
        },
        context: {},
        serverConfig: config,
      });

      expect(result).toEqual({
        status: false,
        message: 'Unauthorized - no authentication token found',
        data: { error_id: expect.any(String) },
      });
    });

    it('should reject protected actions with invalid token', async () => {
      vi.mocked(verify).mockRejectedValue(new Error('Invalid token'));

      const config = {
        ...mockServerConfig,
        auth: {
          method: 'payload' as const,
          secret: 'test-secret',
        },
      };

      const result = await checkAction({
        actionName: 'protected-action',
        service: mockService,
        userContext: {
          userId: 'user-123',
          organizationId: 'test-org',
          isAgent: false,
        },
        auth: { token: 'invalid-token' },
        context: {},
        serverConfig: config,
      });

      expect(result).toEqual({
        status: false,
        message: 'Unauthorized - token verification failed',
        data: { error_id: expect.any(String) },
      });
    });

    it('should reject when no auth secret is configured', async () => {
      const config = {
        ...mockServerConfig,
      };

      const result = await checkAction({
        actionName: 'protected-action',
        service: mockService,
        userContext: {
          userId: 'user-123',
          organizationId: 'test-org',
          isAgent: false,
        },
        auth: { token: 'some-token' },
        context: {},
        serverConfig: config,
      });

      expect(result).toEqual({
        status: false,
        message: 'Server configuration error - auth.secret or authSecret not configured',
        data: { error_id: expect.any(String) },
      });
    });

    it('should work with legacy authSecret configuration', async () => {
      const mockClaims = {
        sub: 'user-123',
        organization_id: 'company-456',
        role: 'admin',
      };

      vi.mocked(verify).mockResolvedValue(mockClaims);

      const config = {
        ...mockServerConfig,
        authSecret: 'legacy-secret',
      };

      const result = await checkAction({
        actionName: 'protected-action',
        service: mockService,
        userContext: {
          userId: 'user-123',
          organizationId: 'test-org',
          isAgent: false,
        },
        auth: { token: 'valid-token' },
        context: {},
        serverConfig: config,
      });

      expect(result).toEqual({
        name: 'protected-action',
        description: 'Protected action for testing',
        isProtected: true,
        handler: expect.any(Function),
        validation: { zodSchema: null },
      });
    });

    it('should extract token from cookie when configured', async () => {
      const mockClaims = {
        sub: 'user-123',
        organization_id: 'company-456',
        role: 'admin',
      };

      vi.mocked(verify).mockResolvedValue(mockClaims);

      const config = {
        ...mockServerConfig,
        auth: {
          method: 'cookie' as const,
          secret: 'test-secret',
          cookieName: 'auth_token',
        },
      };

      const context = {
        req: {
          cookie: vi.fn().mockReturnValue('cookie-token'),
        },
      };

      const result = await checkAction({
        actionName: 'protected-action',
        service: mockService,
        userContext: {
          userId: 'user-123',
          organizationId: 'test-org',
          isAgent: false,
        },
        auth: { token: 'test-token' },
        context,
        serverConfig: config,
      });

      expect(result).toEqual({
        name: 'protected-action',
        description: 'Protected action for testing',
        isProtected: true,
        handler: expect.any(Function),
        validation: { zodSchema: null },
      });
      expect(context.req.cookie).toHaveBeenCalledWith('auth_token');
      expect(verify).toHaveBeenCalledWith('cookie-token', 'test-secret');
    });

    it('should extract token from header when configured', async () => {
      const mockClaims = {
        sub: 'user-123',
        organization_id: 'company-456',
        role: 'admin',
      };

      vi.mocked(verify).mockResolvedValue(mockClaims);

      const config = {
        ...mockServerConfig,
        auth: {
          method: 'header' as const,
          secret: 'test-secret',
          headerName: 'authorization',
        },
      };

      const context = {
        req: {
          header: vi.fn().mockReturnValue('Bearer header-token'),
        },
      };

      const result = await checkAction({
        actionName: 'protected-action',
        service: mockService,
        userContext: {
          userId: 'user-123',
          organizationId: 'test-org',
          isAgent: false,
        },
        auth: { token: 'test-token' },
        context,
        serverConfig: config,
      });

      expect(result).toEqual({
        name: 'protected-action',
        description: 'Protected action for testing',
        isProtected: true,
        handler: expect.any(Function),
        validation: { zodSchema: null },
      });
      expect(context.req.header).toHaveBeenCalledWith('authorization');
      expect(verify).toHaveBeenCalledWith('header-token', 'test-secret');
    });
  });
});