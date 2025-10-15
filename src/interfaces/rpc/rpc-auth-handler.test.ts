import { beforeEach, describe, expect, it, vi } from 'vitest';
import { verify } from 'hono/jwt';
import type { ServerConfig } from '../rest/rest-server';
import { createRPCAuthHandler, type RPCAuthContext } from './rpc-auth-handler';

vi.mock('hono/jwt', () => ({
	verify: vi.fn(),
}));

describe('RPC Auth Handler', () => {
	const mockServerConfig: ServerConfig = {
		serverName: 'test-server',
		baseUrl: '/api',
		apiVersion: 'v1',
		services: [],
		allowedOrigins: ['*'],
		auth: {
			authHandler: 'jwt',
			method: 'payload',
			secret: 'test-secret',
		},
	};

	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe('Agent Mode', () => {
		it('should create agent user with organizationId from claims', async () => {
			const mockClaims = {
				sub: 'agent-123',
				type: 'agent',
				organizationId: 'org-456',
			};

			vi.mocked(verify).mockResolvedValue(mockClaims);

			const handler = createRPCAuthHandler(mockServerConfig);

			const result = await handler({
				request: {},
				auth: { token: 'agent-token' },
				agentMode: true,
			} as RPCAuthContext);

			expect(result.isOk).toBe(true);
			if (result.isOk) {
				expect(result.data.userId).toBe('agent-org-456');
				expect(result.data.organizationId).toBe('org-456');
				expect(result.data.user?.type).toBe('agent');
				expect(result.data.session?.triggeredBy).toBe('agent-123');
			}
		});

		it('should return error when no organizationId available in agent mode', async () => {
			const mockClaims = {
				sub: 'agent-123',
				type: 'agent',
			};

			vi.mocked(verify).mockResolvedValue(mockClaims);

			const handler = createRPCAuthHandler(mockServerConfig);

			const result = await handler({
				request: {},
				auth: { token: 'agent-token' },
				agentMode: true,
			} as RPCAuthContext);

			expect(result.isError).toBe(true);
			if (result.isError) {
				expect(result.message).toContain('No organization context');
			}
		});
	});

	describe('System Mode', () => {
		it('should create system user with explicit organizationId', async () => {
			const handler = createRPCAuthHandler(mockServerConfig);

			const result = await handler({
				request: {},
				organizationId: 'org-explicit',
			} as RPCAuthContext);

			expect(result.isOk).toBe(true);
			if (result.isOk) {
				expect(result.data.userId).toBe('system');
				expect(result.data.organizationId).toBe('org-explicit');
			}
		});

		it('should fallback to standard auth when organizationId undefined but token provided', async () => {
			const mockClaims = {
				sub: 'user-123',
				organization_id: 'org-from-claims',
			};

			vi.mocked(verify).mockResolvedValue(mockClaims);

			const handler = createRPCAuthHandler(mockServerConfig);

			const result = await handler({
				request: {},
				auth: { token: 'valid-token' },
				organizationId: undefined,
			} as RPCAuthContext);

			expect(result.isOk).toBe(true);
			if (result.isOk) {
				expect(result.data.userId).toBe('user-123');
				expect(result.data.organizationId).toBe('org-from-claims');
				expect(result.data.method).toBe('jwt');
			}
		});

		it('should return error when no organizationId provided or in claims', async () => {
			const mockClaims = {
				sub: 'user-123',
			};

			vi.mocked(verify).mockResolvedValue(mockClaims);

			const handler = createRPCAuthHandler(mockServerConfig);

			const result = await handler({
				request: {},
				auth: { token: 'valid-token' },
			} as RPCAuthContext);

			expect(result.isOk).toBe(true);
			if (result.isOk) {
				expect(result.data.userId).toBe('user-123');
			}
		});
	});

	describe('Standard Mode', () => {
		it('should authenticate with JWT token from payload', async () => {
			const mockClaims = {
				sub: 'user-123',
				organization_id: 'org-456',
			};

			vi.mocked(verify).mockResolvedValue(mockClaims);

			const handler = createRPCAuthHandler(mockServerConfig);

			const result = await handler({
				request: {},
				auth: { token: 'valid-token' },
			} as RPCAuthContext);

			expect(result.isOk).toBe(true);
			if (result.isOk) {
				expect(result.data.userId).toBe('user-123');
				expect(result.data.organizationId).toBe('org-456');
			}
		});

		it('should extract token from context cookie when method is cookie', async () => {
			const mockClaims = {
				sub: 'user-123',
				organization_id: 'org-456',
			};

			vi.mocked(verify).mockResolvedValue(mockClaims);

			const configWithCookie: ServerConfig = {
				...mockServerConfig,
				auth: {
					authHandler: 'jwt',
					method: 'cookie',
					secret: 'test-secret',
					cookieName: 'auth_token',
				},
			};

			const handler = createRPCAuthHandler(configWithCookie);

			const mockContext = {
				req: {
					cookie: (name: string) => name === 'auth_token' ? 'cookie-token' : null,
				},
			};

			const result = await handler({
				request: {},
				context: mockContext,
			} as RPCAuthContext);

			expect(result.isOk).toBe(true);
			if (result.isOk) {
				expect(result.data.userId).toBe('user-123');
				expect(result.data.organizationId).toBe('org-456');
			}
			expect(verify).toHaveBeenCalledWith('cookie-token', 'test-secret');
		});

		it('should extract token from context header when method is header', async () => {
			const mockClaims = {
				sub: 'user-123',
				organization_id: 'org-456',
			};

			vi.mocked(verify).mockResolvedValue(mockClaims);

			const configWithHeader: ServerConfig = {
				...mockServerConfig,
				auth: {
					authHandler: 'jwt',
					method: 'header',
					secret: 'test-secret',
					headerName: 'authorization',
				},
			};

			const handler = createRPCAuthHandler(configWithHeader);

			const mockContext = {
				req: {
					header: (name: string) => name === 'authorization' ? 'Bearer header-token' : null,
				},
			};

			const result = await handler({
				request: {},
				context: mockContext,
			} as RPCAuthContext);

			expect(result.isOk).toBe(true);
			if (result.isOk) {
				expect(result.data.userId).toBe('user-123');
				expect(result.data.organizationId).toBe('org-456');
			}
			expect(verify).toHaveBeenCalledWith('header-token', 'test-secret');
		});

		it('should return error when token verification fails', async () => {
			vi.mocked(verify).mockRejectedValue(new Error('Invalid token'));

			const handler = createRPCAuthHandler(mockServerConfig);

			const result = await handler({
				request: {},
				auth: { token: 'invalid-token' },
			} as RPCAuthContext);

			expect(result.isError).toBe(true);
			if (result.isError) {
				expect(result.message).toContain('token verification failed');
			}
		});
	});

	describe('Auth Method Extraction', () => {
		it('should return error when no token found', async () => {
			const handler = createRPCAuthHandler(mockServerConfig);

			const result = await handler({
				request: {},
			} as RPCAuthContext);

			expect(result.isError).toBe(true);
			if (result.isError) {
				expect(result.message).toContain('Unauthorized');
				expect(result.message).toContain('no authentication token found');
			}
		});
	});
});
