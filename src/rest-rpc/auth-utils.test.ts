import { describe, it, expect, vi, beforeEach } from 'vitest';
import { verify } from 'hono/jwt';
import { getCookie } from 'hono/cookie';
import { authenticate, authenticateWithJWT } from './auth-utils';
import type { ServerConfig } from './rest-rpc';

// Mock dependencies
vi.mock('hono/jwt', () => ({
  verify: vi.fn(),
}));

vi.mock('hono/cookie', () => ({
  getCookie: vi.fn(),
}));

describe('Auth Utils', () => {
  const mockServerConfig: ServerConfig = {
    serverName: 'test-server',
    baseUrl: '/api',
    apiVersion: 'v1',
    services: [],
    allowedOrigins: ['*'],
  };

  const mockContext = {
    var: {
      user: null,
      session: null,
    },
    req: {
      header: vi.fn(),
      cookie: vi.fn(),
    },
  } as any;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('authenticateWithJWT', () => {
    it('should authenticate with cookie method', async () => {
      const config = {
        ...mockServerConfig,
        auth: {
          method: 'cookie' as const,
          secret: 'test-secret',
          cookieName: 'auth_token',
        },
      };

      const mockClaims = {
        sub: 'user-123',
        organization_id: 'org-456',
      };

      vi.mocked(getCookie).mockReturnValue('cookie-token');
      vi.mocked(verify).mockResolvedValue(mockClaims);

      const result = await authenticateWithJWT(mockContext, config);

      expect(result.isAuthenticated).toBe(true);
      expect(result.user).toEqual(mockClaims);
      expect(result.method).toBe('jwt');
      expect(getCookie).toHaveBeenCalledWith(mockContext, 'auth_token');
      expect(verify).toHaveBeenCalledWith('cookie-token', 'test-secret');
    });

    it('should authenticate with header method', async () => {
      const config = {
        ...mockServerConfig,
        auth: {
          method: 'header' as const,
          secret: 'test-secret',
          headerName: 'authorization',
        },
      };

      const mockClaims = {
        sub: 'user-123',
        organization_id: 'org-456',
      };

      mockContext.req.header.mockReturnValue('Bearer header-token');
      vi.mocked(verify).mockResolvedValue(mockClaims);

      const result = await authenticateWithJWT(mockContext, config);

      expect(result.isAuthenticated).toBe(true);
      expect(result.user).toEqual(mockClaims);
      expect(result.method).toBe('jwt');
      expect(mockContext.req.header).toHaveBeenCalledWith('authorization');
      expect(verify).toHaveBeenCalledWith('header-token', 'test-secret');
    });

    it('should authenticate with payload method', async () => {
      const config = {
        ...mockServerConfig,
        auth: {
          method: 'payload' as const,
          secret: 'test-secret',
        },
      };

      const mockClaims = {
        sub: 'user-123',
        organization_id: 'org-456',
      };

      const requestData = {
        auth: {
          token: 'payload-token',
        },
      };

      vi.mocked(verify).mockResolvedValue(mockClaims);

      const result = await authenticateWithJWT(mockContext, config, requestData);

      expect(result.isAuthenticated).toBe(true);
      expect(result.user).toEqual(mockClaims);
      expect(result.method).toBe('jwt');
      expect(verify).toHaveBeenCalledWith('payload-token', 'test-secret');
    });

    it('should fail when no token found', async () => {
      const config = {
        ...mockServerConfig,
        auth: {
          method: 'cookie' as const,
          secret: 'test-secret',
        },
      };

      vi.mocked(getCookie).mockReturnValue(undefined);

      const result = await authenticateWithJWT(mockContext, config);

      expect(result.isAuthenticated).toBe(false);
      expect(result.error).toBe('No authentication token found');
    });

    it('should fail when auth secret not configured', async () => {
      const config = {
        ...mockServerConfig,
        auth: {
          method: 'cookie' as const,
        },
      } as any;

      vi.mocked(getCookie).mockReturnValue('token');

      const result = await authenticateWithJWT(mockContext, config);

      expect(result.isAuthenticated).toBe(false);
      expect(result.error).toBe('Auth secret not configured');
    });

    it('should fail when token verification fails', async () => {
      const config = {
        ...mockServerConfig,
        auth: {
          method: 'cookie' as const,
          secret: 'test-secret',
        },
      };

      vi.mocked(getCookie).mockReturnValue('invalid-token');
      vi.mocked(verify).mockRejectedValue(new Error('Invalid token'));

      const result = await authenticateWithJWT(mockContext, config);

      expect(result.isAuthenticated).toBe(false);
      expect(result.error).toBe('Invalid token');
    });

    it('should handle agent type in JWT payload', async () => {
      const config = {
        ...mockServerConfig,
        auth: {
          method: 'cookie' as const,
          secret: 'test-secret',
        },
      };

      const mockClaims = {
        sub: 'user-123',
        type: 'agent',
      };

      vi.mocked(getCookie).mockReturnValue('agent-token');
      vi.mocked(verify).mockResolvedValue(mockClaims);

      const result = await authenticateWithJWT(mockContext, config);

      expect(result.isAuthenticated).toBe(true);
      expect(result.method).toBe('agent');
    });
  });

  describe('authenticate', () => {
    it('should return BetterAuth session when available', async () => {
      const config = {
        ...mockServerConfig,
        betterAuth: {
          instance: {
            api: {
              getSession: vi.fn(),
            },
            handler: vi.fn(),
          },
        },
      };

      mockContext.var.user = { id: 'user-123' };
      mockContext.var.session = { id: 'session-123' };

      const result = await authenticate(mockContext, config);

      expect(result.isAuthenticated).toBe(true);
      expect(result.method).toBe('better-auth');
      expect(result.user).toEqual({ id: 'user-123' });
      expect(result.session).toEqual({ id: 'session-123' });
    });

    it('should fallback to JWT when BetterAuth session not available', async () => {
      const config = {
        ...mockServerConfig,
        auth: {
          method: 'cookie' as const,
          secret: 'test-secret',
        },
      };

      const mockClaims = {
        sub: 'user-123',
        organization_id: 'org-456',
      };

      // Clear BetterAuth context
      const contextWithoutSession = {
        ...mockContext,
        var: {
          user: null,
          session: null,
        },
      };

      vi.mocked(getCookie).mockReturnValue('jwt-token');
      vi.mocked(verify).mockResolvedValue(mockClaims);

      const result = await authenticate(contextWithoutSession, config);

      expect(result.isAuthenticated).toBe(true);
      expect(result.method).toBe('jwt');
      expect(result.user).toEqual(mockClaims);
    });

    it('should fail when no authentication methods available', async () => {
      const config = {
        ...mockServerConfig,
      };

      // Clear BetterAuth context
      const contextWithoutSession = {
        ...mockContext,
        var: {
          user: null,
          session: null,
        },
      };

      const result = await authenticate(contextWithoutSession, config);

      expect(result.isAuthenticated).toBe(false);
      expect(result.error).toBe('No valid authentication found');
    });

    it('should pass request data to JWT authentication for payload method', async () => {
      const config = {
        ...mockServerConfig,
        auth: {
          method: 'payload' as const,
          secret: 'test-secret',
        },
      };

      const mockClaims = {
        sub: 'user-123',
        organization_id: 'org-456',
      };

      const requestData = {
        auth: {
          token: 'payload-token',
        },
      };

      // Clear BetterAuth context
      const contextWithoutSession = {
        ...mockContext,
        var: {
          user: null,
          session: null,
        },
      };

      vi.mocked(verify).mockResolvedValue(mockClaims);

      const result = await authenticate(contextWithoutSession, config, requestData);

      expect(result.isAuthenticated).toBe(true);
      expect(result.method).toBe('jwt');
      expect(result.user).toEqual(mockClaims);
      expect(verify).toHaveBeenCalledWith('payload-token', 'test-secret');
    });
  });
});
