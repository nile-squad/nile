import { describe, it, expect, beforeEach, afterEach, vi, beforeAll } from 'vitest';
import { Server as SocketIOServer } from 'socket.io';
import { io as SocketIOClient, type Socket as ClientSocket } from 'socket.io-client';
import { createServer, type Server as HTTPServer } from 'node:http';
import { createWSRPCServer } from '../ws-server';
import type { ServerConfig } from '../../rest-rpc';
import type { Services } from '../../../types/actions';
import type { Validation } from '../../../utils/validation-utils';

// Mock hono/jwt at the top level
vi.mock('hono/jwt', () => ({
  verify: vi.fn(),
}));

describe('WS Server Integration', () => {
  let httpServer: HTTPServer;
  let io: SocketIOServer;
  let clientSocket: ClientSocket;
  let serverConfig: ServerConfig;

  const testValidation: Validation = {
    zodSchema: null,
  };

  const testServices: Services = [
    {
      name: 'TestService',
      description: 'A test service',
      actions: [
        {
          name: 'echo',
          description: 'Echo back input',
          validation: testValidation,
          handler: async (payload: any) => ({
            status: true,
            message: 'Echo successful',
            data: { echoed: payload },
          }),
          isProtected: false,
        },
        {
          name: 'protected',
          description: 'Protected action',
          validation: testValidation,
          handler: async (payload: any) => ({
            status: true,
            message: 'Protected action executed',
            data: { result: 'success' },
          }),
          isProtected: true,
        },
        {
          name: 'error',
          description: 'Action that throws an error',
          validation: testValidation,
          handler: async () => {
            throw new Error('Test error');
          },
          isProtected: false,
        },
      ],
    },
  ];

  beforeEach(async () => {
    const { verify } = await import('hono/jwt');
    
    return new Promise<void>((resolve) => {
      httpServer = createServer();
      io = new SocketIOServer(httpServer, {
        cors: { origin: '*', credentials: true },
      });

      serverConfig = {
        serverName: 'test-server',
        baseUrl: '/api',
        apiVersion: 'v1',
        services: testServices,
        allowedOrigins: ['*'],
        authSecret: 'test-secret',
      };

      createWSRPCServer({
        io,
        namespace: '/ws/rpc',
        serverConfig,
      });

      httpServer.listen(() => {
        const port = (httpServer.address() as any)?.port;
        
        // Set up mock for valid auth for basic connection
        (verify as any).mockResolvedValue({
          sub: 'user-123',
          userId: 'user-123',
          organizationId: 'org-456',
        });
        
        clientSocket = SocketIOClient(`http://localhost:${port}/ws/rpc`, {
          forceNew: true,
          transports: ['websocket'],
          auth: {
            token: 'Bearer valid-test-token', // Provide auth for basic client
          },
        });
        
        clientSocket.on('connect', () => resolve());
      });
    });
  });

  afterEach(async () => {
    return new Promise<void>((resolve) => {
      io.close();
      clientSocket.close();
      httpServer.close(() => resolve());
    });
  });

  describe('Discovery Events', () => {
    it('should list services', async () => {
      return new Promise<void>((resolve) => {
        clientSocket.emit('listServices', {}, (response: any) => {
          expect(response.status).toBe(true);
          expect(response.data).toEqual(['testservice']);
          resolve();
        });
      });
    });

    it('should get service details', async () => {
      return new Promise<void>((resolve) => {
        clientSocket.emit('getServiceDetails', { service: 'TestService' }, (response: any) => {
          expect(response.status).toBe(true);
          expect(response.data).toEqual({
            name: 'TestService',
            description: 'A test service',
            availableActions: ['echo', 'protected', 'error'],
          });
          resolve();
        });
      });
    });

    it('should return error for non-existent service', async () => {
      return new Promise<void>((resolve) => {
        clientSocket.emit('getServiceDetails', { service: 'NonExistent' }, (response: any) => {
          expect(response.status).toBe(false);
          expect(response.message).toBe('Service NonExistent not found');
          resolve();
        });
      });
    });

    it('should get action details', async () => {
      return new Promise<void>((resolve) => {
        clientSocket.emit('getActionDetails', { service: 'TestService', action: 'echo' }, (response: any) => {
          expect(response.status).toBe(true);
          expect(response.data).toEqual({
            name: 'echo',
            description: 'Echo back input',
            validation: null,
            isProtected: false,
            isSpecial: undefined,
            hooks: null,
            pipeline: undefined,
          });
          resolve();
        });
      });
    });

    it('should return error for non-existent action', async () => {
      return new Promise<void>((resolve) => {
        clientSocket.emit('getActionDetails', { service: 'TestService', action: 'nonexistent' }, (response: any) => {
          expect(response.status).toBe(false);
          expect(response.message).toBe('Action nonexistent not found in service TestService');
          resolve();
        });
      });
    });

    it('should get schemas', async () => {
      return new Promise<void>((resolve) => {
        clientSocket.emit('getSchemas', {}, (response: any) => {
          expect(response.status).toBe(true);
          expect(response.data).toBeInstanceOf(Array);
          expect(response.data[0]).toHaveProperty('TestService');
          resolve();
        });
      });
    });
  });

  describe('Action Execution', () => {
    it('should execute unprotected action successfully', async () => {
      return new Promise<void>((resolve) => {
        const payload = { message: 'Hello World' };
        
        clientSocket.emit('executeAction', {
          service: 'TestService',
          action: 'echo',
          payload,
        }, (response: any) => {
          expect(response.status).toBe(true);
          expect(response.message).toBe('Echo successful');
          // Payload is enriched with user context from auth
          expect(response.data.echoed).toEqual({
            message: 'Hello World',
            user_id: 'user-123',
            organization_id: 'org-456',
            userId: 'user-123',
            organizationId: 'org-456',
          });
          resolve();
        });
      });
    });

    it('should reject protected action without authentication', async () => {
      const { verify } = await import('hono/jwt');
      
      return new Promise<void>((resolve) => {
        // Mock auth to fail for this test
        (verify as any).mockRejectedValue(new Error('No token'));
        
        const unauthSocket = SocketIOClient(`http://localhost:${(httpServer.address() as any)?.port}/ws/rpc`, {
          forceNew: true,
          transports: ['websocket'],
          // No auth token
        });

        // Connection should be rejected due to no auth
        unauthSocket.on('connect_error', (error: any) => {
          expect(error.message).toBe('UNAUTHORIZED');
          resolve();
        });
        
        // If somehow connection succeeds, that's an issue
        unauthSocket.on('connect', () => {
          unauthSocket.close();
          throw new Error('Unauthenticated connection should have been rejected');
        });
      });
    });

    it('should return error for non-existent service', async () => {
      return new Promise<void>((resolve) => {
        clientSocket.emit('executeAction', {
          service: 'NonExistent',
          action: 'echo',
          payload: {},
        }, (response: any) => {
          expect(response.status).toBe(false);
          expect(response.message).toBe('Service NonExistent not found');
          resolve();
        });
      });
    });

    it('should return error for non-existent action', async () => {
      return new Promise<void>((resolve) => {
        clientSocket.emit('executeAction', {
          service: 'TestService',
          action: 'nonexistent',
          payload: {},
        }, (response: any) => {
          expect(response.status).toBe(false);
          expect(response.message).toBe('Action nonexistent not found in service TestService');
          resolve();
        });
      });
    });
  });

  describe('Authentication', () => {
    it('should execute protected action with valid JWT', async () => {
      const { verify } = await import('hono/jwt');
      
      return new Promise<void>((resolve) => {
        // Set up mock before creating socket
        (verify as any).mockResolvedValue({
          sub: 'user-123',
          userId: 'user-123',
          organizationId: 'org-456',
        });

        const authenticatedSocket = SocketIOClient(`http://localhost:${(httpServer.address() as any)?.port}/ws/rpc`, {
          forceNew: true,
          transports: ['websocket'],
          auth: {
            token: 'Bearer valid-jwt-token',
          },
        });

        authenticatedSocket.on('connect', () => {
          authenticatedSocket.emit('executeAction', {
            service: 'TestService',
            action: 'protected',
            payload: {},
          }, (response: any) => {
            expect(response.status).toBe(true);
            expect(response.message).toBe('Protected action executed');
            authenticatedSocket.close();
            resolve();
          });
        });
        
        authenticatedSocket.on('connect_error', (error: any) => {
          authenticatedSocket.close();
          throw new Error(`Should not have connection error: ${error.message}`);
        });
      });
    });

    it('should reject invalid JWT token', async () => {
      const { verify } = await import('hono/jwt');
      
      return new Promise<void>((resolve) => {
        // Set up mock to reject before creating socket
        (verify as any).mockRejectedValue(new Error('Invalid token'));

        const invalidSocket = SocketIOClient(`http://localhost:${(httpServer.address() as any)?.port}/ws/rpc`, {
          forceNew: true,
          transports: ['websocket'],
          auth: {
            token: 'Bearer invalid-token',
          },
          timeout: 2000,
        });

        invalidSocket.on('connect_error', (error: any) => {
          expect(error.message).toBe('UNAUTHORIZED');
          resolve();
        });
        
        // If connection succeeds when it should fail, that's an error
        invalidSocket.on('connect', () => {
          invalidSocket.close();
          throw new Error('Connection should have been rejected');
        });
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle server errors gracefully', async () => {      
      return new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Test timed out - no response received'));
        }, 4000);
        
        clientSocket.emit('executeAction', {
          service: 'TestService',
          action: 'error',
          payload: {},
        }, (response: any) => {
          clearTimeout(timeout);
          
          try {
            expect(response).toBeDefined();
            expect(typeof response).toBe('object');
            expect(response.status).toBe(false);
            expect(response.message).toBe('Test error');
            resolve();
          } catch (error) {
            reject(error);
          }
        });
      });
    });
  });
});