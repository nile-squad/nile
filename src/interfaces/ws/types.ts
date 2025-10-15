import type { Socket, Server as SocketIOServer } from 'socket.io';
import type { ServerConfig } from '../rest/rest-server';

export interface WSConfig {
  enabled?: boolean;
  path?: string;
  namespace?: string;
  sessionCookieName?: string; // Cookie name for Better Auth session tokens (defaults to 'better-auth.session_token')
  cors?: {
    origin?: boolean | string | string[];
    credentials?: boolean;
  };
}

export interface WSServerOptions {
  io: SocketIOServer;
  namespace?: string;
  serverConfig: ServerConfig;
}

export interface WSAuthResult {
  isAuthenticated: boolean;
  user?: any;
  session?: any;
  method?: string;
  error?: string;
}

export interface WSSocket extends Socket {
  data: {
    authResult?: WSAuthResult;
  };
}

// biome-ignore lint/complexity/noBannedTypes: Empty request object types
export type WSListServicesRequest = {};

export interface WSGetServiceDetailsRequest {
  service: string;
}

export interface WSGetActionDetailsRequest {
  service: string;
  action: string;
}

// biome-ignore lint/complexity/noBannedTypes: Empty request object types
export type WSGetSchemasRequest = {};

export interface WSExecuteActionRequest {
  service: string;
  action: string;
  payload?: any;
}

export interface WSResponse<T = any> {
  status: boolean;
  message: string;
  data: T;
}

export interface WSErrorResponse {
  status: false;
  message: string;
  data: {
    error?: any;
  };
}
