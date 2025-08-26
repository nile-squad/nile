import { describe, it, expect, vi } from 'vitest';
import type { Socket } from 'socket.io';
import { authenticateWS } from '../ws-auth';
import type { ServerConfig } from '../../rest-rpc';

const mockSocket = (handshake: any): Socket => ({
  handshake,
  data: {},
} as Socket);

describe('WS Authentication', () => {
  const mockServerConfig: ServerConfig = {
    serverName: 'test-server',
    baseUrl: '/api',
    apiVersion: 'v1',
    services: [],
    allowedOrigins: ['*'],
  };

  describe('authenticateWS', () => {
    it('should return unauthenticated when no auth methods configured', async () => {
      const socket = mockSocket({
        auth: {},
        headers: {},
      });

      const result = await authenticateWS(socket, mockServerConfig);

      expect(result.isAuthenticated).toBe(false);
      expect(result.error).toBe('No valid authentication found');
    });

    it('should authenticate with JWT from handshake auth token', async () => {
      const config = {
        ...mockServerConfig,
        authSecret: 'test-secret',
      };

      const socket = mockSocket({
        auth: { token: 'Bearer test-jwt-token' },
        headers: {},
      });

      // Mock JWT verify to return a valid payload
      vi.doMock('hono/jwt', () => ({
        verify: vi.fn().mockResolvedValue({
          sub: 'user-123',
          userId: 'user-123',
          organizationId: 'org-456',
        }),
      }));

      const result = await authenticateWS(socket, config);

      expect(result.isAuthenticated).toBe(true);
      expect(result.method).toBe('jwt');
      expect(result.user).toEqual({
        sub: 'user-123',
        userId: 'user-123',
        organizationId: 'org-456',
      });
    });

    it('should authenticate with JWT from Authorization header', async () => {
      const config = {
        ...mockServerConfig,
        authSecret: 'test-secret',
      };

      const socket = mockSocket({
        auth: {},
        headers: {
          authorization: 'Bearer test-jwt-token',
        },
      });

      vi.doMock('hono/jwt', () => ({
        verify: vi.fn().mockResolvedValue({
          sub: 'user-123',
          type: 'agent',
        }),
      }));

      const result = await authenticateWS(socket, config);

      expect(result.isAuthenticated).toBe(true);
      expect(result.method).toBe('agent');
    });

    it('should fail JWT authentication with invalid token', async () => {
      const config = {
        ...mockServerConfig,
        authSecret: 'test-secret',
      };

      const socket = mockSocket({
        auth: { token: 'Bearer invalid-token' },
        headers: {},
      });

      vi.doMock('hono/jwt', () => ({
        verify: vi.fn().mockRejectedValue(new Error('Invalid token')),
      }));

      const result = await authenticateWS(socket, config);

      expect(result.isAuthenticated).toBe(false);
      expect(result.error).toBe('Invalid token');
    });

    it('should authenticate with BetterAuth session', async () => {
      const mockBetterAuth = {
        api: {
          getSession: vi.fn().mockResolvedValue({
            data: {
              session: { id: 'session-123', organizationId: 'org-456' },
              user: { id: 'user-123', email: 'test@example.com' },
            },
          }),
        },
        handler: vi.fn().mockResolvedValue(new Response()),
      };

      const config = {
        ...mockServerConfig,
        betterAuth: {
          instance: mockBetterAuth,
          sessionCookieName: 'better-auth.session_token',
        },
      };

      const socket = mockSocket({
        auth: { token: 'session-token-123' },
        headers: {},
      });

      const result = await authenticateWS(socket, config);

      expect(result.isAuthenticated).toBe(true);
      expect(result.method).toBe('better-auth');
      expect(result.user).toEqual({ id: 'user-123', email: 'test@example.com' });
      expect(result.session).toEqual({ id: 'session-123', organizationId: 'org-456' });
    });

    it('should extract session token from cookies', async () => {
      const mockBetterAuth = {
        api: {
          getSession: vi.fn().mockResolvedValue({
            data: {
              session: { id: 'session-123' },
              user: { id: 'user-123' },
            },
          }),
        },
        handler: vi.fn().mockResolvedValue(new Response()),
      };

      const config = {
        ...mockServerConfig,
        betterAuth: {
          instance: mockBetterAuth,
          sessionCookieName: 'better-auth.session_token',
        },
      };

      const socket = mockSocket({
        auth: {},
        headers: {
          cookie: 'better-auth.session_token=cookie-session-token; other=value',
        },
      });

      const result = await authenticateWS(socket, config);

      expect(result.isAuthenticated).toBe(true);
      expect(mockBetterAuth.api.getSession).toHaveBeenCalledWith({
        headers: {
          authorization: 'Bearer cookie-session-token',
        },
      });
    });

    it('should fail BetterAuth with invalid session', async () => {
      const mockBetterAuth = {
        api: {
          getSession: vi.fn().mockResolvedValue({
            data: null,
          }),
        },
        handler: vi.fn().mockResolvedValue(new Response()),
      };

      const config = {
        ...mockServerConfig,
        betterAuth: {
          instance: mockBetterAuth,
        },
      };

      const socket = mockSocket({
        auth: { token: 'invalid-session' },
        headers: {},
      });

      const result = await authenticateWS(socket, config);

      expect(result.isAuthenticated).toBe(false);
      expect(result.error).toBe('Invalid session');
    });

    it('should try BetterAuth first, then fallback to JWT', async () => {
      const mockBetterAuth = {
        api: {
          getSession: vi.fn().mockResolvedValue({ data: null }),
        },
        handler: vi.fn().mockResolvedValue(new Response()),
      };

      const config = {
        ...mockServerConfig,
        betterAuth: { instance: mockBetterAuth },
        authSecret: 'jwt-secret',
      };

      const socket = mockSocket({
        auth: { token: 'Bearer jwt-token' },
        headers: {},
      });

      vi.doMock('hono/jwt', () => ({
        verify: vi.fn().mockResolvedValue({ sub: 'user-123' }),
      }));

      const result = await authenticateWS(socket, config);

      expect(result.isAuthenticated).toBe(true);
      expect(result.method).toBe('jwt');
      expect(mockBetterAuth.api.getSession).toHaveBeenCalled();
    });
  });
});