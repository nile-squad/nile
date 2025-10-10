import type { Context } from 'hono';
import { getCookie } from 'hono/cookie';
import { verify } from 'hono/jwt';
import type { AppContext, ServerConfig } from './rest-rpc';

export interface AuthResult {
  isAuthenticated: boolean;
  user?: any;
  session?: any;
  method?: 'better-auth' | 'jwt' | 'agent';
  error?: string;
}

/**
 * Extract authentication token based on configured method
 */
function extractAuthToken(
  c: Context<AppContext>,
  config: ServerConfig,
  requestData?: any
): string | null {
  // If no auth config, fall back to legacy Authorization header
  if (!config.auth) {
    const authHeader = c.req.header('Authorization');
    return authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;
  }

  const {
    method,
    cookieName = 'auth_token',
    headerName = 'authorization',
  } = config.auth;

  switch (method) {
    case 'cookie':
      return getCookie(c, cookieName) || null;

    case 'header': {
      const authHeader = c.req.header(headerName);
      return authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;
    }

    case 'payload':
      // For payload method, extract token from request body
      return requestData?.auth?.token || null;

    default:
      return null;
  }
}

/**
 * Authenticate using JWT with configurable token extraction
 */
export async function authenticateWithJWT(
  c: Context<AppContext>,
  config: ServerConfig,
  requestData?: any
): Promise<AuthResult> {
  try {
    const token = extractAuthToken(c, config, requestData);
    if (!token) {
      return { isAuthenticated: false, error: 'No authentication token found' };
    }

    const authSecret = config.auth?.secret || config.authSecret;
    if (!authSecret) {
      return { isAuthenticated: false, error: 'Auth secret not configured' };
    }

    const payload = await verify(token, authSecret);

    if (!payload) {
      return { isAuthenticated: false, error: 'Invalid JWT token' };
    }

    return {
      isAuthenticated: true,
      user: payload,
      method: payload.type === 'agent' ? 'agent' : 'jwt',
    };
  } catch (error) {
    return {
      isAuthenticated: false,
      error: error instanceof Error ? error.message : 'JWT validation failed',
    };
  }
}

/**
 * Unified authentication function
 * Checks context for session (set by middleware) and falls back to JWT
 */
export async function authenticate(
  c: Context<AppContext>,
  config: ServerConfig,
  requestData?: any
): Promise<AuthResult> {
  const session = c.var.session;
  const user = c.var.user;

  if (user && session) {
    return {
      isAuthenticated: true,
      user,
      session,
      method: 'better-auth',
    };
  }

  // Better Auth present but no session: do not short-circuit here.
  // Allow fallback to JWT (and other methods) to proceed.

  // Fallback to JWT authentication if auth config is provided
  if (config.auth?.secret || config.authSecret) {
    const jwtResult = await authenticateWithJWT(c, config, requestData);
    if (jwtResult.isAuthenticated) {
      return jwtResult;
    }
  }

  // No authentication method available or none succeeded
  return {
    isAuthenticated: false,
    error: 'No valid authentication found',
  };
}

/**
 * Check if user is an agent (for agentic actions)
 */
export const isAgent = (authResult: AuthResult): boolean => {
  return (
    authResult.method === 'agent' ||
    (authResult.user && authResult.user.type === 'agent')
  );
};
