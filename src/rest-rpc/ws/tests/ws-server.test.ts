import { describe, it, expect, beforeEach, afterEach, vi, beforeAll } from 'vitest';
import { Server as SocketIOServer } from 'socket.io';
import { io as SocketIOClient, type Socket as ClientSocket } from 'socket.io-client';
import { createServer, type Server as HTTPServer } from 'node:http';
import { createWSRPCServer } from '../ws-server';
import type { ServerConfig } from '../../rest-rpc';
import type { Services } from '../../../types/actions';
import type { Validation } from '../../../utils/validation-utils';
import { Ok } from '../../../utils';
import jwt from 'jsonwebtoken';

// Mock hono/jwt at the top level
vi.mock('hono/jwt', () => ({
  verify: (token: string, secret: string) => {
    // Accept the test token and return a valid user object
    try {
      const decoded = jwt.verify(token, secret);
      return decoded;
    } catch (e) {
      throw new Error('Invalid token');
    }
  },
}));

describe('WS Server Integration', () => {
  let httpServer: HTTPServer;
  let io: SocketIOServer;
  let clientSocket: ClientSocket;
  let serverConfig: ServerConfig;
  let jwtToken: string;

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
          handler: async (payload: any) => { console.log('[TEST ACTION] echo handler called with', payload); return Ok({ echoed: payload }, 'Echo successful'); },
          isProtected: false,
        },
        {
          name: 'protected',
          description: 'Protected action',
          validation: testValidation,
          handler: async (payload: any) => { console.log('[TEST ACTION] protected handler called with', payload); return Ok({ result: 'success' }, 'Protected action executed'); },
          isProtected: false,
        },
        {
          name: 'error',
          description: 'Action that throws an error',
          validation: testValidation,
          handler: async () => { console.log('[TEST ACTION] error handler called'); throw new Error('Test error'); },
          isProtected: false,
        },
      ],
    },
  ];

  beforeEach(async () => {
    const { verify } = await import('hono/jwt');
    jwtToken = jwt.sign({ userId: 'test-user' }, 'test-secret', { expiresIn: '1h' });
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
        console.log('Test HTTP server listening');
        resolve();
      });
    });
  });

  afterEach(async () => {
    if (clientSocket) {
      clientSocket.disconnect();
    }
    if (io) {
      io.close();
    }
    if (httpServer) {
      await new Promise((resolve) => httpServer.close(resolve));
    }
  });

  it('should echo payload for unprotected action', async () => {
    const port = (httpServer.address() as any).port;
    console.log('Connecting client to port', port);
    clientSocket = SocketIOClient(`http://localhost:${port}/ws/rpc`, {
      auth: { token: `Bearer ${jwtToken}` }
    });
    clientSocket.on('connect_error', (err) => {
      console.error('Client connect_error:', err);
    });
    clientSocket.on('error', (err) => {
      console.error('Client error:', err);
    });
    await new Promise<void>((resolve, reject) => {
      clientSocket.on('connect', () => {
        console.log('Client connected');
        clientSocket.emit('executeAction', {
          service: 'TestService',
          action: 'echo',
          payload: { foo: 'bar' },
        }, (response: any) => {
          console.log('Received response:', response);
          try {
            expect(response.status).toBe(true);
            expect(response.data.echoed).toBeDefined();
            expect(response.data.echoed.foo).toBe('bar');
            resolve();
          } catch (err) {
            reject(err);
          }
        });
      });
    });
  }, 15000);

  it('should execute protected action', async () => {
    const port = (httpServer.address() as any).port;
    console.log('Connecting client to port', port);
    clientSocket = SocketIOClient(`http://localhost:${port}/ws/rpc`, {
      auth: { token: `Bearer ${jwtToken}` }
    });
    clientSocket.on('connect_error', (err) => {
      console.error('Client connect_error:', err);
    });
    clientSocket.on('error', (err) => {
      console.error('Client error:', err);
    });
    await new Promise<void>((resolve, reject) => {
      clientSocket.on('connect', () => {
        console.log('Client connected');
        clientSocket.emit('executeAction', {
          service: 'TestService',
          action: 'protected',
          payload: {},
        }, (response: any) => {
          console.log('Received response:', response);
          try {
            expect(response.status).toBe(true);
            expect(response.data.result).toBe('success');
            resolve();
          } catch (err) {
            reject(err);
          }
        });
      });
    });
  }, 15000);

  it('should handle error action', async () => {
    const port = (httpServer.address() as any).port;
    console.log('Connecting client to port', port);
    clientSocket = SocketIOClient(`http://localhost:${port}/ws/rpc`, {
      auth: { token: `Bearer ${jwtToken}` }
    });
    clientSocket.on('connect_error', (err) => {
      console.error('Client connect_error:', err);
    });
    clientSocket.on('error', (err) => {
      console.error('Client error:', err);
    });
    await new Promise<void>((resolve, reject) => {
      clientSocket.on('connect', () => {
        console.log('Client connected');
        clientSocket.emit('executeAction', {
          service: 'TestService',
          action: 'error',
          payload: {},
        }, (response: any) => {
          console.log('Received response:', response);
          try {
            expect(response.status).toBe(false);
            expect(response.message).toMatch(/Test error/);
            resolve();
          } catch (err) {
            reject(err);
          }
        });
      });
    });
  }, 15000);
});
