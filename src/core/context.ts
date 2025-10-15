import type { Context as HonoContext } from 'hono';
import type { AuthHandlerResult } from '../types/auth-handler';

export type WebSocketContext = {
  connection: any;
  headers?: Record<string, string>;
  cookies?: Record<string, string>;
  [key: string]: any;
};

export type RPCContext = {
  [key: string]: any;
};

type InterfaceContext = {
  hono?: HonoContext;
  ws?: WebSocketContext;
  rpc?: RPCContext;
};

export type NileContext = {
  hono?: HonoContext;
  ws?: WebSocketContext;
  rpc?: RPCContext;
  authResult?: AuthHandlerResult['data'];
  _store: Map<string, any>;

  get<T = any>(key: string): T | undefined;
  set<T = any>(key: string, value: T): void;
  getAuth(): AuthHandlerResult['data'] | undefined;
  getUser():
    | { userId: string; organizationId: string; [key: string]: any }
    | undefined;
};

export function createNileContext(
  interfaceContext?: InterfaceContext
): NileContext {
  const store = new Map<string, any>();

  const context: NileContext = {
    hono: interfaceContext?.hono,
    ws: interfaceContext?.ws,
    rpc: interfaceContext?.rpc,
    _store: store,

    get<T = any>(key: string): T | undefined {
      return store.get(key) as T | undefined;
    },

    set<T = any>(key: string, value: T): void {
      store.set(key, value);
    },

    getAuth(): AuthHandlerResult['data'] | undefined {
      return context.authResult;
    },

    getUser():
      | { userId: string; organizationId: string; [key: string]: any }
      | undefined {
      if (!context.authResult) {
        return;
      }
      return context.authResult as {
        userId: string;
        organizationId: string;
        [key: string]: any;
      };
    },
  };

  return context;
}
