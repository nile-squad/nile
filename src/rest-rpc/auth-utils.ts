import type { Context } from 'hono';
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
 * Authenticate using JWT (legacy method)
 */
export async function authenticateWithJWT(
  c: Context<AppContext>,
  authSecret: string
): Promise<AuthResult> {
  try {
    const authHeader = c.req.header('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return { isAuthenticated: false, error: 'No Bearer token found' };
    }

    const token = authHeader.substring(7);
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
  config: ServerConfig
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

  // If user exists but no session, it means auth middleware ran but user is not authenticated
  // Check if this was processed by Better Auth middleware
  if (config.betterAuth?.instance && user === null && session === null) {
    return {
      isAuthenticated: false,
      error: 'Authentication required',
    };
  }

  // Fallback to JWT authentication if authSecret is provided
  if (config.authSecret) {
    const jwtResult = await authenticateWithJWT(c, config.authSecret);
    if (jwtResult.isAuthenticated) {
      return jwtResult;
    }
  }

  // No authentication method available or failed
  return {
    isAuthenticated: false,
    error: 'Authentication required',
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
